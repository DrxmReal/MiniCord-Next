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

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct VoiceState {
    pub guild_id: Option<String>,
    pub channel_id: Option<String>,
    pub user_id: String,
    pub session_id: String,
    pub deaf: bool,
    pub mute: bool,
    pub self_deaf: bool,
    pub self_mute: bool,
    pub self_video: bool,
    pub suppress: bool,
    pub member: Option<Value>,
}

pub type PresenceMap = Arc<RwLock<HashMap<String, UserPresence>>>;
pub type VoiceStateMap = Arc<RwLock<HashMap<String, HashMap<String, VoiceState>>>>; // guild_id -> (user_id -> VoiceState)
pub type MemberMap = Arc<RwLock<HashMap<String, HashMap<String, Value>>>>; // guild_id -> (user_id -> Member)
pub type EmojiMap = Arc<RwLock<HashMap<String, Vec<Value>>>>; // guild_id -> [Emoji]
pub type StickerMap = Arc<RwLock<HashMap<String, Vec<Value>>>>; // guild_id -> [Sticker]

pub enum GatewayCommand {
    UpdateVoiceState {
        guild_id: Option<String>,
        channel_id: Option<String>,
        self_mute: bool,
        self_deaf: bool,
    },
    SubscribeGuildMembers {
        guild_id: String,
        channel_id: String,
    },
}

pub struct GatewayState {
    pub presences: PresenceMap,
    pub voice_states: VoiceStateMap,
    pub guild_members: MemberMap,
    pub guild_emojis: EmojiMap,
    pub guild_stickers: StickerMap,
    pub active_token: Arc<RwLock<Option<String>>>,
    pub cmd_tx: Arc<RwLock<Option<tokio::sync::mpsc::Sender<GatewayCommand>>>>,
}

impl GatewayState {
    pub fn new() -> Self {
        Self {
            presences: Arc::new(RwLock::new(HashMap::new())),
            voice_states: Arc::new(RwLock::new(HashMap::new())),
            guild_members: Arc::new(RwLock::new(HashMap::new())),
            guild_emojis: Arc::new(RwLock::new(HashMap::new())),
            guild_stickers: Arc::new(RwLock::new(HashMap::new())),
            active_token: Arc::new(RwLock::new(None)),
            cmd_tx: Arc::new(RwLock::new(None)),
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
                    let (cmd_tx, mut cmd_rx) = tokio::sync::mpsc::channel::<GatewayCommand>(32);
                    {
                        let mut tx_lock = state.cmd_tx.write().await;
                        *tx_lock = Some(cmd_tx);
                    }

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
                            Some(cmd) = cmd_rx.recv() => {
                                match cmd {
                                    GatewayCommand::UpdateVoiceState { guild_id, channel_id, self_mute, self_deaf } => {
                                        let msg = json!({
                                            "op": 4,
                                            "d": {
                                                "guild_id": guild_id,
                                                "channel_id": channel_id,
                                                "self_mute": self_mute,
                                                "self_deaf": self_deaf
                                            }
                                        });
                                        println!("[Gateway] Transmitting Opcode 4 (VoiceStateUpdate): {}", msg);
                                        let _ = write.send(Message::Text(msg.to_string().into())).await;
                                    }
                                    GatewayCommand::SubscribeGuildMembers { guild_id, channel_id } => {
                                        let op14 = json!({
                                            "op": 14,
                                            "d": {
                                                "guild_id": guild_id.clone(),
                                                "typing": true,
                                                "threads": true,
                                                "activities": true,
                                                "members": [],
                                                "channels": {
                                                    channel_id: [[0, 99]]
                                                }
                                            }
                                        });
                                        let _ = write.send(Message::Text(op14.to_string().into())).await;

                                        let op8 = json!({
                                            "op": 8,
                                            "d": {
                                                "guild_id": guild_id,
                                                "query": "",
                                                "limit": 0
                                            }
                                        });
                                        let _ = write.send(Message::Text(op8.to_string().into())).await;
                                    }
                                }
                            }
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
                                                } else if event_name == "GUILD_CREATE" {
                                                    if let Some(gid) = v["d"]["id"].as_str() {
                                                        // 1. Members
                                                        if let Some(m_arr) = v["d"]["members"].as_array() {
                                                            let mut gm_lock = state.guild_members.write().await;
                                                            let g_members = gm_lock.entry(gid.to_string()).or_insert_with(HashMap::new);
                                                            for m in m_arr {
                                                                if let Some(uid) = m["user"]["id"].as_str() {
                                                                    g_members.insert(uid.to_string(), m.clone());
                                                                }
                                                            }
                                                            let all: Vec<Value> = g_members.values().cloned().collect();
                                                            let _ = app.emit("gateway-guild-members-chunk", json!({ "guild_id": gid, "members": all }));
                                                        }

                                                        // 2. Emojis
                                                        if let Some(emojis) = v["d"]["emojis"].as_array() {
                                                            let mut ge_lock = state.guild_emojis.write().await;
                                                            ge_lock.insert(gid.to_string(), emojis.clone());
                                                            let _ = app.emit("gateway-guild-emojis-update", json!({ "guild_id": gid, "emojis": emojis }));
                                                        }

                                                        // 3. Stickers
                                                        if let Some(stickers) = v["d"]["stickers"].as_array() {
                                                            let mut gs_lock = state.guild_stickers.write().await;
                                                            gs_lock.insert(gid.to_string(), stickers.clone());
                                                            let _ = app.emit("gateway-guild-stickers-update", json!({ "guild_id": gid, "stickers": stickers }));
                                                        }

                                                        // 4. Voice states
                                                        if let Some(v_states) = v["d"]["voice_states"].as_array() {
                                                            let mut vs_map = state.voice_states.write().await;
                                                            let guild_map = vs_map.entry(gid.to_string()).or_insert_with(HashMap::new);
                                                            for d in v_states {
                                                                if let (Some(uid), Some(cid)) = (d["user_id"].as_str(), d["channel_id"].as_str()) {
                                                                    guild_map.insert(uid.to_string(), VoiceState {
                                                                        guild_id: Some(gid.to_string()),
                                                                        channel_id: Some(cid.to_string()),
                                                                        user_id: uid.to_string(),
                                                                        session_id: d["session_id"].as_str().unwrap_or("").to_string(),
                                                                        deaf: d["deaf"].as_bool().unwrap_or(false),
                                                                        mute: d["mute"].as_bool().unwrap_or(false),
                                                                        self_deaf: d["self_deaf"].as_bool().unwrap_or(false),
                                                                        self_mute: d["self_mute"].as_bool().unwrap_or(false),
                                                                        self_video: d["self_video"].as_bool().unwrap_or(false),
                                                                        suppress: d["suppress"].as_bool().unwrap_or(false),
                                                                        member: d.get("member").cloned(),
                                                                    });
                                                                }
                                                            }
                                                            let all: Vec<VoiceState> = guild_map.values().cloned().collect();
                                                            let _ = app.emit("gateway-guild-voice-states", json!({ "guild_id": gid, "voice_states": all }));
                                                        }
                                                    }
                                                } else if event_name == "GUILD_MEMBERS_CHUNK" {
                                                    if let (Some(gid), Some(m_arr)) = (v["d"]["guild_id"].as_str(), v["d"]["members"].as_array()) {
                                                        let mut gm_lock = state.guild_members.write().await;
                                                        let g_members = gm_lock.entry(gid.to_string()).or_insert_with(HashMap::new);
                                                        for m in m_arr {
                                                            if let Some(uid) = m["user"]["id"].as_str() {
                                                                g_members.insert(uid.to_string(), m.clone());
                                                            }
                                                        }
                                                        let all: Vec<Value> = g_members.values().cloned().collect();
                                                        let _ = app.emit("gateway-guild-members-chunk", json!({ "guild_id": gid, "members": all }));
                                                    }
                                                } else if event_name == "GUILD_MEMBER_LIST_UPDATE" {
                                                    if let (Some(gid), Some(ops)) = (v["d"]["guild_id"].as_str(), v["d"]["ops"].as_array()) {
                                                        let mut gm_lock = state.guild_members.write().await;
                                                        let g_members = gm_lock.entry(gid.to_string()).or_insert_with(HashMap::new);
                                                        for op in ops {
                                                            if let Some(items) = op.get("items").and_then(|i| i.as_array()) {
                                                                for item in items {
                                                                    if let Some(member) = item.get("member") {
                                                                        if let Some(uid) = member["user"]["id"].as_str() {
                                                                            g_members.insert(uid.to_string(), member.clone());
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            if let Some(item) = op.get("item") {
                                                                if let Some(member) = item.get("member") {
                                                                    if let Some(uid) = member["user"]["id"].as_str() {
                                                                        g_members.insert(uid.to_string(), member.clone());
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        let all: Vec<Value> = g_members.values().cloned().collect();
                                                        let _ = app.emit("gateway-guild-members-chunk", json!({ "guild_id": gid, "members": all }));
                                                    }
                                                } else if event_name == "VOICE_STATE_UPDATE" {
                                                    let d = &v["d"];
                                                    if let (Some(uid), Some(gid)) = (d["user_id"].as_str(), d["guild_id"].as_str()) {
                                                        let mut vs_map = state.voice_states.write().await;
                                                        let guild_map = vs_map.entry(gid.to_string()).or_insert_with(HashMap::new);
                                                        if let Some(cid) = d["channel_id"].as_str() {
                                                            guild_map.insert(uid.to_string(), VoiceState {
                                                                guild_id: Some(gid.to_string()),
                                                                channel_id: Some(cid.to_string()),
                                                                user_id: uid.to_string(),
                                                                session_id: d["session_id"].as_str().unwrap_or("").to_string(),
                                                                deaf: d["deaf"].as_bool().unwrap_or(false),
                                                                mute: d["mute"].as_bool().unwrap_or(false),
                                                                self_deaf: d["self_deaf"].as_bool().unwrap_or(false),
                                                                self_mute: d["self_mute"].as_bool().unwrap_or(false),
                                                                self_video: d["self_video"].as_bool().unwrap_or(false),
                                                                suppress: d["suppress"].as_bool().unwrap_or(false),
                                                                member: d.get("member").cloned(),
                                                            });
                                                        } else {
                                                            guild_map.remove(uid);
                                                        }
                                                    }
                                                    let _ = app.emit("gateway-voice-state-update", &v["d"]);
                                                } else if event_name == "VOICE_SERVER_UPDATE" {
                                                    let _ = app.emit("gateway-voice-server-update", &v["d"]);
                                                } else if event_name == "MESSAGE_CREATE" {
                                                    if let (Some(gid), Some(member)) = (v["d"]["guild_id"].as_str(), v["d"].get("member")) {
                                                        if let Some(uid) = v["d"]["author"]["id"].as_str() {
                                                            let mut full_member = member.clone();
                                                            full_member["user"] = v["d"]["author"].clone();
                                                            let mut gm_lock = state.guild_members.write().await;
                                                            let g_members = gm_lock.entry(gid.to_string()).or_insert_with(HashMap::new);
                                                            g_members.insert(uid.to_string(), full_member);
                                                        }
                                                    }
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
