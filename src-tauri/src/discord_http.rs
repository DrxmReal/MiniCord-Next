use std::sync::Arc;
use tokio::sync::RwLock;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::json;
use base64::Engine;

#[derive(Clone)]
pub struct DiscordState {
    pub client: Arc<RwLock<Option<reqwest::Client>>>,
    pub cdn_client: reqwest::Client,
    pub token: Arc<RwLock<Option<String>>>,
}

impl DiscordState {
    pub fn new() -> Self {
        let cdn_builder = reqwest::Client::builder()
            .user_agent(crate::client_identity::user_agent());
        let cdn_client = cdn_builder.build().unwrap_or_default();

        Self {
            client: Arc::new(RwLock::new(None)),
            cdn_client,
            token: Arc::new(RwLock::new(None)),
        }
    }

    pub async fn set_token(&self, token: String) -> Result<serde_json::Value, String> {
        let clean = token.chars().filter(|c| !c.is_whitespace() && *c != '"' && *c != '\'').collect::<String>();
        if clean.is_empty() {
            return Err("Token empty".to_string());
        }

        let mut headers = HeaderMap::new();
        headers.insert(AUTHORIZATION, HeaderValue::from_str(&clean).map_err(|e| e.to_string())?);
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if let Ok(props) = HeaderValue::from_str(&crate::client_identity::super_properties_header()) {
            headers.insert("x-super-properties", props);
        }

        let builder = reqwest::Client::builder()
            .default_headers(headers)
            .user_agent(crate::client_identity::user_agent());

        let client = builder.build().map_err(|e| e.to_string())?;

        // Test credentials against /users/@me
        let resp = client.get("https://discord.com/api/v10/users/@me").send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            return Err(format!("Discord rejected token with status: {}", resp.status()));
        }

        let user_json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

        *self.client.write().await = Some(client);
        *self.token.write().await = Some(clean.clone());

        // Save token to persistent vault
        let _ = crate::auth_vault::save_token_to_vault(&clean);

        Ok(user_json)
    }

    pub async fn get_client(&self) -> Result<reqwest::Client, String> {
        let guard = self.client.read().await;
        guard.clone().ok_or_else(|| "Not logged in".to_string())
    }

    pub async fn get_guilds(&self) -> Result<Vec<serde_json::Value>, String> {
        let client = self.get_client().await?;
        let resp = client
            .get("https://discord.com/api/v10/users/@me/guilds")
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            return Err(format!("HTTP {}", resp.status()));
        }

        let mut guilds: Vec<serde_json::Value> = resp.json().await.map_err(|e| e.to_string())?;

        // Fetch user settings to sort guilds according to the user's customized server rail
        if let Ok(settings_resp) = client.get("https://discord.com/api/v10/users/@me/settings").send().await {
            if settings_resp.status().is_success() {
                if let Ok(settings) = settings_resp.json::<serde_json::Value>().await {
                    let mut ordered_ids: Vec<String> = Vec::new();
                    if let Some(folders) = settings.get("guild_folders").and_then(|f| f.as_array()) {
                        for folder in folders {
                            if let Some(ids) = folder.get("guild_ids").and_then(|i| i.as_array()) {
                                for id in ids {
                                    if let Some(s) = id.as_str() {
                                        ordered_ids.push(s.to_string());
                                    }
                                }
                            }
                        }
                    } else if let Some(positions) = settings.get("guild_positions").and_then(|p| p.as_array()) {
                        for id in positions {
                            if let Some(s) = id.as_str() {
                                ordered_ids.push(s.to_string());
                            }
                        }
                    }

                    if !ordered_ids.is_empty() {
                        guilds.sort_by_key(|g| {
                            let gid = g.get("id").and_then(|i| i.as_str()).unwrap_or("");
                            ordered_ids.iter().position(|id| id == gid).unwrap_or(usize::MAX)
                        });
                    }
                }
            }
        }

        Ok(guilds)
    }

    pub async fn ring_channel(&self, channel_id: &str) -> Result<bool, String> {
        let client = self.get_client().await?;
        let url = format!("https://discord.com/api/v9/channels/{}/call/ring", channel_id);
        let resp = client.post(&url).json(&serde_json::json!({})).send().await.map_err(|e| e.to_string())?;
        Ok(resp.status().is_success())
    }

    pub async fn stop_ring_channel(&self, channel_id: &str) -> Result<bool, String> {
        let client = self.get_client().await?;
        let url = format!("https://discord.com/api/v9/channels/{}/call/stop-ringing", channel_id);
        let resp = client.post(&url).json(&serde_json::json!({})).send().await.map_err(|e| e.to_string())?;
        Ok(resp.status().is_success())
    }

    pub async fn get_user_dms(&self) -> Result<Vec<serde_json::Value>, String> {
        let client = self.get_client().await?;
        let url = "https://discord.com/api/v10/users/@me/channels";
        let resp = client.get(url).send().await.map_err(|e| e.to_string())?;

        if resp.status().is_success() {
            resp.json::<Vec<serde_json::Value>>().await.map_err(|e| e.to_string())
        } else {
            Err(format!("HTTP {}", resp.status()))
        }
    }

    pub async fn get_guild_channels(&self, guild_id: &str) -> Result<Vec<serde_json::Value>, String> {
        let client = self.get_client().await?;
        let url = format!("https://discord.com/api/v10/guilds/{}/channels", guild_id);
        let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;

        if resp.status().is_success() {
            resp.json::<Vec<serde_json::Value>>().await.map_err(|e| e.to_string())
        } else {
            Err(format!("HTTP {}", resp.status()))
        }
    }

    pub async fn get_messages(&self, channel_id: &str, limit: u32) -> Result<Vec<serde_json::Value>, String> {
        let client = self.get_client().await?;
        let url = format!("https://discord.com/api/v10/channels/{}/messages?limit={}", channel_id, limit);
        let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;

        if resp.status().is_success() {
            resp.json::<Vec<serde_json::Value>>().await.map_err(|e| e.to_string())
        } else {
            Err(format!("HTTP {}", resp.status()))
        }
    }

    pub async fn send_message(&self, channel_id: &str, content: &str) -> Result<serde_json::Value, String> {
        let client = self.get_client().await?;
        let url = format!("https://discord.com/api/v10/channels/{}/messages", channel_id);
        let payload = json!({ "content": content });

        let resp = client.post(&url).json(&payload).send().await.map_err(|e| e.to_string())?;
        if resp.status().is_success() {
            resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
        } else {
            Err(format!("HTTP {}", resp.status()))
        }
    }

    pub async fn send_message_attachment(
        &self,
        channel_id: &str,
        content: &str,
        filename: &str,
        bytes: Vec<u8>,
    ) -> Result<serde_json::Value, String> {
        let client = self.get_client().await?;
        let url = format!("https://discord.com/api/v10/channels/{}/messages", channel_id);

        let payload_json = json!({ "content": content }).to_string();

        let part_file = reqwest::multipart::Part::bytes(bytes)
            .file_name(filename.to_string())
            .mime_str("application/octet-stream")
            .map_err(|e| e.to_string())?;

        let form = reqwest::multipart::Form::new()
            .text("payload_json", payload_json)
            .part("files[0]", part_file);

        let resp = client.post(&url).multipart(form).send().await.map_err(|e| e.to_string())?;
        if resp.status().is_success() {
            resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
        } else {
            Err(format!("HTTP {}", resp.status()))
        }
    }

    pub async fn fetch_cdn_image(&self, url: &str) -> Result<String, String> {
        let resp = self.cdn_client.get(url).send().await.map_err(|e| e.to_string())?;
        if resp.status().is_success() {
            let content_type = resp.headers().get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("image/png")
                .to_string();
            let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
            let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
            Ok(format!("data:{};base64,{}", content_type, b64))
        } else {
            Err(format!("CDN status: {}", resp.status()))
        }
    }
}
