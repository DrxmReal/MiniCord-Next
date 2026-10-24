import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Sparkles, Hash, Volume2 } from "lucide-react";
import { ThemePalette } from "../types";

interface TitleBarProps {
  palette: ThemePalette | null;
  activeGuildName?: string;
  activeChannelName?: string;
  activeChannelType?: number;
}

const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);

export const TitleBar: React.FC<TitleBarProps> = ({
  palette,
  activeGuildName,
  activeChannelName,
  activeChannelType,
}) => {
  const handleMinimize = async () => {
    try {
      if (isTauri) await getCurrentWindow().minimize();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMaximize = async () => {
    try {
      if (isTauri) await getCurrentWindow().toggleMaximize();
    } catch (e) {
      console.error(e);
    }
  };

  const handleClose = async () => {
    try {
      if (isTauri) await getCurrentWindow().close();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <header
      data-tauri-drag-region
      className="h-11 w-full px-3 flex items-center justify-between select-none z-50 shrink-0 border-b border-white/5 bg-[#090a0f]/90"
    >
      {/* Left Capsule: App Identity & Status */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 capsule-pill px-3 py-1 text-xs tracking-wider font-semibold text-slate-300"
      >
        <span
          className="w-2.5 h-2.5 rounded-full animate-pulse"
          style={{ backgroundColor: palette?.hex || "#00d2ff" }}
        />
        <span className="font-bold tracking-widest text-white">MINICORD</span>
        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-white/10 text-white/70">
          NEXT
        </span>
      </div>

      {/* Center Capsule: Active Context (Waybar style) */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 capsule-pill px-4 py-1 text-xs text-slate-300 max-w-[450px] truncate"
      >
        {activeGuildName && (
          <span className="font-medium text-white/80">{activeGuildName}</span>
        )}
        {activeGuildName && activeChannelName && (
          <span className="text-white/30">/</span>
        )}
        {activeChannelName ? (
          <span className="flex items-center gap-1 font-semibold text-white">
            {activeChannelType === 2 ? (
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Hash className="w-3.5 h-3.5 text-slate-400" />
            )}
            {activeChannelName}
          </span>
        ) : (
          <span className="text-white/50">Direct Messages</span>
        )}
      </div>

      {/* Right Capsule: Theme Sync & Window Controls */}
      <div className="flex items-center gap-2">
        <div
          data-tauri-drag-region
          className="flex items-center gap-1.5 capsule-pill px-2.5 py-1 text-[11px] text-white/70"
          title="Synced live with Wallpaper Engine"
        >
          <Sparkles
            className="w-3 h-3"
            style={{ color: palette?.hex || "#00d2ff" }}
          />
          <span className="font-mono">{palette?.hex || "#00d2ff"}</span>
        </div>

        {/* Frameless Window Controls */}
        <div className="flex items-center capsule-pill overflow-hidden p-0.5 border border-white/10">
          <button
            onClick={handleMinimize}
            className="w-7 h-6 flex items-center justify-center rounded-l-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Minimize"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            onClick={handleMaximize}
            className="w-7 h-6 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Maximize"
          >
            <Square className="w-2.5 h-2.5" />
          </button>
          <button
            onClick={handleClose}
            className="w-7 h-6 flex items-center justify-center rounded-r-full text-slate-400 hover:text-red-400 hover:bg-red-500/20 transition-colors"
            title="Close"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
};
