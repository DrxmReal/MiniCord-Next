use base64::Engine;
use serde_json::{json, Value};

const CHROME_VERSION: &str = "127.0.0.0";
const CLIENT_BUILD_NUMBER: u32 = 320000;

#[cfg(target_os = "windows")]
const OS_NAME: &str = "Windows";
#[cfg(target_os = "windows")]
const OS_VERSION: &str = "10";
#[cfg(target_os = "windows")]
const UA_PLATFORM: &str = "Windows NT 10.0; Win64; x64";

#[cfg(not(target_os = "windows"))]
const OS_NAME: &str = "Linux";
#[cfg(not(target_os = "windows"))]
const OS_VERSION: &str = "";
#[cfg(not(target_os = "windows"))]
const UA_PLATFORM: &str = "X11; Linux x86_64";

pub fn user_agent() -> String {
    format!(
        "Mozilla/5.0 ({}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{} Safari/537.36",
        UA_PLATFORM, CHROME_VERSION
    )
}

pub fn properties() -> Value {
    json!({
        "os": OS_NAME,
        "browser": "Chrome",
        "device": "",
        "system_locale": "en-US",
        "browser_user_agent": user_agent(),
        "browser_version": CHROME_VERSION,
        "os_version": OS_VERSION,
        "referrer": "",
        "referring_domain": "",
        "referrer_current": "",
        "referring_domain_current": "",
        "release_channel": "stable",
        "client_build_number": CLIENT_BUILD_NUMBER,
        "client_event_source": Value::Null,
        "design_id": 0
    })
}

pub fn super_properties_header() -> String {
    let serialized = serde_json::to_string(&properties()).unwrap_or_default();
    base64::engine::general_purpose::STANDARD.encode(serialized.as_bytes())
}
