use base64::Engine;

#[cfg(target_os = "windows")]
#[repr(C)]
#[allow(non_snake_case)]
struct DATA_BLOB {
    cbData: u32,
    pbData: *mut u8,
}

#[cfg(target_os = "windows")]
#[link(name = "crypt32")]
extern "system" {
    fn CryptProtectData(
        pDataIn: *const DATA_BLOB,
        szDataDescr: *const u16,
        pOptionalEntropy: *const DATA_BLOB,
        pvReserved: *mut std::ffi::c_void,
        pPromptStruct: *mut std::ffi::c_void,
        dwFlags: u32,
        pDataOut: *mut DATA_BLOB,
    ) -> i32;

    fn CryptUnprotectData(
        pDataIn: *const DATA_BLOB,
        ppszDataDescr: *mut *mut u16,
        pOptionalEntropy: *const DATA_BLOB,
        pvReserved: *mut std::ffi::c_void,
        pPromptStruct: *mut std::ffi::c_void,
        dwFlags: u32,
        pDataOut: *mut DATA_BLOB,
    ) -> i32;
}

#[cfg(target_os = "windows")]
#[link(name = "kernel32")]
extern "system" {
    fn LocalFree(hMem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
}

#[cfg(target_os = "windows")]
pub fn dpapi_unprotect(data: &[u8]) -> Option<Vec<u8>> {
    let mut in_blob = DATA_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut out_blob = DATA_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    let res = unsafe {
        CryptUnprotectData(
            &mut in_blob,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            0,
            &mut out_blob,
        )
    };

    if res != 0 && !out_blob.pbData.is_null() {
        let slice = unsafe { std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize) };
        let result = slice.to_vec();
        unsafe {
            std::ptr::write_bytes(out_blob.pbData, 0, out_blob.cbData as usize);
            LocalFree(out_blob.pbData as _);
        };
        Some(result)
    } else {
        None
    }
}

#[cfg(target_os = "windows")]
pub fn dpapi_protect(data: &[u8]) -> Option<Vec<u8>> {
    let mut in_blob = DATA_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut out_blob = DATA_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };

    let res = unsafe {
        CryptProtectData(
            &mut in_blob,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            0,
            &mut out_blob,
        )
    };

    if res != 0 && !out_blob.pbData.is_null() {
        let slice = unsafe { std::slice::from_raw_parts(out_blob.pbData, out_blob.cbData as usize) };
        let result = slice.to_vec();
        unsafe {
            std::ptr::write_bytes(out_blob.pbData, 0, out_blob.cbData as usize);
            LocalFree(out_blob.pbData as _);
        };
        Some(result)
    } else {
        None
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default)]
pub struct SavedAccount {
    pub token: String,
    pub user_id: String,
    pub username: String,
    pub tag: String,
    pub avatar_initials: String,
    pub is_active: bool,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug, Default)]
pub struct AccountVault {
    pub accounts: Vec<SavedAccount>,
}

fn get_vault_path() -> std::path::PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        let dir = std::path::PathBuf::from(appdata).join("MiniCord");
        let _ = std::fs::create_dir_all(&dir);
        return dir.join("session.vault");
    }
    std::path::PathBuf::from(".minicord_token")
}

pub fn load_active_token() -> Option<String> {
    let path = get_vault_path();
    if !path.exists() {
        // Try fallback in working directory or minicord directory
        let fallback = std::path::PathBuf::from("c:/Users/Admin/Documents/MiniCord/.minicord_token");
        if fallback.exists() {
            if let Ok(s) = std::fs::read_to_string(fallback) {
                let clean = s.trim().to_string();
                if !clean.is_empty() {
                    return Some(clean);
                }
            }
        }
        return None;
    }

    let raw = std::fs::read_to_string(&path).ok()?;
    let trimmed = raw.trim();

    #[cfg(target_os = "windows")]
    let content = if let Some(rest) = trimmed.strip_prefix("DPAPI:") {
        if let Ok(enc_bytes) = base64::engine::general_purpose::STANDARD.decode(rest) {
            if let Some(dec_bytes) = dpapi_unprotect(&enc_bytes) {
                String::from_utf8(dec_bytes).unwrap_or_else(|_| trimmed.to_string())
            } else {
                trimmed.to_string()
            }
        } else {
            trimmed.to_string()
        }
    } else {
        trimmed.to_string()
    };

    #[cfg(not(target_os = "windows"))]
    let content = trimmed.to_string();

    if let Ok(vault) = serde_json::from_str::<AccountVault>(&content) {
        if let Some(active) = vault.accounts.iter().find(|a| a.is_active) {
            return Some(active.token.clone());
        }
        if let Some(first) = vault.accounts.first() {
            return Some(first.token.clone());
        }
    }

    let clean: String = content.chars().filter(|c| !c.is_whitespace() && *c != '"' && *c != '\'').collect();
    if !clean.is_empty() {
        Some(clean)
    } else {
        None
    }
}

pub fn save_token_to_vault(token: &str) -> Result<(), String> {
    let clean: String = token.chars().filter(|c| !c.is_whitespace() && *c != '"' && *c != '\'').collect();
    let vault = AccountVault {
        accounts: vec![SavedAccount {
            token: clean,
            user_id: String::new(),
            username: "Active User".to_string(),
            tag: "User".to_string(),
            avatar_initials: "U".to_string(),
            is_active: true,
        }],
    };

    let serialized = serde_json::to_string(&vault).map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let payload = if let Some(enc) = dpapi_protect(serialized.as_bytes()) {
        format!("DPAPI:{}", base64::engine::general_purpose::STANDARD.encode(&enc))
    } else {
        serialized
    };

    #[cfg(not(target_os = "windows"))]
    let payload = serialized;

    let path = get_vault_path();
    std::fs::write(path, payload).map_err(|e| e.to_string())
}

pub fn clear_vault() {
    let path = get_vault_path();
    let _ = std::fs::remove_file(path);
    let fallback = std::path::PathBuf::from("c:/Users/Admin/Documents/MiniCord/.minicord_token");
    let _ = std::fs::remove_file(fallback);
}
