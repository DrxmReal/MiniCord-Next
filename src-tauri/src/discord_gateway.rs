use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct UserPresence {
    pub user_id: String,
    pub status: String,
    pub custom_status: Option<String>,
    pub activity: Option<String>,
}

pub type PresenceMap = Arc<RwLock<HashMap<String, UserPresence>>>;

pub struct GatewayState {
    pub presences: PresenceMap,
    pub active_token: Arc<RwLock<Option<String>>>,
}

impl GatewayState {
    pub fn new() -> Self {
        Self {
            presences: Arc::new(RwLock::new(HashMap::new())),
            active_token: Arc::new(RwLock::new(None)),
        }
    }
}

fn parse_activity_info(activities: &[Value]) -> (Option<String>, Option<String>) {
    let mut custom = None;
    let mut main_activity = None;

    for act in activities {
        let act_type = act.get("type").and_then(|t| t.as_i64()).unwrap_or(0);
        let name = act.get("name").and_then(|n| n.as_str()).unwrap_or("");
        let state = act.get("state").and_then(|s| s.as_str());

        if act_type == 4 {
            // Type 4 is custom status
            if let Some(s) = state {
                custom = Some(s.to_string());
            } else if !name.is_empty() && name != "Custom Status" {
                custom = Some(name.to_string());
            }
        } else if main_activity.is_none() && !name.is_empty() {
            let prefix = match act_type {
                0 => "Playing",
                1 => "Streaming",
                2 => "Listening to",
                3 => "Watching",
                5 => "Competing in",
                _ => "Playing",
            };
            main_activity = Some(format!("{} {}", prefix, name));
        }
    }

    (custom, main_activity)
}

pub fn spawn_gateway_session(app: AppHandle, token: String, state: Arc<GatewayState>) {
    tokio::spawn(async move {
        {
            let mut tok = state.active_token.write().await;
            *tok = Some(token.clone());
        }

        loop {
            // Check if token was cleared (logout)
            {
                let tok = state.active_token.read().await;
                if tok.as_deref() != Some(&token) {
                    println!("[Gateway] Token changed or invalidated, closing loop");
                    break;
                }
            }

            println!("[Gateway] Connecting to Discord Gateway v10...");
            let gateway_url = "wss://gateway.discord.gg/?v=10&encoding=json";

            match connect_async(gateway_url).await {
                Ok((ws_stream, _)) => {
                    println!("[Gateway] WebSocket connected! Waiting for HELLO...");
                    let (mut write, mut read) = ws_stream.split();
                    let mut heartbeat_interval_ms: u64 = 41250;
                    let mut seq_num: Option<i64> = None;

                    // Read first message for HELLO (Opcode 10)
                    if let Some(Ok(msg)) = read.next().await {
                        if let Ok(text) = msg.to_text() {
                            if let Ok(val) = serde_json::from_str::<Value>(text) {
                                if val.get("op").and_then(|o| o.as_i64()) == Some(10) {
                                    if let Some(hb) = val["d"]["heartbeat_interval"].as_u64() {
                                        heartbeat_interval_ms = hb;
                                    }
                                }
                            }
                        }
                    }

                    // Send Identify (Opcode 2)
                    let identify_payload = json!({
                        "op": 2,
                        "d": {
                            "token": token,
                            "capabilities": 16381,
                            "properties": crate::client_identity::properties(),
                            "presence": {
                                "status": "online",
                                "since": 0,
                                "activities": [],
                                "afk": false
                            },
                            "compress": false,
                            "client_state": {
                                "guild_versions": {},
                                "highest_last_message_id": "0",
                                "read_state_version": 0,
                                "user_guild_settings_version": -1,
                                "user_settings_version": -1,
                                "private_channels_version": "0",
                                "api_code_version": 0
                            }
                        }
                    });

                    if let Err(e) = write.send(Message::Text(identify_payload.to_string().into())).await {
                        println!("[Gateway] Failed to send identify: {:?}", e);
                        sleep(Duration::from_secs(3)).await;
                        continue;
                    }
                    println!("[Gateway] Identify sent! Heartbeat interval: {}ms", heartbeat_interval_ms);

                    // Spawn Heartbeat loop
                    let (tx_hb, mut rx_hb) = tokio::sync::mpsc::channel::<()>(1);
                    let hb_token = token.clone();
                    let hb_active = state.active_token.clone();
                    let hb_handle = tokio::spawn(async move {
                        let interval = Duration::from_millis(heartbeat_interval_ms);
                        loop {
                            sleep(interval).await;
                            {
                                let tok = hb_active.read().await;
                                if tok.as_deref() != Some(&hb_token) {
                                    break;
                                }
                            }
                            if tx_hb.send(()).await.is_err() {
                                break;
                            }
                        }
                    });

                    // Main socket read loop
                    loop {
                        tokio::select! {
                            _ = rx_hb.recv() => {
                                let hb_msg = json!({
                                    "op": 1,
                                    "d": seq_num
                                });
                                if let Err(e) = write.send(Message::Text(hb_msg.to_string().into())).await {
                                    println!("[Gateway] Heartbeat write failed: {:?}", e);
                                    break;
                                }
                            }
                            msg_opt = read.next() => {
                                match msg_opt {
                                    Some(Ok(Message::Text(txt))) => {
                                        if let Ok(v) = serde_json::from_str::<Value>(&txt) {
                                            if let Some(s) = v.get("s").and_then(|s| s.as_i64()) {
                                                seq_num = Some(s);
                                            }

                                            let op = v.get("op").and_then(|o| o.as_i64()).unwrap_or(-1);

                                            if op == 0 {
                                                let event_name = v.get("t").and_then(|t| t.as_str()).unwrap_or("");

                                                if event_name == "READY" {
                                                    println!("[Gateway] Received READY event! Parsing presences...");
                                                    if let Some(presences_arr) = v["d"]["presences"].as_array() {
                                                        let mut map_lock = state.presences.write().await;
                                                        for p in presences_arr {
                                                            if let Some(uid) = p["user"]["id"].as_str() {
                                                                let status = p["status"].as_str().unwrap_or("offline").to_string();
                                                                let activities = p["activities"].as_array().cloned().unwrap_or_default();
                                                                let (custom, main_act) = parse_activity_info(&activities);

                                                                map_lock.insert(uid.to_string(), UserPresence {
                                                                    user_id: uid.to_string(),
                                                                    status,
                                                                    custom_status: custom,
                                                                    activity: main_act,
                                                                });
                                                            }
                                                        }
                                                        let all_presences: Vec<UserPresence> = map_lock.values().cloned().collect();
                                                        let _ = app.emit("gateway-presences-sync", &all_presences);
                                                    }
                                                } else if event_name == "PRESENCE_UPDATE" {
                                                    let p = &v["d"];
                                                    if let Some(uid) = p["user"]["id"].as_str() {
                                                        let status = p["status"].as_str().unwrap_or("offline").to_string();
                                                        let activities = p["activities"].as_array().cloned().unwrap_or_default();
                                                        let (custom, main_act) = parse_activity_info(&activities);

                                                        let presence = UserPresence {
                                                            user_id: uid.to_string(),
                                                            status,
                                                            custom_status: custom,
                                                            activity: main_act,
                                                        };

                                                        {
                                                            let mut map_lock = state.presences.write().await;
                                                            map_lock.insert(uid.to_string(), presence.clone());
                                                        }

                                                        let _ = app.emit("gateway-presence-update", &presence);
                                                    }
                                                } else if event_name == "MESSAGE_CREATE" {
                                                    let _ = app.emit("gateway-message-create", &v["d"]);
                                                } else if event_name == "TYPING_START" {
                                                    let _ = app.emit("gateway-typing-start", &v["d"]);
                                                } else if event_name == "MESSAGE_REACTION_ADD" {
                                                    let _ = app.emit("gateway-reaction-add", &v["d"]);
                                                } else if event_name == "MESSAGE_REACTION_REMOVE" {
                                                    let _ = app.emit("gateway-reaction-remove", &v["d"]);
                                                } else if event_name == "RELATIONSHIP_ADD" || event_name == "RELATIONSHIP_REMOVE" {
                                                    let _ = app.emit("gateway-relationship-update", &v["d"]);
                                                }
                                            } else if op == 1 {
                                                // Gateway requested immediate heartbeat
                                                let hb_msg = json!({
                                                    "op": 1,
                                                    "d": seq_num
                                                });
                                                let _ = write.send(Message::Text(hb_msg.to_string().into())).await;
                                            } else if op == 7 || op == 9 {
                                                // Reconnect requested
                                                println!("[Gateway] Reconnect requested (op {})", op);
                                                break;
                                            }
                                        }
                                    }
                                    Some(Ok(Message::Close(_))) => {
                                        println!("[Gateway] Socket closed by server");
                                        break;
                                    }
                                    Some(Err(e)) => {
                                        println!("[Gateway] Socket read error: {:?}", e);
                                        break;
                                    }
                                    None => break,
                                    _ => {}
                                }
                            }
                        }
                    }

                    hb_handle.abort();
                }
                Err(e) => {
                    println!("[Gateway] Connection failed: {:?}", e);
                }
            }

            // Backoff before reconnecting
            sleep(Duration::from_secs(4)).await;
        }
    });
}
