use std::path::Path;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Debug, Serialize)]
pub struct ThemePalette {
    pub hex: String,
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub accent_hover: String,
    pub accent_glow: String,
    pub accent_dim: String,
}

pub fn rgb_to_hex(r: u8, g: u8, b: u8) -> String {
    format!("#{:02x}{:02x}{:02x}", r, g, b)
}

pub fn make_palette(r: u8, g: u8, b: u8) -> ThemePalette {
    let hex = rgb_to_hex(r, g, b);
    let r_hover = ((r as f32 * 1.25).min(255.0)) as u8;
    let g_hover = ((g as f32 * 1.25).min(255.0)) as u8;
    let b_hover = ((b as f32 * 1.25).min(255.0)) as u8;
    let accent_hover = rgb_to_hex(r_hover, g_hover, b_hover);

    let accent_glow = format!("rgba({}, {}, {}, 0.35)", r, g, b);
    let accent_dim = format!("rgba({}, {}, {}, 0.15)", r, g, b);

    ThemePalette {
        hex,
        r,
        g,
        b,
        accent_hover,
        accent_glow,
        accent_dim,
    }
}

pub fn get_wallpaper_engine_color() -> Option<(u8, u8, u8)> {
    let candidates = [
        r"E:\SteamLibrary\steamapps\common\wallpaper_engine\config.json",
        r"C:\Program Files (x86)\Steam\steamapps\common\wallpaper_engine\config.json",
        r"C:\SteamLibrary\steamapps\common\wallpaper_engine\config.json",
        r"D:\SteamLibrary\steamapps\common\wallpaper_engine\config.json",
    ];

    for cfg_path in candidates {
        let p = Path::new(cfg_path);
        if p.exists() {
            if let Ok(content) = std::fs::read_to_string(p) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(admin) = v.get("Admin") {
                        if let Some(selected) = admin
                            .get("general")
                            .and_then(|g| g.get("wallpaperconfig"))
                            .and_then(|wc| wc.get("selectedwallpapers"))
                            .and_then(|sw| sw.as_object())
                        {
                            for (_mon, item) in selected {
                                if let Some(file_str) = item.get("file").and_then(|f| f.as_str()) {
                                    let wp_path = Path::new(file_str);
                                    let parent_dir = if wp_path.is_file() {
                                        wp_path.parent()
                                    } else {
                                        Some(wp_path)
                                    };
                                    if let Some(dir) = parent_dir {
                                        let project_json = dir.join("project.json");
                                        if project_json.exists() {
                                            if let Ok(pj_content) = std::fs::read_to_string(&project_json) {
                                                if let Ok(pj_v) = serde_json::from_str::<serde_json::Value>(&pj_content) {
                                                    if let Some(sc_val) = pj_v
                                                        .get("general")
                                                        .and_then(|g| g.get("properties"))
                                                        .and_then(|props| props.get("schemecolor"))
                                                        .and_then(|sc| sc.get("value"))
                                                        .and_then(|v| v.as_str())
                                                    {
                                                        let parts: Vec<f32> = sc_val
                                                            .split_whitespace()
                                                            .filter_map(|s| s.parse::<f32>().ok())
                                                            .collect();
                                                        if parts.len() >= 3 {
                                                            let r = (parts[0] * 255.0).clamp(0.0, 255.0) as u8;
                                                            let g = (parts[1] * 255.0).clamp(0.0, 255.0) as u8;
                                                            let b = (parts[2] * 255.0).clamp(0.0, 255.0) as u8;
                                                            return Some((r, g, b));
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

pub fn get_dwm_color() -> Option<(u8, u8, u8)> {
    #[cfg(target_os = "windows")]
    {
        // Read HKCU\Software\Microsoft\Windows\DWM\ColorizationColor via powershell or registry query if needed
        // Default modern cyan accent if not reachable:
        Some((0, 180, 216))
    }
    #[cfg(not(target_os = "windows"))]
    None
}

pub fn get_active_theme() -> ThemePalette {
    if let Some((r, g, b)) = get_wallpaper_engine_color() {
        make_palette(r, g, b)
    } else if let Some((r, g, b)) = get_dwm_color() {
        make_palette(r, g, b)
    } else {
        // Default clean cyan/teal Rice accent
        make_palette(6, 182, 212)
    }
}

pub fn spawn_theme_watcher(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut last_color = get_wallpaper_engine_color();
        loop {
            tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;
            let current = get_wallpaper_engine_color();
            if current != last_color && current.is_some() {
                last_color = current;
                if let Some((r, g, b)) = current {
                    let palette = make_palette(r, g, b);
                    let _ = app.emit("wallpaper-theme-update", palette);
                }
            }
        }
    });
}
