import React, { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Hash,
  Send,
  Paperclip,
  X,
  Image as ImageIcon,
  Smile,
  SmilePlus,
  Phone,
  PhoneOff,
  Video,
  Mic,
  MicOff,
  Maximize2,
  Copy,
  Reply,
  Users,
} from "lucide-react";
import {
  DiscordChannel,
  DiscordMessage,
  AppSettings,
  UserPresence,
  DiscordUser,
  DiscordRole,
  DiscordMember,
  MentionContext,
} from "../types";
import { EmbedCard, formatMarkdownText } from "./EmbedCard";
import { EmojiGifPicker } from "./EmojiGifPicker";
import { StatusBadge } from "./StatusBadge";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";

const QUICK_REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "🔥", "🚀"];
const EXPANDED_REACTION_EMOJIS = [
  "👍", "👎", "❤️", "😂", "🎉", "🔥", "🚀", "👀",
  "✨", "💯", "😢", "🙏", "😮", "💀", "👏", "💩",
];

interface ChatAreaProps {
  activeChannel: DiscordChannel | null;
  messages: DiscordMessage[];
  onSendMessage: (
    content: string,
    attachment?: { name: string; dataUrl: string }
  ) => Promise<void>;
  isLoading: boolean;
  settings: AppSettings;
  presences?: Record<string, UserPresence>;
  onSelectUser?: (user: DiscordUser) => void;
  isMemberListOpen?: boolean;
  onToggleMemberList?: () => void;
  typingUsers?: string[];
  onToggleReaction?: (
    messageId: string,
    emoji: string,
    isMe: boolean
  ) => Promise<void>;
  channels?: DiscordChannel[];
  guildRoles?: DiscordRole[];
  guildMembers?: DiscordMember[];
  currentUser?: DiscordUser | null;
  onSelectChannel?: (channel: DiscordChannel) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  activeChannel,
  messages,
  onSendMessage,
  isLoading,
  settings,
  presences = {},
  onSelectUser,
  isMemberListOpen = true,
  onToggleMemberList,
  typingUsers = [],
  onToggleReaction,
  channels = [],
  guildRoles = [],
  guildMembers = [],
  currentUser = null,
  onSelectChannel,
}) => {
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    dataUrl: string;
  } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<DiscordMessage | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);

  // Call states
  const [isInCall, setIsInCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isCallMuted, setIsCallMuted] = useState(false);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  // @ Mention Autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentRef = useRef<number>(0);

  // Available users for mention autocomplete
  const mentionSuggestions = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();

    const pool: Array<{
      id: string;
      name: string;
      username: string;
      avatarUrl?: string | null;
      presence?: UserPresence;
    }> = [];

    if (guildMembers && guildMembers.length > 0) {
      for (const m of guildMembers) {
        const displayName = m.nick || m.user.global_name || m.user.username;
        const avatar = m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=64`
          : null;
        pool.push({
          id: m.user.id,
          name: displayName,
          username: m.user.username,
          avatarUrl: avatar,
          presence: presences[m.user.id],
        });
      }
    } else if (activeChannel?.recipient) {
      const u = activeChannel.recipient;
      pool.push({
        id: u.id,
        name: u.global_name || u.username,
        username: u.username,
        avatarUrl: u.avatar
          ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`
          : null,
        presence: presences[u.id],
      });
    }

    const filtered = pool.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q)
    );

    return filtered.slice(0, 8);
  }, [mentionQuery, guildMembers, activeChannel?.recipient, presences]);

  const insertMention = (userId: string) => {
    const val = inputText;
    const cursorPos = textInputRef.current?.selectionStart ?? val.length;
    const beforeCursor = val.slice(0, cursorPos);
    const afterCursor = val.slice(cursorPos);

    const replacedBefore = beforeCursor.replace(/@([a-zA-Z0-9_\.\-]*)$/, `<@${userId}> `);
    const newVal = replacedBefore + afterCursor;

    setInputText(newVal);
    setMentionQuery(null);

    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
        const newCursorPos = replacedBefore.length;
        textInputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = () => {
            setSelectedFile({
              name: file.name && file.name !== "image.png" ? file.name : `pasted_image_${Date.now()}.png`,
              size: file.size,
              dataUrl: reader.result as string,
            });
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    }
  };

  const baseMentionContext: MentionContext = React.useMemo(
    () => ({
      members: guildMembers,
      roles: guildRoles,
      channels,
      currentUser,
      onSelectUser,
      onSelectChannel,
    }),
    [guildMembers, guildRoles, channels, currentUser, onSelectUser, onSelectChannel]
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Call duration counter
  useEffect(() => {
    let interval: any = null;
    if (isInCall) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [isInCall]);

  const handleStartCall = async () => {
    if (!activeChannel) return;
    setIsInCall(true);
    try {
      await invoke("ring_call", { channelId: activeChannel.id });
    } catch (e) {
      console.log("Call ring notification:", e);
    }
  };

  const handleEndCall = async () => {
    if (!activeChannel) return;
    setIsInCall(false);
    try {
      await invoke("stop_ring_call", { channelId: activeChannel.id });
    } catch (e) {
      console.log("Call stop notification:", e);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedFile({
          name: file.name,
          size: file.size,
          dataUrl: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (val: string) => {
    setInputText(val);

    // Check for @ mention query
    const cursorPos = textInputRef.current?.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([a-zA-Z0-9_\.\-]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setSelectedMentionIndex(0);
    } else {
      setMentionQuery(null);
    }

    // Trigger typing event to Discord Gateway (throttled to once per 6 seconds)
    if (val.trim() && activeChannel) {
      const now = Date.now();
      if (now - lastTypingSentRef.current > 6000) {
        lastTypingSentRef.current = now;
        invoke("trigger_typing", { channelId: activeChannel.id }).catch(() => {});
      }
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;

    let text = inputText;
    if (replyingTo) {
      const authorName =
        replyingTo.author.global_name || replyingTo.author.username;
      const snippet = replyingTo.content
        ? replyingTo.content.slice(0, 100)
        : "[attachment]";
      text = `> **${authorName}**: ${snippet}\n${text}`;
    }

    const file = selectedFile;
    setInputText("");
    setSelectedFile(null);
    setReplyingTo(null);
    setMentionQuery(null);

    await onSendMessage(
      text,
      file ? { name: file.name, dataUrl: file.dataUrl } : undefined
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionQuery !== null && mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % mentionSuggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMentionIndex(
          (prev) => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = mentionSuggestions[selectedMentionIndex];
        if (selected) {
          insertMention(selected.id);
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectEmoji = (emoji: string) => {
    setInputText((prev) => prev + emoji);
    setShowPicker(false);
    textInputRef.current?.focus();
  };

  const handleSelectGif = async (url: string) => {
    setShowPicker(false);
    await onSendMessage(url);
  };

  const handleReactionClick = async (
    messageId: string,
    emoji: string,
    isMe: boolean
  ) => {
    setReactionPickerMsgId(null);
    if (onToggleReaction) {
      await onToggleReaction(messageId, emoji, isMe);
    } else if (activeChannel) {
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
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const handleMessageContextMenu = (e: React.MouseEvent, msg: DiscordMessage) => {
    e.preventDefault();
    e.stopPropagation();

    const items: ContextMenuItem[] = [
      {
        label: "Copy Text",
        icon: <Copy className="w-3.5 h-3.5" />,
        onClick: () => {
          if (msg.content) navigator.clipboard.writeText(msg.content);
        },
      },
      {
        label: "Reply to Message",
        icon: <Reply className="w-3.5 h-3.5" />,
        onClick: () => {
          setReplyingTo(msg);
          textInputRef.current?.focus();
        },
      },
      {
        label: "Copy Message ID",
        icon: <Hash className="w-3.5 h-3.5" />,
        onClick: () => {
          navigator.clipboard.writeText(msg.id);
        },
      },
    ];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items,
    });
  };

  const isDM = activeChannel?.type === 1 || activeChannel?.type === 3;
  const recipient = activeChannel?.recipient;
  const recipientPresence = recipient ? presences[recipient.id] : null;

  return (
    <main
      className="flex-1 h-full flex flex-col bg-[var(--bg-surface)] backdrop-blur-md relative overflow-hidden"
      style={{
        fontFamily: settings.fontFamily,
        fontSize: `${settings.fontSize}px`,
      }}
    >
      {/* Channel Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-white/5 bg-[var(--bg-deep)]/60 shrink-0 select-none">
        <div className="flex items-center gap-2 overflow-hidden">
          {isDM ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <span className="font-semibold text-white truncate flex items-center gap-1">
                <span>@</span>
                <span>{activeChannel?.name || "Direct Message"}</span>
              </span>

              {/* Status Badge in Header */}
              {recipientPresence && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 text-[11px] shrink-0">
                  <StatusBadge status={recipientPresence.status} size="sm" />
                  {recipientPresence.activity ? (
                    <span className="text-[var(--accent)] font-medium truncate max-w-xs">
                      {recipientPresence.activity}
                    </span>
                  ) : (
                    <span className="text-white/50 capitalize font-mono text-[10px]">
                      {recipientPresence.status}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <Hash className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-white truncate">
                {activeChannel ? activeChannel.name : "Select a channel"}
              </span>
              {activeChannel?.topic && (
                <>
                  <span className="text-white/20">|</span>
                  <span className="text-xs text-white/50 truncate max-w-md">
                    {activeChannel.topic}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        {/* Right Header: Call Controls & Member List Toggle */}
        <div className="flex items-center gap-1">
          {activeChannel && (
            <>
              {isInCall ? (
                /* Active In-Call Capsule */
                <div className="flex items-center gap-2 capsule-pill px-3 py-1 bg-emerald-500/20 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {formatTimer(callDuration)}
                  </span>
                  <button
                    onClick={() => setIsCallMuted(!isCallMuted)}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      isCallMuted
                        ? "text-red-400 bg-red-500/20"
                        : "text-white/80 hover:bg-white/10"
                    }`}
                    title={isCallMuted ? "Unmute" : "Mute"}
                  >
                    {isCallMuted ? (
                      <MicOff className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={handleEndCall}
                    className="p-1 rounded-md text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer"
                    title="Disconnect Call"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                /* Voice & Video Call Trigger Buttons */
                <div className="flex items-center gap-1 text-slate-300">
                  <button
                    onClick={handleStartCall}
                    className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                    title="Start Voice Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleStartCall}
                    className="p-1.5 rounded-lg hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                    title="Start Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}

          {/* Member List Toggle Button (for server channels) */}
          {!isDM && activeChannel && onToggleMemberList && (
            <button
              onClick={onToggleMemberList}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ml-1 ${
                isMemberListOpen
                  ? "bg-white/15 text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
              title={isMemberListOpen ? "Hide Member List" : "Show Member List"}
            >
              <Users className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-white/40 text-sm">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/30 text-sm">
            <Hash className="w-12 h-12 mb-2 text-white/20" />
            <span>Welcome to #{activeChannel?.name || "chat"}!</span>
            <span className="text-xs text-white/20 mt-1">
              This is the start of this channel.
            </span>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isConsecutive =
              index > 0 &&
              messages[index - 1].author.id === msg.author.id &&
              new Date(msg.timestamp).getTime() -
                new Date(messages[index - 1].timestamp).getTime() <
                300000;

            const avatarUrl = msg.author.avatar
              ? `https://cdn.discordapp.com/avatars/${msg.author.id}/${msg.author.avatar}.png?size=80`
              : null;

            const isCompact = settings.spacing === "compact";

            return (
              <div
                key={msg.id}
                onContextMenu={(e) => handleMessageContextMenu(e, msg)}
                className={`group relative flex gap-3 rounded-xl px-2.5 transition-colors hover:bg-white/[0.03] ${
                  isConsecutive
                    ? "mt-[1px] py-[2px]"
                    : isCompact
                    ? "mt-2 pt-1.5 pb-0.5"
                    : "mt-3.5 pt-2 pb-1"
                }`}
              >
                {/* Floating Quick Action Bar (Hover on message) */}
                <div className="absolute -top-3.5 right-4 z-10 hidden group-hover:flex items-center bg-[#18191c] border border-white/10 rounded-lg shadow-xl px-1 py-0.5 gap-0.5 select-none animate-fadeIn">
                  {/* Quick Emojis */}
                  {QUICK_REACTION_EMOJIS.slice(0, 3).map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReactionClick(msg.id, emoji, false)}
                      className="p-1 hover:bg-white/10 rounded text-sm transition-transform hover:scale-125 cursor-pointer leading-none"
                      title={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}

                  <div className="w-[1px] h-3.5 bg-white/10 mx-0.5" />

                  {/* Add reaction picker button */}
                  <button
                    onClick={() =>
                      setReactionPickerMsgId(
                        reactionPickerMsgId === msg.id ? null : msg.id
                      )
                    }
                    className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                    title="Add Reaction"
                  >
                    <SmilePlus className="w-3.5 h-3.5" />
                  </button>

                  {/* Reply button */}
                  <button
                    onClick={() => {
                      setReplyingTo(msg);
                      textInputRef.current?.focus();
                    }}
                    className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                    title="Reply"
                  >
                    <Reply className="w-3.5 h-3.5" />
                  </button>

                  {/* Copy button */}
                  <button
                    onClick={() => {
                      if (msg.content) navigator.clipboard.writeText(msg.content);
                    }}
                    className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                    title="Copy Text"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Avatar or Timestamp */}
                {!isConsecutive ? (
                  <div
                    onClick={() => onSelectUser?.(msg.author)}
                    className="w-10 h-10 rounded-full overflow-hidden bg-white/10 shrink-0 mt-0.5 select-none cursor-pointer hover:opacity-85 transition-opacity"
                    title={`View @${msg.author.username}'s profile`}
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-sm text-white">
                        {msg.author.username?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-10 shrink-0 text-[10px] text-white/0 group-hover:text-white/40 text-right pr-2 pt-0.5 font-mono select-none">
                    {formatTimestamp(msg.timestamp)}
                  </div>
                )}

                <div className="flex-1 overflow-hidden">
                  {!isConsecutive && (
                    <div className="flex items-baseline gap-2 select-none mb-0.5">
                      <span
                        onClick={() => onSelectUser?.(msg.author)}
                        className="font-semibold text-sm text-white hover:underline cursor-pointer"
                      >
                        {msg.author.global_name || msg.author.username}
                      </span>
                      <span className="text-[11px] text-white/40 font-mono">
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    </div>
                  )}

                  {/* Message Content with Markdown & Linkifier */}
                  {msg.content && (
                    <div
                      className="text-slate-200 break-words leading-snug select-text"
                      style={{ fontSize: `${settings.fontSize}px` }}
                    >
                      {formatMarkdownText(msg.content, {
                        ...baseMentionContext,
                        mentions: msg.mentions,
                      })}
                      {msg.edited_timestamp && (
                        <span className="text-[10px] text-white/30 italic ml-1 select-none">
                          (edited)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Message Rich Embeds */}
                  {msg.embeds && msg.embeds.length > 0 && (
                    <div className="space-y-1.5 mt-1">
                      {msg.embeds.map((embed, eIdx) => (
                        <EmbedCard
                          key={eIdx}
                          embed={embed}
                          mentionContext={{
                            ...baseMentionContext,
                            mentions: msg.mentions,
                          }}
                          onOpenImage={(url) => setPreviewImage(url)}
                        />
                      ))}
                    </div>
                  )}

                  {/* Message Attachments (Images + Inline Video Player + Documents) */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {msg.attachments.map((att) => {
                        const isVideo =
                          att.content_type?.startsWith("video/") ||
                          Boolean(att.filename.match(/\.(mp4|webm|mov|m4v)$/i));

                        const isImage =
                          !isVideo &&
                          (att.content_type?.startsWith("image/") ||
                            Boolean(
                              att.filename.match(/\.(png|jpe?g|gif|webp)$/i)
                            ));

                        // 1. INLINE VIDEO PLAYER
                        if (isVideo) {
                          return (
                            <div
                              key={att.id}
                              className="max-w-lg rounded-2xl overflow-hidden border border-white/10 bg-black/80 shadow-2xl my-1 group/vid"
                            >
                              <video
                                src={att.url}
                                controls
                                playsInline
                                preload="metadata"
                                className="w-full max-h-[400px] rounded-2xl bg-black object-contain"
                              />
                              <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-white/50 bg-black/40 border-t border-white/5 font-mono">
                                <span className="truncate max-w-[280px] text-white/70">
                                  {att.filename}
                                </span>
                                <span>{formatFileSize(att.size)}</span>
                              </div>
                            </div>
                          );
                        }

                        // 2. IMAGE VIEWER
                        if (isImage) {
                          return (
                            <div
                              key={att.id}
                              className="relative group/att max-w-sm max-h-80 rounded-xl overflow-hidden border border-white/10 cursor-pointer bg-black/40"
                              onClick={() => setPreviewImage(att.url)}
                            >
                              <img
                                src={att.url}
                                alt={att.filename}
                                className="max-h-80 w-auto object-contain rounded-xl hover:opacity-95 transition-opacity"
                                loading="lazy"
                              />
                              <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/80 opacity-0 group-hover/att:opacity-100 transition-opacity">
                                <Maximize2 className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          );
                        }

                        // 3. GENERIC FILE ATTACHMENT
                        return (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-white"
                          >
                            <Paperclip className="w-4 h-4 text-slate-400" />
                            <span className="underline">{att.filename}</span>
                            <span className="text-white/40">
                              ({formatFileSize(att.size)})
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* Message Reactions Pills */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 items-center select-none">
                      {msg.reactions.map((reaction, rIdx) => {
                        const isCustom = Boolean(reaction.emoji.id);
                        const emojiKey = isCustom
                          ? `${reaction.emoji.name}:${reaction.emoji.id}`
                          : reaction.emoji.name;
                        const isMe = reaction.me;

                        return (
                          <button
                            key={rIdx}
                            onClick={() =>
                              handleReactionClick(msg.id, emojiKey, isMe)
                            }
                            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                              isMe
                                ? "bg-[var(--accent-dim)] border-[var(--accent)] text-[var(--accent)] shadow-sm"
                                : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                            }`}
                            title={reaction.emoji.name}
                          >
                            {isCustom ? (
                              <img
                                src={`https://cdn.discordapp.com/emojis/${reaction.emoji.id}.png?size=32`}
                                alt={reaction.emoji.name}
                                className="w-4 h-4 object-contain"
                              />
                            ) : (
                              <span className="text-sm leading-none">
                                {reaction.emoji.name}
                              </span>
                            )}
                            <span className="text-[11px] font-mono">
                              {reaction.count}
                            </span>
                          </button>
                        );
                      })}

                      {/* Small button to add another reaction */}
                      <button
                        onClick={() =>
                          setReactionPickerMsgId(
                            reactionPickerMsgId === msg.id ? null : msg.id
                          )
                        }
                        className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors cursor-pointer"
                        title="Add Reaction"
                      >
                        <SmilePlus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Inline Reaction Picker Popout for this Message */}
                  {reactionPickerMsgId === msg.id && (
                    <div className="mt-2 p-2 bg-[#1e1f22] border border-white/10 rounded-xl shadow-2xl z-20 flex flex-wrap gap-1 max-w-xs animate-fadeIn select-none">
                      {EXPANDED_REACTION_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => handleReactionClick(msg.id, emoji, false)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-lg transition-transform hover:scale-125 cursor-pointer leading-none"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selected File Upload Preview Bar */}
      {selectedFile && (
        <div className="px-4 py-2 bg-white/5 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-white truncate">
            <ImageIcon className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <span className="truncate max-w-xs">{selectedFile.name}</span>
            <span className="text-white/40">
              ({formatFileSize(selectedFile.size)})
            </span>
          </div>
          <button
            onClick={() => setSelectedFile(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Replying Banner */}
      {replyingTo && (
        <div className="px-4 py-1.5 bg-white/5 border-t border-white/5 flex items-center justify-between text-xs text-white/70 select-none">
          <div className="flex items-center gap-2 truncate">
            <Reply className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
            <span>Replying to</span>
            <span className="font-semibold text-white">
              @{replyingTo.author.global_name || replyingTo.author.username}
            </span>
            <span className="text-white/40 truncate max-w-md">
              {replyingTo.content || "[attachment]"}
            </span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Real-time Typing Indicator Bar */}
      {typingUsers && typingUsers.length > 0 && (
        <div className="px-4 py-1 text-xs text-white/60 flex items-center gap-2 select-none animate-fadeIn">
          <div className="flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <span>
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : typingUsers.length === 2
              ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
              : `Several people are typing...`}
          </span>
        </div>
      )}

      {/* Message Input Bar */}
      <div className="p-4 pt-1 relative">
        {/* Emoji / GIF / Sticker Popover */}
        {showPicker && (
          <EmojiGifPicker
            onSelectEmoji={handleSelectEmoji}
            onSelectGif={handleSelectGif}
            onClose={() => setShowPicker(false)}
          />
        )}

        {/* @ Mention Autocomplete Popover */}
        {mentionQuery !== null && mentionSuggestions.length > 0 && (
          <div className="absolute bottom-full left-4 mb-2 z-30 w-72 bg-[#18191c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1.5 animate-fadeIn select-none backdrop-blur-xl">
            <div className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white/40 border-b border-white/5 flex items-center justify-between">
              <span>Members</span>
              <span className="font-mono text-[10px] lowercase text-white/30">Tab / Enter to select</span>
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {mentionSuggestions.map((user, idx) => (
                <div
                  key={user.id}
                  onClick={() => insertMention(user.id)}
                  className={`flex items-center gap-2.5 px-3 py-1.5 cursor-pointer transition-colors ${
                    idx === selectedMentionIndex
                      ? "bg-[var(--accent-dim)] text-white border-l-2 border-[var(--accent)]"
                      : "text-white/80 hover:bg-white/5"
                  }`}
                >
                  <div className="relative w-7 h-7 rounded-full overflow-hidden bg-white/10 shrink-0">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-xs text-white">
                        {user.name[0]?.toUpperCase()}
                      </div>
                    )}
                    {user.presence && (
                      <div className="absolute -bottom-0.5 -right-0.5">
                        <StatusBadge status={user.presence.status} size="sm" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-white/40 font-mono truncate">
                      @{user.username}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form
          onSubmit={handleSend}
          onPaste={handlePaste}
          className="flex items-center gap-2 p-2 bg-white/5 rounded-2xl border border-white/10 focus-within:border-[var(--accent)] transition-all shadow-inner"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Attach file / video / photo"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <input
            ref={textInputRef}
            type="text"
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeChannel
                ? `Message #${activeChannel.name}...`
                : "Select a channel to chat..."
            }
            disabled={!activeChannel}
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-white/30 text-sm px-2 disabled:opacity-50"
          />

          <button
            type="button"
            onClick={() => setShowPicker(!showPicker)}
            className={`p-2 rounded-xl transition-colors cursor-pointer ${
              showPicker
                ? "bg-[var(--accent-dim)] text-[var(--accent)]"
                : "text-slate-400 hover:text-white hover:bg-white/10"
            }`}
            title="Insert Emoji, GIF or Sticker"
          >
            <Smile className="w-5 h-5" />
          </button>

          <button
            type="submit"
            disabled={!activeChannel || (!inputText.trim() && !selectedFile)}
            className="p-2 rounded-xl bg-[var(--accent)] text-black font-semibold hover:bg-[var(--accent-hover)] transition-all disabled:opacity-30 disabled:hover:bg-[var(--accent)] cursor-pointer"
            title="Send Message"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={previewImage}
              alt="Enlarged preview"
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl border border-white/10"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Custom Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </main>
  );
};
