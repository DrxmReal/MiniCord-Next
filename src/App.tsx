import { useState, useEffect, useRef, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TitleBar } from "./components/TitleBar";
import { GuildRail } from "./components/GuildRail";
import { ChannelSidebar } from "./components/ChannelSidebar";
import { ChatArea } from "./components/ChatArea";
import { MemberList } from "./components/MemberList";
import { UserProfileModal } from "./components/UserProfileModal";
import { FriendsTab } from "./components/FriendsTab";
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
  DiscordMember,
  DiscordRole,
  TypingEvent,
  DiscordVoiceState,
} from "./types";
import "./App.css";

// Check if running in Tauri environment
const isTauri =
  typeof window !== "undefined" && Boolean((window as any).__TAURI_INTERNALS__);

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

  // New UI states: Member list, Friends tab, Profile Modal
  const [isMemberListOpen, setIsMemberListOpen] = useState(true);
  const [isFriendsTabActive, setIsFriendsTabActive] = useState(false);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<DiscordUser | null>(null);
  const [selectedMemberForProfile, setSelectedMemberForProfile] = useState<DiscordMember | null>(null);
  const [guildRoles, setGuildRoles] = useState<DiscordRole[]>([]);
  const [guildMembers, setGuildMembers] = useState<DiscordMember[]>([]);

  // Voice State Management
  const [voiceStates, setVoiceStates] = useState<Record<string, DiscordVoiceState>>({});
  const [connectedVoice, setConnectedVoice] = useState<{
    guildId: string | null;
    channelId: string;
    channelName: string;
  } | null>(null);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isVoiceDeafened, setIsVoiceDeafened] = useState(false);

  // Real-time typing indicators
  const [typingMap, setTypingMap] = useState<
    Record<string, Record<string, { username: string; expiresAt: number }>>
  >({});

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
  const currentUserRef = useRef<DiscordUser | null>(null);
  currentUserRef.current = currentUser;
  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;

  const connectedVoiceRef = useRef(connectedVoice);
  connectedVoiceRef.current = connectedVoice;
  const isVoiceMutedRef = useRef(isVoiceMuted);
  isVoiceMutedRef.current = isVoiceMuted;
  const isVoiceDeafenedRef = useRef(isVoiceDeafened);
  isVoiceDeafenedRef.current = isVoiceDeafened;

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
    if (
      !settingsRef.current.wallpaperSync &&
      settingsRef.current.customAccent &&
      settingsRef.current.customAccent !== "auto"
    ) {
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
    if (
      !settings.wallpaperSync &&
      settings.customAccent &&
      settings.customAccent !== "auto"
    ) {
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
    setSelectedUserForProfile(null);
    setSelectedMemberForProfile(null);
  };

  // Gateway and Platform Event Subscriptions
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
    const unlistenTheme = listen<ThemePalette>("wallpaper-theme-update", (event) => {
      applyTheme(event.payload);
    });

    // 3. Listen to Gateway Presences Sync (initial bulk presences)
    const unlistenPresences = listen<UserPresence[]>(
      "gateway-presences-sync",
      (event) => {
        const map: Record<string, UserPresence> = {};
        for (const p of event.payload) {
          map[p.user_id] = p;
        }
        setPresences((prev) => ({ ...prev, ...map }));
      }
    );

    // 4. Listen to Live Gateway Presence Updates
    const unlistenPresenceUpdate = listen<UserPresence>(
      "gateway-presence-update",
      (event) => {
        const p = event.payload;
        setPresences((prev) => ({
          ...prev,
          [p.user_id]: p,
        }));
      }
    );

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

    // 6. Listen to Real-time Typing Indicators from Gateway
    const unlistenTyping = listen<TypingEvent>("gateway-typing-start", (event) => {
      const { channel_id, user_id, member } = event.payload;
      const me = currentUserRef.current;
      if (me && user_id === me.id) return;

      const username =
        member?.nick ||
        member?.user?.global_name ||
        member?.user?.username ||
        "Someone";

      setTypingMap((prev) => {
        const channelTyping = { ...(prev[channel_id] || {}) };
        channelTyping[user_id] = {
          username,
          expiresAt: Date.now() + 7500,
        };
        return { ...prev, [channel_id]: channelTyping };
      });
    });

    // 7. Listen to Real-time Reactions Add
    const unlistenReactionAdd = listen<any>("gateway-reaction-add", (event) => {
      const payload = event.payload;
      const ch = activeChannelRef.current;
      if (ch && payload.channel_id === ch.id) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== payload.message_id) return m;
            const reactions = [...(m.reactions || [])];
            const pEmoji = payload.emoji;
            const isCustom = Boolean(pEmoji.id);
            const key = isCustom ? `${pEmoji.name}:${pEmoji.id}` : pEmoji.name;

            const existingIdx = reactions.findIndex((r) => {
              const rKey = r.emoji.id
                ? `${r.emoji.name}:${r.emoji.id}`
                : r.emoji.name;
              return rKey === key;
            });

            const me = currentUserRef.current;
            const isMe = me ? payload.user_id === me.id : false;

            if (existingIdx !== -1) {
              reactions[existingIdx] = {
                ...reactions[existingIdx],
                count: reactions[existingIdx].count + 1,
                me: isMe ? true : reactions[existingIdx].me,
              };
            } else {
              reactions.push({
                count: 1,
                me: isMe,
                emoji: {
                  id: pEmoji.id || null,
                  name: pEmoji.name,
                },
              });
            }
            return { ...m, reactions };
          })
        );
      }
    });

    // 8. Listen to Real-time Reactions Remove
    const unlistenReactionRemove = listen<any>("gateway-reaction-remove", (event) => {
      const payload = event.payload;
      const ch = activeChannelRef.current;
      if (ch && payload.channel_id === ch.id) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== payload.message_id) return m;
            const reactions = [...(m.reactions || [])];
            const pEmoji = payload.emoji;
            const isCustom = Boolean(pEmoji.id);
            const key = isCustom ? `${pEmoji.name}:${pEmoji.id}` : pEmoji.name;

            const existingIdx = reactions.findIndex((r) => {
              const rKey = r.emoji.id
                ? `${r.emoji.name}:${r.emoji.id}`
                : r.emoji.name;
              return rKey === key;
            });

            const me = currentUserRef.current;
            const isMe = me ? payload.user_id === me.id : false;

            if (existingIdx !== -1) {
              const cur = reactions[existingIdx];
              if (cur.count <= 1) {
                reactions.splice(existingIdx, 1);
              } else {
                reactions[existingIdx] = {
                  ...cur,
                  count: cur.count - 1,
                  me: isMe ? false : cur.me,
                };
              }
            }
            return { ...m, reactions };
          })
        );
      }
    });

    // 9. Listen to Real-time Guild Voice States Sync
    const unlistenGuildVoiceStates = listen<{
      guild_id: string;
      voice_states: DiscordVoiceState[];
    }>("gateway-guild-voice-states", (event) => {
      const { voice_states } = event.payload;
      setVoiceStates((prev) => {
        const next = { ...prev };
        for (const vs of voice_states) {
          next[vs.user_id] = vs;
        }
        return next;
      });
    });

    // 10. Listen to Real-time Single Voice State Updates
    const unlistenVoiceStateUpdate = listen<DiscordVoiceState>(
      "gateway-voice-state-update",
      (event) => {
        const vs = event.payload;
        setVoiceStates((prev) => {
          const next = { ...prev };
          if (!vs.channel_id) {
            delete next[vs.user_id];
          } else {
            next[vs.user_id] = vs;
          }
          return next;
        });

        // Sync connectedVoice if the update is for current user
        const me = currentUserRef.current;
        if (me && vs.user_id === me.id) {
          if (!vs.channel_id) {
            setConnectedVoice(null);
          } else {
            setConnectedVoice((prev) => {
              if (prev && prev.channelId === vs.channel_id) return prev;
              return {
                guildId: vs.guild_id || null,
                channelId: vs.channel_id!,
                channelName: "Voice Channel",
              };
            });
          }
        }
      }
    );

    return () => {
      unlistenTheme.then((u) => u());
      unlistenPresences.then((u) => u());
      unlistenPresenceUpdate.then((u) => u());
      unlistenMsgCreate.then((u) => u());
      unlistenTyping.then((u) => u());
      unlistenReactionAdd.then((u) => u());
      unlistenReactionRemove.then((u) => u());
      unlistenGuildVoiceStates.then((u) => u());
      unlistenVoiceStateUpdate.then((u) => u());
    };
  }, []);

  // Periodic typing cleanup (purge expired typing entries)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setTypingMap((prev) => {
        let changed = false;
        const next: typeof prev = {};
        for (const [chId, users] of Object.entries(prev)) {
          const validUsers: Record<
            string,
            { username: string; expiresAt: number }
          > = {};
          for (const [uId, data] of Object.entries(users)) {
            if (data.expiresAt > now) {
              validUsers[uId] = data;
            } else {
              changed = true;
            }
          }
          if (Object.keys(validUsers).length > 0) {
            next[chId] = validUsers;
          }
        }
        return changed ? next : prev;
      });
    }, 1500);

    return () => clearInterval(timer);
  }, []);

  // Active channel typing users list
  const activeTypingUsernames = useMemo(() => {
    if (!activeChannel) return [];
    const users = typingMap[activeChannel.id];
    if (!users) return [];
    return Object.values(users).map((u) => u.username);
  }, [typingMap, activeChannel?.id]);

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
      if (sorted.length > 0 && !activeChannelRef.current && !isFriendsTabActive) {
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
        const initialPresences = await invoke<UserPresence[]>(
          "get_user_presences"
        );
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
    setIsFriendsTabActive(false);

    if (guild && isTauri) {
      try {
        const [guildChannels, roles, members] = await Promise.all([
          invoke<DiscordChannel[]>("get_channels", { guildId: guild.id }),
          invoke<DiscordRole[]>("get_guild_roles", { guildId: guild.id }).catch(
            () => []
          ),
          invoke<DiscordMember[]>("get_guild_members", {
            guildId: guild.id,
            limit: 1000,
          }).catch(() => []),
        ]);
        setChannels(guildChannels);
        setGuildRoles(roles);
        setGuildMembers(members);

        // Fetch initial voice states for this guild
        try {
          const vStates = await invoke<DiscordVoiceState[]>(
            "get_guild_voice_states",
            { guildId: guild.id }
          );
          const vMap: Record<string, DiscordVoiceState> = {};
          for (const vs of vStates) {
            vMap[vs.user_id] = vs;
          }
          setVoiceStates(vMap);
        } catch (e) {
          console.error("Failed to fetch initial guild voice states:", e);
        }

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
      setGuildRoles([]);
      setGuildMembers([]);
      await loadDMs();
    }
  };

  // Select channel and load messages
  const handleSelectChannel = async (channel: DiscordChannel) => {
    setActiveChannel(channel);
    setIsFriendsTabActive(false);
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

  // Join Discord Voice Channel
  const handleJoinVoice = async (channel: DiscordChannel) => {
    if (!isTauri) return;
    const guildId = activeGuild?.id || null;
    try {
      await invoke("set_voice_state", {
        guildId,
        channelId: channel.id,
        selfMute: isVoiceMutedRef.current,
        selfDeaf: isVoiceDeafenedRef.current,
      });
      setConnectedVoice({
        guildId,
        channelId: channel.id,
        channelName: channel.name,
      });
      if (currentUser) {
        setVoiceStates((prev) => ({
          ...prev,
          [currentUser.id]: {
            guild_id: guildId,
            channel_id: channel.id,
            user_id: currentUser.id,
            self_mute: isVoiceMutedRef.current,
            self_deaf: isVoiceDeafenedRef.current,
          },
        }));
      }
    } catch (err) {
      console.error("Failed to join voice channel:", err);
    }
  };

  // Disconnect from active Discord Voice Channel
  const handleDisconnectVoice = async () => {
    if (!isTauri) return;
    const cur = connectedVoiceRef.current;
    if (!cur) return;
    try {
      await invoke("set_voice_state", {
        guildId: cur.guildId,
        channelId: null,
        selfMute: isVoiceMutedRef.current,
        selfDeaf: isVoiceDeafenedRef.current,
      });
      if (currentUser) {
        setVoiceStates((prev) => {
          const next = { ...prev };
          delete next[currentUser.id];
          return next;
        });
      }
      setConnectedVoice(null);
    } catch (err) {
      console.error("Failed to disconnect voice:", err);
    }
  };

  // Toggle Voice Mute
  const handleToggleVoiceMute = async () => {
    const nextMute = !isVoiceMuted;
    setIsVoiceMuted(nextMute);
    const cur = connectedVoiceRef.current;
    if (isTauri && cur) {
      try {
        await invoke("set_voice_state", {
          guildId: cur.guildId,
          channelId: cur.channelId,
          selfMute: nextMute,
          selfDeaf: isVoiceDeafened,
        });
      } catch (err) {
        console.error("Failed to toggle voice mute:", err);
      }
    }
  };

  // Toggle Voice Deafen
  const handleToggleVoiceDeafen = async () => {
    const nextDeaf = !isVoiceDeafened;
    setIsVoiceDeafened(nextDeaf);
    const cur = connectedVoiceRef.current;
    if (isTauri && cur) {
      try {
        await invoke("set_voice_state", {
          guildId: cur.guildId,
          channelId: cur.channelId,
          selfMute: isVoiceMuted,
          selfDeaf: nextDeaf,
        });
      } catch (err) {
        console.error("Failed to toggle voice deafen:", err);
      }
    }
  };

  // Open or create DM conversation with a user
  const handleOpenDM = async (userId: string) => {
    if (!isTauri) return;
    try {
      const dmChannel = await invoke<DiscordDMChannel>("create_dm", {
        recipientId: userId,
      });

      setDms((prev) => {
        if (prev.some((d) => d.id === dmChannel.id)) return prev;
        return [dmChannel, ...prev];
      });

      const recipient = dmChannel.recipients?.[0];
      const displayName =
        dmChannel.type === 3
          ? dmChannel.name || "Group Chat"
          : recipient?.global_name || recipient?.username || "Direct Message";

      setActiveGuild(null);
      setIsFriendsTabActive(false);
      setSelectedUserForProfile(null);
      setSelectedMemberForProfile(null);

      handleSelectChannel({
        id: dmChannel.id,
        name: displayName,
        type: dmChannel.type,
        recipient: recipient || null,
      });
    } catch (err) {
      console.error("Failed to open DM:", err);
    }
  };

  // Toggle reaction (add or remove)
  const handleToggleReaction = async (
    messageId: string,
    emoji: string,
    isMe: boolean
  ) => {
    if (!activeChannel || !isTauri) return;

    // Optimistically update reactions in local messages state
    setMessages((prevMsgs) =>
      prevMsgs.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = [...(m.reactions || [])];
        const existingIdx = reactions.findIndex((r) => {
          const key = r.emoji.id
            ? `${r.emoji.name}:${r.emoji.id}`
            : r.emoji.name;
          return key === emoji;
        });

        if (isMe) {
          if (existingIdx !== -1) {
            const cur = reactions[existingIdx];
            if (cur.count <= 1) {
              reactions.splice(existingIdx, 1);
            } else {
              reactions[existingIdx] = {
                ...cur,
                count: cur.count - 1,
                me: false,
              };
            }
          }
        } else {
          if (existingIdx !== -1) {
            reactions[existingIdx] = {
              ...reactions[existingIdx],
              count: reactions[existingIdx].count + 1,
              me: true,
            };
          } else {
            const parts = emoji.split(":");
            reactions.push({
              count: 1,
              me: true,
              emoji:
                parts.length > 1
                  ? { name: parts[0], id: parts[1] }
                  : { name: emoji },
            });
          }
        }
        return { ...m, reactions };
      })
    );

    try {
      if (isMe) {
        await invoke("remove_reaction", {
          channelId: activeChannel.id,
          messageId,
          emoji,
        });
      } else {
        await invoke("add_reaction", {
          channelId: activeChannel.id,
          messageId,
          emoji,
        });
      }
    } catch (err) {
      console.error("Failed to toggle reaction:", err);
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
        activeChannelName={
          isFriendsTabActive
            ? "Friends"
            : activeChannel?.name || "Direct Messages"
        }
        activeChannelType={isFriendsTabActive ? undefined : activeChannel?.type}
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
          isFriendsTabActive={isFriendsTabActive}
          onSelectFriendsTab={() => {
            setIsFriendsTabActive(true);
            setActiveChannel(null);
          }}
          voiceStates={voiceStates}
          connectedVoice={connectedVoice}
          onJoinVoice={handleJoinVoice}
          onDisconnectVoice={handleDisconnectVoice}
          isVoiceMuted={isVoiceMuted}
          isVoiceDeafened={isVoiceDeafened}
          onToggleVoiceMute={handleToggleVoiceMute}
          onToggleVoiceDeafen={handleToggleVoiceDeafen}
          guildMembers={guildMembers}
        />

        {/* Center Main View: Friends Dashboard OR Chat Area */}
        {!activeGuild && isFriendsTabActive ? (
          <FriendsTab
            presences={presences}
            onOpenDM={handleOpenDM}
            onSelectUser={(user) => {
              setSelectedUserForProfile(user);
              setSelectedMemberForProfile(null);
            }}
          />
        ) : (
          <ChatArea
            activeChannel={activeChannel}
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoadingMessages}
            settings={settings}
            presences={presences}
            onSelectUser={(user) => {
              setSelectedUserForProfile(user);
              setSelectedMemberForProfile(null);
            }}
            isMemberListOpen={isMemberListOpen}
            onToggleMemberList={() => setIsMemberListOpen(!isMemberListOpen)}
            typingUsers={activeTypingUsernames}
            onToggleReaction={handleToggleReaction}
            channels={channels}
            guildRoles={guildRoles}
            guildMembers={guildMembers}
            currentUser={currentUser}
            onSelectChannel={handleSelectChannel}
            connectedVoice={connectedVoice}
            voiceStates={voiceStates}
            onJoinVoice={handleJoinVoice}
            onDisconnectVoice={handleDisconnectVoice}
            isVoiceMuted={isVoiceMuted}
            isVoiceDeafened={isVoiceDeafened}
            onToggleVoiceMute={handleToggleVoiceMute}
            onToggleVoiceDeafen={handleToggleVoiceDeafen}
          />
        )}

        {/* Right Server Member List Sidebar */}
        {activeGuild && activeChannel && isMemberListOpen && (
          <MemberList
            activeGuild={activeGuild}
            presences={presences}
            initialMembers={guildMembers}
            onSelectUser={(user, member) => {
              setSelectedUserForProfile(user);
              setSelectedMemberForProfile(member || null);
            }}
            onClose={() => setIsMemberListOpen(false)}
          />
        )}
      </div>

      {/* User Profile Popout Modal */}
      {selectedUserForProfile && (
        <UserProfileModal
          user={selectedUserForProfile}
          member={selectedMemberForProfile}
          roles={guildRoles}
          presence={presences[selectedUserForProfile.id]}
          onClose={() => {
            setSelectedUserForProfile(null);
            setSelectedMemberForProfile(null);
          }}
          onOpenDM={handleOpenDM}
        />
      )}

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
