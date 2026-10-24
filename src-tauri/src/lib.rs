mod client_identity;
mod auth_vault;
mod wallpaper_theme;
mod discord_http;
mod discord_gateway;

use std::sync::Arc;
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
            get_user_presences
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
