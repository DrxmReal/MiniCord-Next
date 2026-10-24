import React, { useState, useMemo } from "react";
import { Smile, Film, Sparkles, Search, X } from "lucide-react";

interface EmojiGifPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectGif: (url: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = [
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
    name: "Gestures",
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
    name: "Gaming & Anime",
    emojis: [
      "🎮", "🕹️", "🎯", "🎲", "🏆", "🥇", "🥈", "🥉", "👑", "💎", "⚔️", "🛡️",
      "🔮", "🪄", "🗡️", "🏹", "🎪", "🎭", "🎨", "🎬", "🎤", "🎧", "🎼", "🎹",
    ],
  },
];

const PRESET_GIFS = [
  {
    title: "Cat Jam",
    url: "https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif",
  },
  {
    title: "Pop Cat",
    url: "https://media.giphy.com/media/Nm8ZPAGOwZUQM/giphy.gif",
  },
  {
    title: "Anime Yay",
    url: "https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif",
  },
  {
    title: "Dancing Duck",
    url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDhqNXhpNDUzaWdudjNycXlhZDBjNzg2ZGNnbzMyaG9tYmtvems2dCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/kFgzrTt798d2w/giphy.gif",
  },
  {
    title: "Mind Blown",
    url: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif",
  },
  {
    title: "Applause",
    url: "https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif",
  },
  {
    title: "Cool Glasses",
    url: "https://media.giphy.com/media/62PP2yEIAZF6g/giphy.gif",
  },
  {
    title: "Yes Chad",
    url: "https://media.giphy.com/media/CAYVZA5NRb529kKQUc/giphy.gif",
  },
  {
    title: "Panda Rage",
    url: "https://media.giphy.com/media/10ECejStVOikMrNB22/giphy.gif",
  },
  {
    title: "Confused",
    url: "https://media.giphy.com/media/g01ZnwAUvutuK8GIQn/giphy.gif",
  },
  {
    title: "Hugs",
    url: "https://media.giphy.com/media/lrr9rHuoJOE0w/giphy.gif",
  },
  {
    title: "Party Dance",
    url: "https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif",
  },
];

const STICKERS = [
  { name: "Wumpus Wave", url: "https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png" },
  { name: "Poggers", url: "https://cdn3.emoji.gg/emojis/poggers.png" },
  { name: "Pepe Cool", url: "https://cdn3.emoji.gg/emojis/pepe_cool.png" },
  { name: "Cat Heart", url: "https://cdn3.emoji.gg/emojis/9675-cat-heart.png" },
  { name: "Doge", url: "https://cdn3.emoji.gg/emojis/doge.png" },
  { name: "GG EZ", url: "https://cdn3.emoji.gg/emojis/6211_gg.png" },
];

export const EmojiGifPicker: React.FC<EmojiGifPickerProps> = ({
  onSelectEmoji,
  onSelectGif,
  onClose,
}) => {
  const [tab, setTab] = useState<"emoji" | "gif" | "sticker">("emoji");
  const [search, setSearch] = useState("");

  const filteredEmojis = useMemo(() => {
    if (!search.trim()) return EMOJI_CATEGORIES;
    return EMOJI_CATEGORIES.map((cat) => ({
      name: cat.name,
      emojis: cat.emojis.filter((e) => e.includes(search)),
    })).filter((cat) => cat.emojis.length > 0);
  }, [search]);

  const filteredGifs = useMemo(() => {
    if (!search.trim()) return PRESET_GIFS;
    return PRESET_GIFS.filter((g) =>
      g.title.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <div className="absolute bottom-16 right-4 w-84 h-96 glass-card rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150 bg-[#0e111a]/95">
      {/* Header Tabs */}
      <div className="flex items-center justify-between p-2 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTab("emoji")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              tab === "emoji"
                ? "bg-[var(--accent)] text-black"
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
                ? "bg-[var(--accent)] text-black"
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
                ? "bg-[var(--accent)] text-black"
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

      {/* Search Input */}
      <div className="p-2 border-b border-white/5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "emoji"
                ? "Search emojis..."
                : tab === "gif"
                ? "Search GIFs..."
                : "Search stickers..."
            }
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* EMOJI TAB */}
        {tab === "emoji" && (
          <div className="space-y-3">
            {filteredEmojis.map((cat) => (
              <div key={cat.name}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/40 px-1 mb-1">
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

        {/* GIF TAB */}
        {tab === "gif" && (
          <div className="grid grid-cols-2 gap-2">
            {filteredGifs.map((gif) => (
              <div
                key={gif.url}
                onClick={() => onSelectGif(gif.url)}
                className="group relative rounded-xl overflow-hidden aspect-video bg-black/40 border border-white/10 hover:border-[var(--accent)] cursor-pointer transition-all hover:scale-[1.02]"
              >
                <img
                  src={gif.url}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 p-1 bg-gradient-to-t from-black/80 to-transparent text-[10px] font-medium text-white truncate px-2">
                  {gif.title}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STICKER TAB */}
        {tab === "sticker" && (
          <div className="grid grid-cols-3 gap-2">
            {STICKERS.map((stk) => (
              <button
                key={stk.name}
                type="button"
                onClick={() => onSelectGif(stk.url)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex flex-col items-center gap-1.5 transition-all hover:scale-105 cursor-pointer"
              >
                <img src={stk.url} alt={stk.name} className="w-12 h-12 object-contain" />
                <span className="text-[10px] text-white/70 truncate w-full text-center">
                  {stk.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
