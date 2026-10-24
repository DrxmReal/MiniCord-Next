<div align="center">

# ⚡ MiniCord Next

**Ultra-fast, resource-efficient Discord client built with Tauri v2, Rust & React.**  
*Live Wallpaper Engine dynamic theming · Native Discord Gateway WebSocket · Inline Video Player · DPAPI Vault*

[![Release](https://img.shields.io/github/v/release/DrxmReal/MiniCord-Next?color=00d2ff&style=for-the-badge)](https://github.com/DrxmReal/MiniCord-Next/releases)
[![Rust](https://img.shields.io/badge/Rust-2021_Edition-orange?style=for-the-badge&logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri_v2-2.12+-24C8DB?style=for-the-badge&logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React_19-Vite_8-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge)](LICENSE)

</div>

---

## 🌟 Highlights

- 🎨 **Dynamic Wallpaper Engine Synchronization**: Polls and binds active Windows accent colors / Wallpaper Engine themes in real time via low-level Win32 DWM API hooks.
- 🚀 **Extreme Resource Efficiency**: Built natively on Rust and WebView2. Consumes only **~75–120 MB RAM** (vs 800 MB–1.5 GB on official Discord Electron bloat).
- 📡 **Native Discord Gateway v10 WebSocket**: Integrated Rust async gateway engine (`tokio-tungstenite`) providing live presence monitoring (**Online**, **Idle**, **DND**, **Offline**), rich activity detection (*Playing ...*), and sub-millisecond instant message dispatch.
- 🎬 **Inline Video & Media Player**: Plays uploaded `.mp4`, `.webm`, and `.mov` media directly inside the chat feed with native controls and volume scrubber.
- 💬 **Full Discord Markdown & Embeds**:
  - Headings (`#`, `##`, `###`), blockquotes (`>`), and bullet lists (`-`).
  - Discord Custom Emojis (`<:name:id>` / `<a:name:id>`) rendered directly from Discord CDN.
  - Interactive Spoilers (`||spoiler||`) with click-to-reveal.
  - Channel (`#channel`), Role (`@role`), User (`@user`), and `@everyone` pills.
  - Rich Bot Embed Cards with colored accent bars, thumbnail cards, and full-resolution lightbox viewer.
- 🔤 **Custom Typography & Fonts**: Switch on the fly between **JetBrains Mono**, **Fira Code**, **Inter**, **Roboto**, **Poppins**, and **Consolas** with custom scaling (12px–18px) and Cozy vs. Compact message density.
- 🖱️ **Power-User Ergonomics**:
  - **Drag-and-Drop Server Rail**: Reorder server icons freely with live neon indicator lines and persistent local caching.
  - **Glassmorphic Context Menu**: Custom right-click menu for messages, DMs, and servers.
  - **Voice & Video Call Triggers**: Native ring channel dispatch directly from channel headers.
- 🔒 **DPAPI Vault Protection**: Windows Data Protection API (CryptProtectData / CryptUnprotectData) hardware-backed encryption for user session tokens. No plaintext tokens stored on disk.

---

## 📸 Screenshots & Architecture

```
MiniCord Next
├── src-tauri/
│   ├── src/
│   │   ├── auth_vault.rs       # DPAPI credential protection & vault management
│   │   ├── client_identity.rs  # Super-properties & Discord client fingerprinting
│   │   ├── discord_gateway.rs  # Async WebSocket connection (v10 Gateway + Presences)
│   │   ├── discord_http.rs     # HTTP REST API client (channels, DMs, guilds, ringing)
│   │   ├── wallpaper_theme.rs  # Win32 DWM theme monitoring & dynamic palette generator
│   │   ├── lib.rs              # Tauri command handlers & runtime configuration
│   │   └── main.rs             # Application entrypoint
├── src/
│   ├── components/
│   │   ├── ChannelSidebar.tsx  # Server channels & recent chats with presence badges
│   │   ├── ChatArea.tsx        # Chat feed, inline video player & message dispatch
│   │   ├── ContextMenu.tsx     # Custom glassmorphic right-click menu
│   │   ├── EmbedCard.tsx       # Markdown parser & rich Discord embed renderer
│   │   ├── EmojiGifPicker.tsx  # Categorized emoji, GIF & reaction sticker picker
│   │   ├── GuildRail.tsx       # Drag-and-drop server rail
│   │   ├── SettingsModal.tsx   # Typography, theme and account preferences
│   │   ├── StatusBadge.tsx     # Discord presence indicator (Online/Idle/DND/Offline)
│   │   └── TitleBar.tsx        # Waybar / Yasb capsule titlebar with window controls
│   ├── types.ts                # TypeScript schemas for Discord API payloads
│   └── App.tsx                 # Core UI conductor
```

---

## 🛠️ Building from Source

### Prerequisites

1. **Rust Toolchain**: Install [Rust & Cargo](https://rustup.rs/) (edition 2021).
2. **Bun** (or Node.js 18+): Install [Bun](https://bun.sh/).
3. **C++ Build Tools**: Visual Studio C++ Build Tools with Windows 10/11 SDK.

### Quick Start

```bash
# Clone the repository
git clone https://github.com/DrxmReal/MiniCord-Next.git
cd MiniCord-Next

# Install frontend dependencies
bun install

# Run development server (Live reload + Rust debug)
bun run tauri dev

# Compile standalone release executable (no bundling required)
bun run tauri build --no-bundle
```

The resulting standalone executable `minicord-next.exe` (~6.4 MB) will be generated at:
```
target/release/minicord-next.exe
```

---

## 📦 Releases

Pre-compiled standalone binaries for Windows 10 & 11 are available on the [Releases page](https://github.com/DrxmReal/MiniCord-Next/releases).

---

## ⚖️ License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
Created with passion by **[Dr4m (DrxmReal)](https://github.com/DrxmReal)**.
