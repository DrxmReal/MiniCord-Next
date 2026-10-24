import React, { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Hash,
  Send,
  Paperclip,
  X,
  Image as ImageIcon,
  Smile,
  Phone,
  PhoneOff,
  Video,
  Mic,
  MicOff,
  Maximize2,
  Copy,
  Reply,
} from "lucide-react";
import { DiscordChannel, DiscordMessage, AppSettings, UserPresence } from "../types";
import { EmbedCard, formatMarkdownText } from "./EmbedCard";
import { EmojiGifPicker } from "./EmojiGifPicker";
import { StatusBadge } from "./StatusBadge";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";

interface ChatAreaProps {
  activeChannel: DiscordChannel | null;
  messages: DiscordMessage[];
  onSendMessage: (content: string, attachment?: { name: string; dataUrl: string }) => Promise<void>;
  isLoading: boolean;
  settings: AppSettings;
  presences?: Record<string, UserPresence>;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  activeChannel,
  messages,
  onSendMessage,
  isLoading,
  settings,
  presences = {},
}) => {
  const [inputText, setInputText] = useState("");
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    dataUrl: string;
  } | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

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

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() && !selectedFile) return;

    const text = inputText;
    const file = selectedFile;
    setInputText("");
    setSelectedFile(null);

    await onSendMessage(
      text,
      file ? { name: file.name, dataUrl: file.dataUrl } : undefined
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
        label: "Copy Message ID",
        icon: <Hash className="w-3.5 h-3.5" />,
        onClick: () => {
          navigator.clipboard.writeText(msg.id);
        },
      },
      {
        label: "Reply to Message",
        icon: <Reply className="w-3.5 h-3.5" />,
        onClick: () => {
          setInputText(`> ${msg.content.slice(0, 50)}...\n`);
          textInputRef.current?.focus();
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

        {/* Right Header: Call Controls (Voice & Video) */}
        {activeChannel && (
          <div className="flex items-center gap-1">
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
                    isCallMuted ? "text-red-400 bg-red-500/20" : "text-white/80 hover:bg-white/10"
                  }`}
                  title={isCallMuted ? "Unmute" : "Mute"}
                >
                  {isCallMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
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
          </div>
        )}
      </div>

      {/* Messages Feed (space-y-3 REMOVED to eliminate huge spacing!) */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-white/40 text-sm">
            Loading messages...
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/30 text-sm">
            <Hash className="w-12 h-12 mb-2 text-white/20" />
            <span>Welcome to #{activeChannel?.name || "chat"}!</span>
            <span className="text-xs text-white/20 mt-1">This is the start of this channel.</span>
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
                className={`group flex gap-3 rounded-xl px-2.5 transition-colors hover:bg-white/[0.03] ${
                  isConsecutive
                    ? "mt-[1px] py-[2px]"
                    : isCompact
                    ? "mt-2 pt-1.5 pb-0.5"
                    : "mt-3.5 pt-2 pb-1"
                }`}
              >
                {!isConsecutive ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 shrink-0 mt-0.5 select-none">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
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
                      <span className="font-semibold text-sm text-white hover:underline cursor-pointer">
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
                      {formatMarkdownText(msg.content)}
                    </div>
                  )}

                  {/* Message Rich Embeds */}
                  {msg.embeds && msg.embeds.length > 0 && (
                    <div className="space-y-1.5 mt-1">
                      {msg.embeds.map((embed, eIdx) => (
                        <EmbedCard
                          key={eIdx}
                          embed={embed}
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
                            Boolean(att.filename.match(/\.(png|jpe?g|gif|webp)$/i)));

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
                                <span className="truncate max-w-[280px] text-white/70">{att.filename}</span>
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
                            <span className="text-white/40">({formatFileSize(att.size)})</span>
                          </a>
                        );
                      })}
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
            <span className="text-white/40">({formatFileSize(selectedFile.size)})</span>
          </div>
          <button
            onClick={() => setSelectedFile(null)}
            className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
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

        <form
          onSubmit={handleSend}
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
            onChange={(e) => setInputText(e.target.value)}
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
