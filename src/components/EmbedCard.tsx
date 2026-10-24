import React, { useState } from "react";
import { ExternalLink, Hash, Users, ShieldAlert } from "lucide-react";
import { DiscordEmbed } from "../types";

interface EmbedCardProps {
  embed: DiscordEmbed;
  onOpenImage?: (url: string) => void;
}

export const SpoilerText: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={() => setRevealed(true)}
      className={`rounded px-1.5 py-0.5 transition-all cursor-pointer inline ${
        revealed
          ? "bg-white/10 text-slate-100"
          : "bg-white/20 text-transparent hover:bg-white/30 rounded-md select-none"
      }`}
      title={revealed ? "" : "Click to reveal spoiler"}
    >
      {children}
    </span>
  );
};

// Formats inline tokens (bold, emoji, mentions, links, spoilers)
const formatInlineTokens = (text: string): React.ReactNode => {
  if (!text) return null;

  const tokenRegex =
    /(<a?:\w+:\d+>|<#\d+>|<@&\d+>|<@!?\d+>|@everyone|@here|\|\|[\s\S]+?\|\||\[[^\]]+\]\(https?:\/\/[^\s\)]+\)|\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|~~[^~]+~~|`[^`]+`|https?:\/\/[^\s]+|discord\.gg\/[^\s]+)/g;

  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (!part) return null;

    // Discord custom emoji <:name:id> or <a:name:id>
    const emojiMatch = part.match(/^<(a)?:(\w+):(\d+)>$/);
    if (emojiMatch) {
      const isAnimated = Boolean(emojiMatch[1]);
      const emojiName = emojiMatch[2];
      const emojiId = emojiMatch[3];
      const ext = isAnimated ? "gif" : "webp";
      const emojiUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}?size=48&quality=lossless`;
      return (
        <img
          key={idx}
          src={emojiUrl}
          alt={`:${emojiName}:`}
          title={`:${emojiName}:`}
          className="inline-block w-5 h-5 align-sub mx-0.5 object-contain hover:scale-125 transition-transform"
          loading="lazy"
        />
      );
    }

    // Channel mention <#id>
    if (part.match(/^<#\d+>$/)) {
      return (
        <span
          key={idx}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[var(--accent-dim)] text-[var(--accent)] font-semibold text-xs hover:bg-[var(--accent)] hover:text-black cursor-pointer transition-colors"
        >
          <Hash className="w-3 h-3 inline" />
          <span>channel</span>
        </span>
      );
    }

    // Role mention <@&id>
    if (part.match(/^<@&\d+>$/)) {
      return (
        <span
          key={idx}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-semibold text-xs"
        >
          <Users className="w-3 h-3 inline" />
          <span>@role</span>
        </span>
      );
    }

    // User mention <@id> or <@!id>
    if (part.match(/^<@!?\d+>$/)) {
      return (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--accent-dim)] text-[var(--accent)] font-semibold text-xs"
        >
          @user
        </span>
      );
    }

    // @everyone or @here
    if (part === "@everyone" || part === "@here") {
      return (
        <span
          key={idx}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-xs"
        >
          <ShieldAlert className="w-3 h-3 inline" />
          <span>{part}</span>
        </span>
      );
    }

    // Spoiler ||text||
    if (part.startsWith("||") && part.endsWith("||") && part.length >= 4) {
      const inner = part.slice(2, -2);
      return <SpoilerText key={idx}>{formatInlineTokens(inner)}</SpoilerText>;
    }

    // Markdown link [title](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)$/);
    if (linkMatch) {
      const title = linkMatch[1];
      const href = linkMatch[2];
      const isSticker = href.includes("discordapp.net/stickers/") || href.match(/\.(png|jpe?g|webp|gif)/i);

      return (
        <span key={idx} className="inline-flex items-center gap-1">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-[var(--accent)] hover:underline inline-flex items-center gap-0.5 font-medium"
          >
            <span>{title}</span>
            <ExternalLink className="w-3 h-3 inline opacity-70" />
          </a>
          {isSticker && (
            <img
              src={href}
              alt={title}
              className="inline-block w-8 h-8 rounded-lg object-contain bg-black/30 border border-white/10 p-0.5 align-middle"
              loading="lazy"
            />
          )}
        </span>
      );
    }

    // Bold italic ***text***
    if (part.startsWith("***") && part.endsWith("***")) {
      return (
        <strong key={idx} className="italic font-bold">
          {formatInlineTokens(part.slice(3, -3))}
        </strong>
      );
    }

    // Bold **text**
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-bold">
          {formatInlineTokens(part.slice(2, -2))}
        </strong>
      );
    }

    // Italic *text*
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={idx} className="italic">
          {formatInlineTokens(part.slice(1, -1))}
        </em>
      );
    }

    // Underline __text__
    if (part.startsWith("__") && part.endsWith("__")) {
      return (
        <u key={idx} className="underline">
          {formatInlineTokens(part.slice(2, -2))}
        </u>
      );
    }

    // Strikethrough ~~text~~
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return (
        <s key={idx} className="line-through text-white/50">
          {formatInlineTokens(part.slice(2, -2))}
        </s>
      );
    }

    // Inline code `code`
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded-md bg-black/40 text-[var(--accent)] font-mono text-xs border border-white/10"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Raw URL
    if (part.match(/^(https?:\/\/|discord\.gg\/)/)) {
      const href = part.startsWith("discord.gg/") ? `https://${part}` : part;
      return (
        <a
          key={idx}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-[var(--accent)] hover:underline inline-flex items-center gap-0.5 font-medium break-all"
        >
          <span>{part}</span>
          <ExternalLink className="w-3 h-3 inline opacity-70 shrink-0" />
        </a>
      );
    }

    return part;
  });
};

export const formatMarkdownText = (text: string): React.ReactNode => {
  if (!text) return null;

  // Split into lines to parse headings and bullet points
  const lines = text.split("\n");

  return lines.map((line, lineIdx) => {
    const trimmed = line.trim();

    // 1. Heading 1 (# Title)
    if (trimmed.startsWith("# ")) {
      return (
        <div key={lineIdx} className="text-lg font-bold text-white mt-2 mb-1 border-b border-white/10 pb-0.5">
          {formatInlineTokens(trimmed.slice(2))}
        </div>
      );
    }

    // 2. Heading 2 (## Title)
    if (trimmed.startsWith("## ")) {
      return (
        <div key={lineIdx} className="text-base font-bold text-white mt-1.5 mb-1">
          {formatInlineTokens(trimmed.slice(3))}
        </div>
      );
    }

    // 3. Heading 3 (### Title)
    if (trimmed.startsWith("### ")) {
      return (
        <div key={lineIdx} className="text-xs font-bold text-white/90 mt-1 mb-0.5 uppercase tracking-wide">
          {formatInlineTokens(trimmed.slice(4))}
        </div>
      );
    }

    // 4. Bullet lists (- item or * item)
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return (
        <div key={lineIdx} className="flex items-start gap-2 pl-2.5 py-0.5">
          <span className="text-[var(--accent)] font-bold text-xs select-none">•</span>
          <span className="flex-1 text-slate-200">{formatInlineTokens(trimmed.slice(2))}</span>
        </div>
      );
    }

    // 5. Blockquote (> text)
    if (trimmed.startsWith("> ")) {
      return (
        <blockquote key={lineIdx} className="border-l-4 border-white/20 pl-2.5 my-1 text-slate-300 italic">
          {formatInlineTokens(trimmed.slice(2))}
        </blockquote>
      );
    }

    // 6. Regular line
    return (
      <div key={lineIdx} className="min-h-[1.25rem]">
        {formatInlineTokens(line)}
      </div>
    );
  });
};

export const EmbedCard: React.FC<EmbedCardProps> = ({ embed, onOpenImage }) => {
  const embedColor = embed.color
    ? `#${embed.color.toString(16).padStart(6, "0")}`
    : "var(--accent)";

  return (
    <div
      className="max-w-xl rounded-xl overflow-hidden glass-card my-1 p-3 border border-white/10 bg-black/40 flex flex-col gap-2 relative shadow-lg"
      style={{ borderLeft: `4px solid ${embedColor}` }}
    >
      {/* Author */}
      {embed.author && (
        <div className="flex items-center gap-2 text-xs font-semibold text-white/90">
          {embed.author.icon_url && (
            <img
              src={embed.author.icon_url}
              alt=""
              className="w-5 h-5 rounded-full object-cover"
              loading="lazy"
            />
          )}
          {embed.author.url ? (
            <a
              href={embed.author.url}
              target="_blank"
              rel="noreferrer"
              className="hover:underline text-white flex items-center gap-1"
            >
              <span>{embed.author.name}</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          ) : (
            <span>{embed.author.name}</span>
          )}
        </div>
      )}

      {/* Title & Thumbnail Grid */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          {embed.title && (
            <div className="text-sm font-bold text-white">
              {embed.url ? (
                <a
                  href={embed.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline text-[var(--accent)] flex items-center gap-1"
                >
                  <span>{embed.title}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span>{embed.title}</span>
              )}
            </div>
          )}

          {/* Description */}
          {embed.description && (
            <div className="text-xs text-slate-300 leading-snug break-words">
              {formatMarkdownText(embed.description)}
            </div>
          )}
        </div>

        {/* Thumbnail */}
        {embed.thumbnail && (
          <img
            src={embed.thumbnail.url}
            alt=""
            className="w-16 h-16 rounded-lg object-contain bg-black/50 shrink-0 cursor-pointer hover:opacity-90 border border-white/5"
            onClick={() => onOpenImage && onOpenImage(embed.thumbnail!.url)}
            loading="lazy"
          />
        )}
      </div>

      {/* Fields */}
      {embed.fields && embed.fields.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-1">
          {embed.fields.map((field, idx) => (
            <div
              key={idx}
              className={`space-y-0.5 ${field.inline ? "" : "col-span-full"}`}
            >
              <div className="text-[11px] font-bold text-white/80">
                {field.name}
              </div>
              <div className="text-xs text-slate-300 break-words leading-snug">
                {formatMarkdownText(field.value)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Big Image */}
      {embed.image && (
        <div className="mt-1.5 rounded-lg overflow-hidden border border-white/10 max-h-72 bg-black/60 cursor-pointer">
          <img
            src={embed.image.url}
            alt=""
            className="w-full max-h-72 object-contain hover:scale-[1.01] transition-transform"
            onClick={() => onOpenImage && onOpenImage(embed.image!.url)}
            loading="lazy"
          />
        </div>
      )}

      {/* Footer */}
      {(embed.footer || embed.timestamp) && (
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/40 font-mono">
          {embed.footer?.icon_url && (
            <img
              src={embed.footer.icon_url}
              alt=""
              className="w-3.5 h-3.5 rounded-full object-cover"
              loading="lazy"
            />
          )}
          {embed.footer?.text && <span>{embed.footer.text}</span>}
          {embed.footer?.text && embed.timestamp && <span>•</span>}
          {embed.timestamp && (
            <span>{new Date(embed.timestamp).toLocaleString()}</span>
          )}
        </div>
      )}
    </div>
  );
};
