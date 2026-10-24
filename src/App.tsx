import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TitleBar } from "./components/TitleBar";
import { GuildRail } from "./components/GuildRail";
import { ChannelSidebar } from "./components/ChannelSidebar";
import { ChatArea } from "./components/ChatArea";
import { LoginModal } from "./components/LoginModal";
import { SettingsModal } from "./components/SettingsModal";
import {
  ThemePalette,
  DiscordUser,
  DiscordGuild,
  DiscordChannel,
  DiscordDMChannel,
  DiscordMessage,
  AppSettings,
  UserPresence,
} from "./types";
import "./App.css";

// Check if running in Tauri environment
const isTauri = typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);

const DEFAULT_SETTINGS: AppSettings = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSize: 14,
  spacing: "cozy",
  wallpaperSync: true,
  customAccent: "#00d2ff",
  blurIntensity: "medium",
};

function compareSnowflakesDesc(a?: string | null, b?: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  try {
    const bigA = BigInt(a);
    const bigB = BigInt(b);
    if (bigA > bigB) return -1;
    if (bigA < bigB) return 1;
    return 0;
  } catch {
    return b.localeCompare(a, undefined, { numeric: true });
  }
}

export default function App() {
  const [palette, setPalette] = useState<ThemePalette | null>(null);
  const [currentUser, setCurrentUser] = useState<DiscordUser | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [activeGuild, setActiveGuild] = useState<DiscordGuild | null>(null);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [dms, setDms] = useState<DiscordDMChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<DiscordChannel | null>(null);
  const [messages, setMessages] = useState<DiscordMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [presences, setPresences] = useState<Record<string, UserPresence>>({});

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem("minicord_settings");
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) {
      console.error("Failed to read minicord_settings:", e);
    }
    return DEFAULT_SETTINGS;
  });

  const activeChannelRef = useRef<DiscordChannel | null>(null);
  activeChannelRef.current = activeChannel;
  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;

  const applyAccentColor = (hex: string) => {
    const root = document.documentElement;
    root.style.setProperty("--accent", hex);
    root.style.setProperty("--accent-hover", hex);
    root.style.setProperty("--accent-glow", `${hex}59`);
    root.style.setProperty("--accent-dim", `${hex}1f`);
  };

  // Apply theme palette to root CSS variables
  const applyTheme = (theme: ThemePalette) => {
    setPalette(theme);
    if (!settingsRef.current.wallpaperSync && settingsRef.current.customAccent && settingsRef.current.customAccent !== "auto") {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty("--accent", theme.hex);
    root.style.setProperty("--accent-hover", theme.accent_hover);
    root.style.setProperty("--accent-glow", theme.accent_glow);
    root.style.setProperty("--accent-dim", theme.accent_dim);
  };

  // Font and Accent styling effect
  useEffect(() => {
    document.body.style.fontFamily = settings.fontFamily;
    if (!settings.wallpaperSync && settings.customAccent && settings.customAccent !== "auto") {
      applyAccentColor(settings.customAccent);
    } else if (settings.wallpaperSync && palette) {
      applyTheme(palette);
    }
  }, [settings.fontFamily, settings.wallpaperSync, settings.customAccent]);

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem("minicord_settings", JSON.stringify(newSettings));
    } catch (e) {
      console.error("Failed to save settings:", e);
    }
  };

  const handleLogout = async () => {
    if (isTauri) {
      try {
        await invoke("logout");
      } catch (err) {
        console.error("Logout error:", err);
      }
    }
    setCurrentUser(null);
    setGuilds([]);
    setChannels([]);
    setDms([]);
    setActiveGuild(null);
    setActiveChannel(null);
    setMessages([]);
    setIsSettingsOpen(false);
  };

  useEffect(() => {
    if (!isTauri) {
      applyTheme({
        hex: "#00d2ff",
        r: 0,
        g: 210,
        b: 255,
        accent_hover: "#38bdf8",
        accent_glow: "rgba(0, 210, 255, 0.35)",
        accent_dim: "rgba(0, 210, 255, 0.12)",
      });
      return;
    }

    // 1. Fetch initial theme from Wallpaper Engine / DWM
    invoke<ThemePalette>("get_theme_palette")
      .then((initialTheme) => {
        applyTheme(initialTheme);
      })
      .catch((e) => console.error("Theme fetch error:", e));

    // 2. Listen to live Wallpaper Engine theme changes from Rust
    const unlistenPromise = listen<ThemePalette>("wallpaper-theme-update", (event) => {
      applyTheme(event.payload);
    });

    // 3. Listen to Gateway Presences Sync (initial bulk presences)
    const unlistenPresences = listen<UserPresence[]>("gateway-presences-sync", (event) => {
      const map: Record<string, UserPresence> = {};
      for (const p of event.payload) {
        map[p.user_id] = p;
      }
      setPresences((prev) => ({ ...prev, ...map }));
    });

    // 4. Listen to Live Gateway Presence Updates
    const unlistenPresenceUpdate = listen<UserPresence>("gateway-presence-update", (event) => {
      const p = event.payload;
      setPresences((prev) => ({
        ...prev,
        [p.user_id]: p,
      }));
    });

    // 5. Listen to Real-time Gateway Messages
    const unlistenMsgCreate = listen<any>("gateway-message-create", (event) => {
      const msg = event.payload;
      const ch = activeChannelRef.current;
      if (ch && msg.channel_id === ch.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      // If DM, bump DM list
      setDms((prevDms) => {
        if (!prevDms.some((d) => d.id === msg.channel_id)) return prevDms;
        const updated = prevDms.map((d) =>
          d.id === msg.channel_id ? { ...d, last_message_id: msg.id } : d
        );
        return updated.sort((a, b) => {
          const timeA = a.last_message_id || a.id;
          const timeB = b.last_message_id || b.id;
          return compareSnowflakesDesc(timeA, timeB);
        });
      });
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
      unlistenPresences.then((unlisten) => unlisten());
      unlistenPresenceUpdate.then((unlisten) => unlisten());
      unlistenMsgCreate.then((unlisten) => unlisten());
    };
  }, []);

  // Fetch and sort DMs by recent message
  const loadDMs = async () => {
    if (!isTauri) return;
    try {
      const userDms = await invoke<DiscordDMChannel[]>("get_dms");
      const sorted = [...userDms].sort((a, b) => {
        const timeA = a.last_message_id || a.id;
        const timeB = b.last_message_id || b.id;
        return compareSnowflakesDesc(timeA, timeB);
      });
      setDms(sorted);

      // Auto-select the most recent active conversation if no channel is active
      if (sorted.length > 0 && !activeChannelRef.current) {
        const first = sorted[0];
        const recipient = first.recipients?.[0];
        const displayName =
          first.type === 3
            ? first.name || "Group Chat"
            : recipient?.global_name || recipient?.username || "Direct Message";

        handleSelectChannel({
          id: first.id,
          name: displayName,
          type: first.type,
          recipient: recipient || null,
        });
      }
    } catch (err) {
      console.error("Failed to load DMs:", err);
    }
  };

  // When logged in, fetch user's guilds and DMs
  const handleLoginSuccess = async (user: DiscordUser) => {
    setCurrentUser(user);
    if (!isTauri) return;

    try {
      const userGuilds = await invoke<DiscordGuild[]>("get_guilds");
      setGuilds(userGuilds);
      await loadDMs();

      try {
        const initialPresences = await invoke<UserPresence[]>("get_user_presences");
        const map: Record<string, UserPresence> = {};
        for (const p of initialPresences) {
          map[p.user_id] = p;
        }
        setPresences(map);
      } catch {}
    } catch (err) {
      console.error("Failed to load initial discord data:", err);
    }
  };

  // Select guild and fetch its channels, or null for DMs
  const handleSelectGuild = async (guild: DiscordGuild | null) => {
    setActiveGuild(guild);
    setChannels([]);
    setActiveChannel(null);
    setMessages([]);

    if (guild && isTauri) {
      try {
        const guildChannels = await invoke<DiscordChannel[]>("get_channels", {
          guildId: guild.id,
        });
        setChannels(guildChannels);

        // Find the first text/announcement channel (type 0 or 5) by lowest position
        const textChannels = guildChannels
          .filter((c) => c.type === 0 || c.type === 5)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

        if (textChannels.length > 0) {
          handleSelectChannel(textChannels[0]);
        }
      } catch (err) {
        console.error("Failed to load guild channels:", err);
      }
    } else if (!guild && isTauri) {
      await loadDMs();
    }
  };

  // Select channel and load messages
  const handleSelectChannel = async (channel: DiscordChannel) => {
    setActiveChannel(channel);
    setIsLoadingMessages(true);
    if (!isTauri) {
      setIsLoadingMessages(false);
      return;
    }

    try {
      const msgs = await invoke<DiscordMessage[]>("get_messages", {
        channelId: channel.id,
        limit: 50,
      });
      setMessages(msgs.reverse());
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Send text message or with attachment
  const handleSendMessage = async (
    content: string,
    attachment?: { name: string; dataUrl: string }
  ) => {
    if (!activeChannel || !isTauri) return;

    let newMsg: DiscordMessage;
    if (attachment) {
      newMsg = await invoke<DiscordMessage>("send_attachment", {
        channelId: activeChannel.id,
        content,
        filename: attachment.name,
        base64Data: attachment.dataUrl,
      });
    } else {
      newMsg = await invoke<DiscordMessage>("send_message", {
        channelId: activeChannel.id,
        content,
      });
    }
    setMessages((prev) => [...prev, newMsg]);

    // If in DM, bump this conversation to the top
    if (activeChannel.type === 1 || activeChannel.type === 3) {
      setDms((prev) => {
        const updated = prev.map((d) =>
          d.id === activeChannel.id ? { ...d, last_message_id: newMsg.id } : d
        );
        return updated.sort((a, b) => {
          const timeA = a.last_message_id || a.id;
          const timeB = b.last_message_id || b.id;
          return compareSnowflakesDesc(timeA, timeB);
        });
      });
    }
  };

  // Auto-refresh messages for active channel every 3.5 seconds
  useEffect(() => {
    if (!isTauri) return;

    const timer = setInterval(async () => {
      const ch = activeChannelRef.current;
      if (ch) {
        try {
          const latest = await invoke<DiscordMessage[]>("get_messages", {
            channelId: ch.id,
            limit: 25,
          });
          const reversed = latest.reverse();
          if (reversed.length > 0) {
            setMessages((prev) => {
              if (
                prev.length === 0 ||
                reversed[reversed.length - 1].id !== prev[prev.length - 1]?.id
              ) {
                // If new message in DM, bump DM list
                if (ch.type === 1 || ch.type === 3) {
                  const lastId = reversed[reversed.length - 1].id;
                  setDms((prevDms) => {
                    const updated = prevDms.map((d) =>
                      d.id === ch.id ? { ...d, last_message_id: lastId } : d
                    );
                    return updated.sort((a, b) => {
                      const timeA = a.last_message_id || a.id;
                      const timeB = b.last_message_id || b.id;
                      return compareSnowflakesDesc(timeA, timeB);
                    });
                  });
                }
                return reversed;
              }
              return prev;
            });
          }
        } catch {
          // ignore background polling errors
        }
      }
    }, 3500);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden bg-[#090a0f] text-slate-100 theme-transition">
      {/* Waybar Capsule TitleBar */}
      <TitleBar
        palette={palette}
        activeGuildName={activeGuild?.name}
        activeChannelName={activeChannel?.name}
        activeChannelType={activeChannel?.type}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Guild Icons Rail */}
        <GuildRail
          guilds={guilds}
          activeGuildId={activeGuild?.id || null}
          onSelectGuild={handleSelectGuild}
        />

        {/* Channel Sidebar (Server categories & channels or Direct Messages) */}
        <ChannelSidebar
          activeGuild={activeGuild}
          channels={channels}
          dms={dms}
          activeChannelId={activeChannel?.id || null}
          currentUser={currentUser}
          onSelectChannel={handleSelectChannel}
          onOpenSettings={() => setIsSettingsOpen(true)}
          presences={presences}
        />

        {/* Main Chat Feed */}
        <ChatArea
          activeChannel={activeChannel}
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isLoadingMessages}
          settings={settings}
          presences={presences}
        />
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          currentUser={currentUser}
          palette={palette}
          onLogout={handleLogout}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Login Modal if not authenticated */}
      {!currentUser && <LoginModal onLoginSuccess={handleLoginSuccess} />}
    </div>
  );
}
