import React, { useState } from "react";
import { ExternalLink, Hash, Users, ShieldAlert, Copy, Check } from "lucide-react";
import { DiscordEmbed, MentionContext } from "../types";

interface EmbedCardProps {
  embed: DiscordEmbed;
  onOpenImage?: (url: string) => void;
  mentionContext?: MentionContext;
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

export const CodeBlock: React.FC<{ lang?: string; code: string }> = ({ lang, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-white/10 bg-[#121316] shadow-md font-mono text-xs select-text">
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/5 text-[11px] text-white/50 select-none">
        <span className="uppercase font-semibold tracking-wider text-[var(--accent)] font-mono">
          {lang || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-white/60"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-sans">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="font-sans">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-slate-200 leading-relaxed font-mono whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
};

// Formats inline tokens (bold, emoji, mentions, links, spoilers)
const formatInlineTokens = (text: string, context?: MentionContext): React.ReactNode => {
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
    const chMatch = part.match(/^<#(\d+)>$/);
    if (chMatch) {
      const chId = chMatch[1];
      const ch = context?.channels?.find((c) => c.id === chId);
      const chName = ch ? ch.name : "channel";
      return (
        <span
          key={idx}
          onClick={() => ch && context?.onSelectChannel?.(ch)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[var(--accent-dim)] text-[var(--accent)] font-semibold text-xs hover:bg-[var(--accent)] hover:text-black cursor-pointer transition-colors"
          title={`#${chName}`}
        >
          <Hash className="w-3 h-3 inline" />
          <span>{chName}</span>
        </span>
      );
    }

    // Role mention <@&id>
    const roleMatch = part.match(/^<@&(\d+)>$/);
    if (roleMatch) {
      const roleId = roleMatch[1];
      const role = context?.roles?.find((r) => r.id === roleId);
      const roleName = role ? role.name : "role";
      const roleColor =
        role?.color && role.color !== 0
          ? `#${role.color.toString(16).padStart(6, "0")}`
          : undefined;

      return (
        <span
          key={idx}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-semibold text-xs"
          style={{
            backgroundColor: roleColor ? `${roleColor}25` : "rgba(59, 130, 246, 0.2)",
            color: roleColor || "#93c5fd",
          }}
          title={`@${roleName}`}
        >
          <Users className="w-3 h-3 inline" />
          <span>@{roleName}</span>
        </span>
      );
    }

    // User mention <@id> or <@!id>
    const userMatch = part.match(/^<@!?(\d+)>$/);
    if (userMatch) {
      const userId = userMatch[1];
      let foundUser = context?.mentions?.find((u) => u.id === userId);
      if (!foundUser && context?.currentUser && context.currentUser.id === userId) {
        foundUser = context.currentUser;
      }
      let memberNick: string | null = null;
      if (context?.members) {
        const mem = context.members.find((m) => m.user.id === userId);
        if (mem) {
          if (!foundUser) foundUser = mem.user;
          if (mem.nick) memberNick = mem.nick;
        }
      }

      const displayName =
        memberNick ||
        foundUser?.global_name ||
        foundUser?.username ||
        (context?.currentUser?.id === userId
          ? context.currentUser.global_name || context.currentUser.username
          : null) ||
        `User`;

      return (
        <span
          key={idx}
          onClick={() => {
            if (foundUser && context?.onSelectUser) {
              context.onSelectUser(foundUser);
            }
          }}
          className={`inline-flex items-center px-1.5 py-0.5 rounded-md bg-[var(--accent-dim)] text-[var(--accent)] font-semibold text-xs hover:bg-[var(--accent)] hover:text-black transition-colors ${
            foundUser && context?.onSelectUser ? "cursor-pointer" : ""
          }`}
          title={foundUser ? `@${foundUser.username}` : `@${userId}`}
        >
          @{displayName}
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
      return <SpoilerText key={idx}>{formatInlineTokens(inner, context)}</SpoilerText>;
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
        <strong key={idx} className="font-bold italic">
          {formatInlineTokens(part.slice(3, -3), context)}
        </strong>
      );
    }

    // Bold **text**
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-bold text-white">
          {formatInlineTokens(part.slice(2, -2), context)}
        </strong>
      );
    }

    // Italic *text*
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={idx} className="italic text-slate-200">
          {formatInlineTokens(part.slice(1, -1), context)}
        </em>
      );
    }

    // Underline __text__
    if (part.startsWith("__") && part.endsWith("__")) {
      return (
        <u key={idx} className="underline">
          {formatInlineTokens(part.slice(2, -2), context)}
        </u>
      );
    }

    // Strikethrough ~~text~~
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return (
        <s key={idx} className="line-through text-white/50">
          {formatInlineTokens(part.slice(2, -2), context)}
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

export const formatMarkdownText = (
  text: string,
  context?: MentionContext
): React.ReactNode => {
  if (!text) return null;

  // 1. Parse multiline code blocks first
  const blocks: Array<
    | { type: "code"; lang: string; code: string }
    | { type: "text"; lines: string[] }
  > = [];

  const rawLines = text.split("\n");
  let inCodeBlock = false;
  let currentCodeLang = "";
  let currentCodeLines: string[] = [];
  let currentTextLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const fenceMatch = line.match(/^```([a-zA-Z0-9_\-\+]*)\s*$/);

    if (!inCodeBlock && fenceMatch) {
      if (currentTextLines.length > 0) {
        blocks.push({ type: "text", lines: currentTextLines });
        currentTextLines = [];
      }
      inCodeBlock = true;
      currentCodeLang = fenceMatch[1] || "";
      currentCodeLines = [];
    } else if (inCodeBlock && line.trim() === "```") {
      inCodeBlock = false;
      blocks.push({
        type: "code",
        lang: currentCodeLang,
        code: currentCodeLines.join("\n"),
      });
      currentCodeLang = "";
      currentCodeLines = [];
    } else if (inCodeBlock) {
      currentCodeLines.push(line);
    } else {
      currentTextLines.push(line);
    }
  }

  // Flush remaining
  if (inCodeBlock) {
    blocks.push({
      type: "code",
      lang: currentCodeLang,
      code: currentCodeLines.join("\n"),
    });
  } else if (currentTextLines.length > 0) {
    blocks.push({ type: "text", lines: currentTextLines });
  }

  return blocks.map((block, bIdx) => {
    if (block.type === "code") {
      return (
        <CodeBlock
          key={`cb-${bIdx}`}
          lang={block.lang}
          code={block.code}
        />
      );
    }

    return block.lines.map((line, lineIdx) => {
      const trimmed = line.trim();

      // Heading 1 (# Title)
      if (trimmed.startsWith("# ")) {
        return (
          <div
            key={`h1-${bIdx}-${lineIdx}`}
            className="text-lg font-bold text-white mt-2 mb-1 border-b border-white/10 pb-0.5"
          >
            {formatInlineTokens(trimmed.slice(2), context)}
          </div>
        );
      }

      // Heading 2 (## Title)
      if (trimmed.startsWith("## ")) {
        return (
          <div
            key={`h2-${bIdx}-${lineIdx}`}
            className="text-base font-bold text-white mt-1.5 mb-1"
          >
            {formatInlineTokens(trimmed.slice(3), context)}
          </div>
        );
      }

      // Heading 3 (### Title)
      if (trimmed.startsWith("### ")) {
        return (
          <div
            key={`h3-${bIdx}-${lineIdx}`}
            className="text-xs font-bold text-white/90 mt-1 mb-0.5 uppercase tracking-wide"
          >
            {formatInlineTokens(trimmed.slice(4), context)}
          </div>
        );
      }

      // Bullet lists (- item or * item)
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        return (
          <div
            key={`li-${bIdx}-${lineIdx}`}
            className="flex items-start gap-2 pl-2.5 py-0.5"
          >
            <span className="text-[var(--accent)] font-bold text-xs select-none">
              •
            </span>
            <span className="flex-1 text-slate-200">
              {formatInlineTokens(trimmed.slice(2), context)}
            </span>
          </div>
        );
      }

      // Blockquote (> text)
      if (trimmed.startsWith("> ")) {
        return (
          <blockquote
            key={`bq-${bIdx}-${lineIdx}`}
            className="border-l-4 border-white/20 pl-2.5 my-1 text-slate-300 italic"
          >
            {formatInlineTokens(trimmed.slice(2), context)}
          </blockquote>
        );
      }

      // Regular line
      return (
        <div key={`l-${bIdx}-${lineIdx}`} className="min-h-[1.25rem]">
          {formatInlineTokens(line, context)}
        </div>
      );
    });
  });
};

export const EmbedCard: React.FC<EmbedCardProps> = ({
  embed,
  onOpenImage,
  mentionContext,
}) => {
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
              {formatMarkdownText(embed.description, mentionContext)}
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
                {formatMarkdownText(field.value, mentionContext)}
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
