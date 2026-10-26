mod client_identity;
mod auth_vault;
mod wallpaper_theme;
mod discord_http;
mod discord_gateway;

use std::sync::Arc;
use std::collections::HashMap;
use tauri::{AppHandle, State};
use discord_http::DiscordState;
use discord_gateway::{GatewayState, UserPresence};
use wallpaper_theme::ThemePalette;
use base64::Engine;

#[tauri::command]
fn get_theme_palette() -> ThemePalette {
    wallpaper_theme::get_active_theme()
}

#[tauri::command]
fn get_saved_token() -> Option<String> {
    auth_vault::load_active_token()
}

#[tauri::command]
async fn login(
    token: String,
    app: AppHandle,
    state: State<'_, DiscordState>,
    gw_state: State<'_, Arc<GatewayState>>,
) -> Result<serde_json::Value, String> {
    let res = state.set_token(token.clone()).await?;
    discord_gateway::spawn_gateway_session(app, token, (*gw_state).clone());
    Ok(res)
}

#[tauri::command]
async fn auto_login(
    app: AppHandle,
    state: State<'_, DiscordState>,
    gw_state: State<'_, Arc<GatewayState>>,
) -> Result<serde_json::Value, String> {
    if let Some(token) = auth_vault::load_active_token() {
        let res = state.set_token(token.clone()).await?;
        discord_gateway::spawn_gateway_session(app, token, (*gw_state).clone());
        Ok(res)
    } else {
        Err("No saved token found".to_string())
    }
}

#[tauri::command]
async fn get_user_presences(gw_state: State<'_, Arc<GatewayState>>) -> Result<Vec<UserPresence>, String> {
    let map = gw_state.presences.read().await;
    Ok(map.values().cloned().collect())
}

#[tauri::command]
async fn get_guilds(state: State<'_, DiscordState>) -> Result<Vec<serde_json::Value>, String> {
    state.get_guilds().await
}

#[tauri::command]
async fn get_dms(state: State<'_, DiscordState>) -> Result<Vec<serde_json::Value>, String> {
    state.get_user_dms().await
}

#[tauri::command]
async fn get_channels(guild_id: String, state: State<'_, DiscordState>) -> Result<Vec<serde_json::Value>, String> {
    state.get_guild_channels(&guild_id).await
}

#[tauri::command]
async fn get_messages(channel_id: String, limit: Option<u32>, state: State<'_, DiscordState>) -> Result<Vec<serde_json::Value>, String> {
    let lim = limit.unwrap_or(50);
    state.get_messages(&channel_id, lim).await
}

#[tauri::command]
async fn send_message(channel_id: String, content: String, state: State<'_, DiscordState>) -> Result<serde_json::Value, String> {
    state.send_message(&channel_id, &content).await
}

#[tauri::command]
async fn send_attachment(
    channel_id: String,
    content: String,
    filename: String,
    base64_data: String,
    state: State<'_, DiscordState>,
) -> Result<serde_json::Value, String> {
    let raw = if let Some(comma_pos) = base64_data.find(',') {
        &base64_data[comma_pos + 1..]
    } else {
        &base64_data
    };
    let bytes = base64::engine::general_purpose::STANDARD.decode(raw).map_err(|e| e.to_string())?;
    state.send_message_attachment(&channel_id, &content, &filename, bytes).await
}

#[tauri::command]
async fn fetch_cdn_proxy(url: String, state: State<'_, DiscordState>) -> Result<String, String> {
    state.fetch_cdn_image(&url).await
}

#[tauri::command]
async fn ring_call(channel_id: String, state: State<'_, DiscordState>) -> Result<bool, String> {
    state.ring_channel(&channel_id).await
}

#[tauri::command]
async fn stop_ring_call(channel_id: String, state: State<'_, DiscordState>) -> Result<bool, String> {
    state.stop_ring_channel(&channel_id).await
}

#[tauri::command]
async fn get_guild_members(
    guild_id: String,
    limit: Option<u32>,
    state: State<'_, DiscordState>,
    gw_state: State<'_, Arc<GatewayState>>,
) -> Result<Vec<serde_json::Value>, String> {
    // 1. Try search endpoint
    if let Ok(members) = state.search_guild_members(&guild_id, "").await {
        if !members.is_empty() {
            let mut gm_lock = gw_state.guild_members.write().await;
            let g_members = gm_lock.entry(guild_id.clone()).or_insert_with(HashMap::new);
            for m in &members {
                if let Some(uid) = m["user"]["id"].as_str() {
                    g_members.insert(uid.to_string(), m.clone());
                }
            }
            return Ok(members);
        }
    }

    // 2. Gateway cached members (from GUILD_CREATE, Opcode 14, Opcode 8)
    {
        let gm_lock = gw_state.guild_members.read().await;
        if let Some(g_members) = gm_lock.get(&guild_id) {
            if !g_members.is_empty() {
                return Ok(g_members.values().cloned().collect());
            }
        }
    }

    // 3. Fallback to standard
    state.get_guild_members(&guild_id, limit).await
}

#[tauri::command]
async fn subscribe_guild_members(
    guild_id: String,
    channel_id: String,
    gw_state: State<'_, Arc<GatewayState>>,
) -> Result<bool, String> {
    let tx_lock = gw_state.cmd_tx.read().await;
    if let Some(tx) = tx_lock.as_ref() {
        let _ = tx.send(discord_gateway::GatewayCommand::SubscribeGuildMembers {
            guild_id,
            channel_id,
        }).await;
    }
    Ok(true)
}

#[tauri::command]
async fn get_guild_emojis(
    guild_id: String,
    state: State<'_, DiscordState>,
    gw_state: State<'_, Arc<GatewayState>>,
) -> Result<Vec<serde_json::Value>, String> {
    {
        let ge_lock = gw_state.guild_emojis.read().await;
        if let Some(list) = ge_lock.get(&guild_id) {
            if !list.is_empty() {
                return Ok(list.clone());
            }
        }
    }
    state.get_guild_emojis(&guild_id).await
}

#[tauri::command]
async fn get_guild_stickers(
    guild_id: String,
    state: State<'_, DiscordState>,
    gw_state: State<'_, Arc<GatewayState>>,
) -> Result<Vec<serde_json::Value>, String> {
    {
        let gs_lock = gw_state.guild_stickers.read().await;
        if let Some(list) = gs_lock.get(&guild_id) {
            if !list.is_empty() {
                return Ok(list.clone());
            }
        }
    }
    state.get_guild_stickers(&guild_id).await
}

#[tauri::command]
async fn get_sticker_packs(
    state: State<'_, DiscordState>,
) -> Result<Vec<serde_json::Value>, String> {
    state.get_sticker_packs().await
}

#[tauri::command]
async fn search_gifs(
    query: String,
    state: State<'_, DiscordState>,
) -> Result<Vec<serde_json::Value>, String> {
    state.search_gifs(&query).await
}

#[tauri::command]
async fn get_guild_roles(
    guild_id: String,
    state: State<'_, DiscordState>,
) -> Result<Vec<serde_json::Value>, String> {
    state.get_guild_roles(&guild_id).await
}

#[tauri::command]
async fn get_relationships(state: State<'_, DiscordState>) -> Result<Vec<serde_json::Value>, String> {
    state.get_relationships().await
}

#[tauri::command]
async fn get_user_profile(user_id: String, state: State<'_, DiscordState>) -> Result<serde_json::Value, String> {
    state.get_user_profile(&user_id).await
}

#[tauri::command]
async fn trigger_typing(channel_id: String, state: State<'_, DiscordState>) -> Result<bool, String> {
    state.trigger_typing(&channel_id).await
}

#[tauri::command]
async fn add_reaction(
    channel_id: String,
    message_id: String,
    emoji: String,
    state: State<'_, DiscordState>,
) -> Result<bool, String> {
    state.add_reaction(&channel_id, &message_id, &emoji).await
}

#[tauri::command]
async fn remove_reaction(
    channel_id: String,
    message_id: String,
    emoji: String,
    state: State<'_, DiscordState>,
) -> Result<bool, String> {
    state.remove_reaction(&channel_id, &message_id, &emoji).await
}

#[tauri::command]
async fn create_dm(recipient_id: String, state: State<'_, DiscordState>) -> Result<serde_json::Value, String> {
    state.create_dm(&recipient_id).await
}

#[tauri::command]
async fn set_voice_state(
    guild_id: Option<String>,
    channel_id: Option<String>,
    self_mute: Option<bool>,
    self_deaf: Option<bool>,
    gw_state: State<'_, Arc<GatewayState>>,
    discord_state: State<'_, DiscordState>,
) -> Result<bool, String> {
    let m = self_mute.unwrap_or(false);
    let d = self_deaf.unwrap_or(false);

    let tx_lock = gw_state.cmd_tx.read().await;
    if let Some(tx) = tx_lock.as_ref() {
        let _ = tx.send(discord_gateway::GatewayCommand::UpdateVoiceState {
            guild_id: guild_id.clone(),
            channel_id: channel_id.clone(),
            self_mute: m,
            self_deaf: d,
        }).await;
    }

    if let Some(gid) = guild_id.as_deref() {
        let _ = discord_state.patch_voice_state(gid, channel_id.as_deref(), m, d).await;
    }

    Ok(true)
}

#[tauri::command]
async fn get_guild_voice_states(
    guild_id: String,
    gw_state: State<'_, Arc<GatewayState>>,
) -> Result<Vec<discord_gateway::VoiceState>, String> {
    let map = gw_state.voice_states.read().await;
    if let Some(guild_map) = map.get(&guild_id) {
        Ok(guild_map.values().cloned().collect())
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
async fn logout(
    state: State<'_, DiscordState>,
    gw_state: State<'_, Arc<GatewayState>>,
) -> Result<(), String> {
    auth_vault::clear_vault();
    let mut token_lock = state.token.write().await;
    *token_lock = None;
    let mut client_lock = state.client.write().await;
    *client_lock = None;

    let mut gw_token = gw_state.active_token.write().await;
    *gw_token = None;
    let mut presences = gw_state.presences.write().await;
    presences.clear();
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let discord_state = DiscordState::new();
    let gateway_state = Arc::new(GatewayState::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(discord_state)
        .manage(gateway_state)
        .setup(|app| {
            let handle = app.handle().clone();
            wallpaper_theme::spawn_theme_watcher(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_theme_palette,
            get_saved_token,
            login,
            auto_login,
            logout,
            get_guilds,
            get_dms,
            get_channels,
            get_messages,
            send_message,
            send_attachment,
            fetch_cdn_proxy,
            ring_call,
            stop_ring_call,
            get_user_presences,
            get_guild_members,
            get_guild_roles,
            get_relationships,
            get_user_profile,
            trigger_typing,
            add_reaction,
            remove_reaction,
            create_dm,
            set_voice_state,
            get_guild_voice_states,
            subscribe_guild_members,
            get_guild_emojis,
            get_guild_stickers,
            get_sticker_packs,
            search_gifs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
