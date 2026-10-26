import React, { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Smile, Film, Sparkles, Search, X, Loader2 } from "lucide-react";
import { DiscordEmoji, DiscordSticker, DiscordGif } from "../types";

interface EmojiGifPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (url: string) => void;
  onClose: () => void;
  guildId?: string | null;
  guildName?: string | null;
}

const UNICODE_EMOJI_CATEGORIES = [
  {
    name: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊",
      "😇", "🥰", "😍", "🤩", "😘", "😗", "😋", "😛", "😜", "🤪", "😝", "🤑",
      "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄",
      "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮",
      "🤧", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐",
    ],
  },
  {
    name: "Gestures & People",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘",
      "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛",
      "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪", "🦾", "🧠", "👀", "👁️",
    ],
  },
  {
    name: "Hearts & Fire",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
      "💞", "💓", "💗", "💖", "💘", "💝", "💟", "🔥", "⚡", "💥", "✨", "🌟",
      "💫", "💀", "☠️", "👻", "👽", "👾", "🤖", "🚀", "🛸", "💯", "🎉", "🎊",
    ],
  },
  {
    name: "Gaming & Activities",
    emojis: [
      "🎮", "🕹️", "🎯", "🎲", "🏆", "🥇", "🥈", "🥉", "👑", "💎", "⚔️", "🛡️",
      "🔮", "🪄", "🗡️", "🏹", "🎪", "🎭", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹",
    ],
  },
  {
    name: "Food & Drinks",
    emojis: [
      "🍕", "🍔", "🍟", "🌭", "🍿", "🥓", "🧇", "🥞", "🍳", "🍞", "🥐", "🥖",
      "🧀", "🥗", "🥪", "🍣", "🍜", "🍲", "🍛", "🍙", "🍚", "🍘", "🍢", "🍡",
      "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂", "🍮", "🍭", "🍬", "🍫", "🍩",
      "🍪", "🍯", "☕", "🍵", "🧃", "🥤", "🧋", "🍶", "🍺", "🍻", "🥂", "🍷",
    ],
  },
];

const DEFAULT_STICKERS = [
  { id: "1001", name: "Wumpus Wave", url: "https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" },
  { id: "1002", name: "Poggers", url: "https://cdn3.emoji.gg/emojis/poggers.png" },
  { id: "1003", name: "Pepe Cool", url: "https://cdn3.emoji.gg/emojis/pepe_cool.png" },
  { id: "1004", name: "Cat Heart", url: "https://cdn3.emoji.gg/emojis/9675-cat-heart.png" },
  { id: "1005", name: "Doge", url: "https://cdn3.emoji.gg/emojis/doge.png" },
  { id: "1006", name: "GG EZ", url: "https://cdn3.emoji.gg/emojis/6211_gg.png" },
  { id: "1007", name: "Pepe Laugh", url: "https://cdn3.emoji.gg/emojis/8410-pepelaugh.png" },
  { id: "1008", name: "KekW", url: "https://cdn3.emoji.gg/emojis/kekw.png" },
  { id: "1009", name: "Cat Jam", url: "https://cdn3.emoji.gg/emojis/3929_catJam.gif" },
];

export const EmojiGifPicker: React.FC<EmojiGifPickerProps> = ({
  onSelectEmoji,
  onSelectGif,
  onClose,
  guildId,
  guildName,
}) => {
  const [tab, setTab] = useState<"emoji" | "gif" | "sticker">("emoji");
  const [search, setSearch] = useState("");

  // Custom Discord Emojis
  const [serverEmojis, setServerEmojis] = useState<DiscordEmoji[]>([]);
  const [isLoadingEmojis, setIsLoadingEmojis] = useState(false);

  // Real GIFs
  const [gifs, setGifs] = useState<DiscordGif[]>([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);

  // Real Stickers
  const [serverStickers, setServerStickers] = useState<DiscordSticker[]>([]);
  const [stickerPacks, setStickerPacks] = useState<any[]>([]);
  const [isLoadingStickers, setIsLoadingStickers] = useState(false);

  // Load custom Discord emojis on mount or guild change
  useEffect(() => {
    if (!guildId) {
      setServerEmojis([]);
      return;
    }
    setIsLoadingEmojis(true);
    invoke<DiscordEmoji[]>("get_guild_emojis", { guildId })
      .then((emojis) => {
        setServerEmojis(emojis || []);
      })
      .catch((e) => {
        console.error("Failed to load guild emojis:", e);
        setServerEmojis([]);
      })
      .finally(() => setIsLoadingEmojis(false));
  }, [guildId]);

  // Load custom Discord stickers on mount or guild change
  useEffect(() => {
    if (!guildId) {
      setServerStickers([]);
      return;
    }
    setIsLoadingStickers(true);
    Promise.all([
      invoke<DiscordSticker[]>("get_guild_stickers", { guildId }).catch(() => []),
      invoke<any[]>("get_sticker_packs").catch(() => []),
    ])
      .then(([stickers, packs]) => {
        setServerStickers(stickers || []);
        setStickerPacks(packs || []);
      })
      .catch((e) => console.error("Failed to load stickers:", e))
      .finally(() => setIsLoadingStickers(false));
  }, [guildId]);

  // Load GIFs (trending on open, search on query with debounce)
  useEffect(() => {
    if (tab !== "gif") return;

    let isMounted = true;
    setIsLoadingGifs(true);

    const q = search.trim();
    const timer = setTimeout(
      () => {
        invoke<any[]>("search_gifs", { query: q })
          .then((rawGifs) => {
            if (!isMounted) return;
            const parsed: DiscordGif[] = (rawGifs || []).map((g: any) => {
              const src =
                g.src ||
                g.gif_src ||
                g.url ||
                g.media_formats?.gif?.url ||
                g.images?.fixed_height?.url ||
                g.images?.original?.url ||
                "";
              const preview =
                g.preview ||
                g.media_formats?.nanogif?.url ||
                g.media_formats?.tinygif?.url ||
                g.images?.fixed_height_small?.url ||
                src;
              return {
                id: g.id || src,
                title: g.title || g.description || "GIF",
                url: src,
                src,
                preview,
              };
            }).filter((g) => Boolean(g.url));

            setGifs(parsed);
          })
          .catch((err) => {
            console.error("Failed to fetch GIFs:", err);
            setGifs([]);
          })
          .finally(() => {
            if (isMounted) setIsLoadingGifs(false);
          });
      },
      q ? 350 : 0
    );

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [tab, search]);

  // Filtered server emojis by search
  const filteredServerEmojis = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^:|:$/g, "");
    if (!q) return serverEmojis;
    return serverEmojis.filter((e) => e.name.toLowerCase().includes(q));
  }, [serverEmojis, search]);

  // Filtered unicode emojis by search
  const filteredUnicodeEmojis = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return UNICODE_EMOJI_CATEGORIES;
    return UNICODE_EMOJI_CATEGORIES.map((cat) => ({
      name: cat.name,
      emojis: cat.emojis.filter((e) => e.includes(q)),
    })).filter((cat) => cat.emojis.length > 0);
  }, [search]);

  return (
    <div className="absolute bottom-16 right-4 w-96 h-[460px] glass-card rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 bg-[#0e111a]/98 backdrop-blur-2xl">
      {/* Header Tabs */}
      <div className="flex items-center justify-between p-2 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab("emoji")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === "emoji"
                ? "bg-[var(--accent)] text-black shadow-md"
                : "text-slate-300 hover:bg-white/10"
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Emoji</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("gif")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === "gif"
                ? "bg-[var(--accent)] text-black shadow-md"
                : "text-slate-300 hover:bg-white/10"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>GIFs</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("sticker")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === "sticker"
                ? "bg-[var(--accent)] text-black shadow-md"
                : "text-slate-300 hover:bg-white/10"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Stickers</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-2.5 border-b border-white/5 bg-black/20">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "emoji"
                ? "Search emojis or :name:..."
                : tab === "gif"
                ? "Search Tenor / GIFs..."
                : "Search stickers..."
            }
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--accent)] transition-all"
            autoFocus
          />
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 no-scrollbar space-y-4">
        {/* ======================= EMOJI TAB ======================= */}
        {tab === "emoji" && (
          <div className="space-y-4">
            {isLoadingEmojis && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-white/40">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                <span>Loading server emojis...</span>
              </div>
            )}
            {/* 1. Custom Server Emojis */}
            {serverEmojis.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 px-1 mb-2 flex items-center justify-between">
                  <span>{guildName || "Server"} Emojis</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/10 font-mono text-white/60">
                    {filteredServerEmojis.length}
                  </span>
                </div>
                {filteredServerEmojis.length === 0 ? (
                  <div className="text-xs text-white/30 px-1 py-1 italic">
                    No custom emojis match "{search}"
                  </div>
                ) : (
                  <div className="grid grid-cols-7 gap-1.5">
                    {filteredServerEmojis.map((emoji) => {
                      const ext = emoji.animated ? "gif" : "webp";
                      const emojiUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=64&quality=lossless`;
                      const token = emoji.animated
                        ? `<a:${emoji.name}:${emoji.id}>`
                        : `<:${emoji.name}:${emoji.id}>`;

                      return (
                        <button
                          key={emoji.id}
                          type="button"
                          onClick={() => onSelectEmoji(token)}
                          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/15 hover:scale-125 transition-all cursor-pointer p-1 group"
                          title={`:${emoji.name}:`}
                        >
                          <img
                            src={emojiUrl}
                            alt={emoji.name}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 2. Standard Unicode Categories */}
            {filteredUnicodeEmojis.map((cat) => (
              <div key={cat.name}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 px-1 mb-1.5">
                  {cat.name}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onSelectEmoji(emoji)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/15 hover:scale-125 transition-all text-lg cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ======================= GIF TAB ======================= */}
        {tab === "gif" && (
          <div>
            {isLoadingGifs ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-white/50">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                  <span>Loading real GIFs from Discord / Tenor...</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="aspect-video rounded-xl bg-white/5 animate-pulse"
                    />
                  ))}
                </div>
              </div>
            ) : gifs.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-xs text-white/40 space-y-2">
                <Film className="w-8 h-8 opacity-25" />
                <span>No GIFs found for "{search}"</span>
                <span className="text-[10px] text-white/20">Try searching "anime", "cat", "laugh", "hype"</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {gifs.map((gif, idx) => (
                  <div
                    key={`${gif.id}-${idx}`}
                    onClick={() => onSelectGif(gif.url)}
                    className="group relative rounded-xl overflow-hidden aspect-video bg-black/40 border border-white/10 hover:border-[var(--accent)] cursor-pointer transition-all hover:scale-[1.02] shadow-md"
                  >
                    <img
                      src={gif.preview || gif.url}
                      alt={gif.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-[10px] font-medium text-white truncate px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {gif.title}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ======================= STICKER TAB ======================= */}
        {tab === "sticker" && (
          <div className="space-y-4">
            {isLoadingStickers && (
              <div className="flex items-center justify-center gap-2 py-2 text-xs text-white/40">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
                <span>Loading stickers...</span>
              </div>
            )}

            {/* 1. Real Server Stickers */}
            {serverStickers.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 px-1 mb-2 flex items-center justify-between">
                  <span>{guildName || "Server"} Stickers</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/10 font-mono text-white/60">
                    {serverStickers.length}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {serverStickers.map((stk) => {
                    const stickerUrl = `https://cdn.discordapp.com/stickers/${stk.id}.png?size=160`;
                    return (
                      <button
                        key={stk.id}
                        type="button"
                        onClick={() => onSelectGif(stickerUrl)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center gap-1.5 transition-all hover:scale-105 cursor-pointer group"
                        title={stk.name}
                      >
                        <img
                          src={stickerUrl}
                          alt={stk.name}
                          className="w-16 h-16 object-contain group-hover:scale-110 transition-transform"
                          loading="lazy"
                        />
                        <span className="text-[10px] text-white/80 truncate w-full text-center font-medium">
                          {stk.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Official Discord Default Stickers */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 px-1 mb-2">
                Featured Stickers
              </div>
              <div className="grid grid-cols-3 gap-2">
                {DEFAULT_STICKERS.map((stk) => (
                  <button
                    key={stk.id}
                    type="button"
                    onClick={() => onSelectGif(stk.url)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center gap-1.5 transition-all hover:scale-105 cursor-pointer group"
                    title={stk.name}
                  >
                    <img
                      src={stk.url}
                      alt={stk.name}
                      className="w-14 h-14 object-contain group-hover:scale-110 transition-transform"
                      loading="lazy"
                    />
                    <span className="text-[10px] text-white/70 truncate w-full text-center">
                      {stk.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Official Discord Sticker Packs */}
            {stickerPacks.map((pack: any) => (
              <div key={pack.id || pack.name}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50 px-1 mb-2">
                  {pack.name}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(pack.stickers || []).slice(0, 15).map((stk: any) => {
                    const stickerUrl = `https://cdn.discordapp.com/stickers/${stk.id}.png?size=160`;
                    return (
                      <button
                        key={stk.id}
                        type="button"
                        onClick={() => onSelectGif(stickerUrl)}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center gap-1.5 transition-all hover:scale-105 cursor-pointer group"
                        title={stk.name}
                      >
                        <img
                          src={stickerUrl}
                          alt={stk.name}
                          className="w-14 h-14 object-contain group-hover:scale-110 transition-transform"
                          loading="lazy"
                        />
                        <span className="text-[10px] text-white/70 truncate w-full text-center">
                          {stk.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
