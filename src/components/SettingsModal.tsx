import React, { useState } from "react";
import {
  Type,
  Palette,
  Volume2,
  User,
  X,
  LogOut,
  Sparkles,
  Sliders,
  Check,
} from "lucide-react";
import { AppSettings, DiscordUser, ThemePalette } from "../types";

interface SettingsModalProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  currentUser: DiscordUser | null;
  palette: ThemePalette | null;
  onLogout: () => void;
  onClose: () => void;
}

const FONT_OPTIONS = [
  { name: "System Default", value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { name: "Inter", value: "'Inter', sans-serif" },
  { name: "JetBrains Mono (Rice / Hacker)", value: "'JetBrains Mono', monospace" },
  { name: "Fira Code", value: "'Fira Code', monospace" },
  { name: "Roboto", value: "'Roboto', sans-serif" },
  { name: "Poppins", value: "'Poppins', sans-serif" },
  { name: "Consolas", value: "'Consolas', monospace" },
];

const PRESET_ACCENTS = [
  { name: "Wallpaper Engine (Auto)", hex: "auto" },
  { name: "Cyber Cyan", hex: "#00d2ff" },
  { name: "Neon Emerald", hex: "#10b981" },
  { name: "Crimson Red", hex: "#ef4444" },
  { name: "Vapor Purple", hex: "#a855f7" },
  { name: "Sunset Amber", hex: "#f59e0b" },
  { name: "Hot Pink", hex: "#ec4899" },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  currentUser,
  palette,
  onLogout,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<"font" | "theme" | "audio" | "account">("font");

  const update = (partial: Partial<AppSettings>) => {
    onUpdateSettings({ ...settings, ...partial });
  };

  const userAvatarUrl = currentUser?.avatar
    ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=128`
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-2xl h-[560px] glass-card rounded-3xl border border-white/10 shadow-2xl flex overflow-hidden bg-[#0c0e17]/95">
        {/* Left Settings Navigation Sidebar */}
        <div className="w-52 h-full bg-white/[0.02] border-r border-white/5 p-4 flex flex-col justify-between shrink-0">
          <div className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-3 mb-2">
              User Settings
            </div>

            <button
              onClick={() => setActiveTab("font")}
              className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "font"
                  ? "bg-[var(--accent)] text-black"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Type className="w-4 h-4" />
              <span>Font & Appearance</span>
            </button>

            <button
              onClick={() => setActiveTab("theme")}
              className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "theme"
                  ? "bg-[var(--accent)] text-black"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Wallpaper & Theme</span>
            </button>

            <button
              onClick={() => setActiveTab("audio")}
              className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "audio"
                  ? "bg-[var(--accent)] text-black"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>Voice & Audio</span>
            </button>

            <button
              onClick={() => setActiveTab("account")}
              className={`w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "account"
                  ? "bg-[var(--accent)] text-black"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <User className="w-4 h-4" />
              <span>My Account</span>
            </button>
          </div>

          {/* Logout button at bottom of sidebar */}
          <button
            onClick={onLogout}
            className="w-full px-3 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>

        {/* Right Settings Content Area */}
        <div className="flex-1 h-full flex flex-col overflow-hidden">
          {/* Top Bar with Close button */}
          <div className="h-12 px-6 flex items-center justify-between border-b border-white/5 shrink-0">
            <span className="font-bold text-sm text-white">
              {activeTab === "font" && "Typography & Font Settings"}
              {activeTab === "theme" && "Theme & Desktop Rice Settings"}
              {activeTab === "audio" && "Voice & Call Audio Settings"}
              {activeTab === "account" && "Discord Account Details"}
            </span>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Tab Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* ================= FONT TAB ================= */}
            {activeTab === "font" && (
              <div className="space-y-6">
                {/* Font Family */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/50 block mb-2">
                    Client Font Family
                  </label>
                  <div className="grid grid-cols-1 gap-1.5">
                    {FONT_OPTIONS.map((f) => (
                      <button
                        key={f.name}
                        onClick={() => update({ fontFamily: f.value })}
                        className={`w-full px-3.5 py-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                          settings.fontFamily === f.value
                            ? "bg-[var(--accent-dim)] border-[var(--accent)] text-white"
                            : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                        style={{ fontFamily: f.value }}
                      >
                        <span className="text-sm font-medium">{f.name}</span>
                        {settings.fontFamily === f.value && (
                          <Check className="w-4 h-4 text-[var(--accent)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/50">
                      Font Size
                    </label>
                    <span className="text-xs font-mono text-[var(--accent)] font-bold">
                      {settings.fontSize}px
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[12, 14, 16, 18].map((size) => (
                      <button
                        key={size}
                        onClick={() => update({ fontSize: size })}
                        className={`py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          settings.fontSize === size
                            ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                            : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        {size === 12 && "Compact (12px)"}
                        {size === 14 && "Normal (14px)"}
                        {size === 16 && "Medium (16px)"}
                        {size === 18 && "Large (18px)"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Spacing */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/50 block mb-2">
                    Chat Message Spacing
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => update({ spacing: "cozy" })}
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        settings.spacing === "cozy"
                          ? "bg-[var(--accent-dim)] border-[var(--accent)] text-white"
                          : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <Sliders className="w-4 h-4" />
                      <div>
                        <div className="font-bold">Cozy</div>
                        <div className="text-[10px] text-white/40">Modern Discord style with full avatars</div>
                      </div>
                    </button>
                    <button
                      onClick={() => update({ spacing: "compact" })}
                      className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                        settings.spacing === "compact"
                          ? "bg-[var(--accent-dim)] border-[var(--accent)] text-white"
                          : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      <Sliders className="w-4 h-4" />
                      <div>
                        <div className="font-bold">Compact</div>
                        <div className="text-[10px] text-white/40">Tight spacing, maximum messages on screen</div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= THEME TAB ================= */}
            {activeTab === "theme" && (
              <div className="space-y-6">
                {/* Wallpaper Engine Sync */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[var(--accent)]" />
                      <span>Wallpaper Engine Auto-Sync</span>
                    </div>
                    <div className="text-xs text-white/50 mt-0.5">
                      Continuously track wallpaper colors from project.json
                    </div>
                  </div>
                  <button
                    onClick={() => update({ wallpaperSync: !settings.wallpaperSync })}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      settings.wallpaperSync ? "bg-[var(--accent)]" : "bg-white/20"
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-black transition-transform ${
                        settings.wallpaperSync ? "translate-x-6" : ""
                      }`}
                    />
                  </button>
                </div>

                {/* Accent Color Swatches */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/50 block mb-2">
                    Accent Color Palette
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PRESET_ACCENTS.map((item) => {
                      const isAuto = item.hex === "auto";
                      const isSelected = isAuto
                        ? settings.wallpaperSync
                        : !settings.wallpaperSync && settings.customAccent === item.hex;

                      return (
                        <button
                          key={item.name}
                          onClick={() => {
                            if (isAuto) {
                              update({ wallpaperSync: true });
                            } else {
                              update({ wallpaperSync: false, customAccent: item.hex });
                            }
                          }}
                          className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all cursor-pointer ${
                            isSelected
                              ? "bg-white/10 border-[var(--accent)]"
                              : "bg-white/5 border-white/5 hover:bg-white/10"
                          }`}
                        >
                          <span
                            className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                            style={{
                              backgroundColor: isAuto
                                ? palette?.hex || "#00d2ff"
                                : item.hex,
                            }}
                          />
                          <span className="text-xs font-medium text-white truncate">
                            {item.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Glass Blur Intensity */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/50 block mb-2">
                    Backdrop Blur Effect
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["low", "medium", "ultra"] as const).map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => update({ blurIntensity: lvl })}
                        className={`py-2 rounded-xl border text-xs font-semibold capitalize transition-all cursor-pointer ${
                          settings.blurIntensity === lvl
                            ? "bg-[var(--accent)] text-black border-[var(--accent)]"
                            : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                        }`}
                      >
                        {lvl} Blur
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ================= AUDIO TAB ================= */}
            {activeTab === "audio" && (
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-white/50 block mb-2">
                    Voice & Call Settings
                  </label>
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <span className="text-xs text-white">Input Microphone Sensitivity</span>
                      <span className="text-xs text-[var(--accent)] font-mono">Automatic</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <span className="text-xs text-white">Echo Cancellation & Noise Reduction</span>
                      <span className="text-xs text-emerald-400 font-semibold">Active</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <span className="text-xs text-white">Opus High-Fidelity Voice</span>
                      <span className="text-xs text-[var(--accent)] font-semibold">Enabled (48kHz)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= ACCOUNT TAB ================= */}
            {activeTab === "account" && (
              <div className="space-y-6">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-full overflow-hidden bg-white/10 shrink-0">
                    {userAvatarUrl ? (
                      <img src={userAvatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-lg text-white">
                        {currentUser?.username?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-base font-bold text-white">
                      {currentUser?.global_name || currentUser?.username || "Discord User"}
                    </div>
                    <div className="text-xs text-white/50 font-mono">
                      @{currentUser?.username || "user"}
                    </div>
                    <div className="text-[10px] text-white/30 font-mono mt-1">
                      ID: {currentUser?.id || "N/A"}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                  Connected via DPAPI Encrypted Vault. Token never touches third-party servers.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
