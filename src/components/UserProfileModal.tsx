import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  X,
  MessageSquare,
  Calendar,
  Shield,
  Copy,
  Check,
  Sparkles,
} from "lucide-react";
import {
  DiscordUser,
  DiscordMember,
  DiscordRole,
  UserPresence,
  UserProfileData,
} from "../types";
import { StatusBadge } from "./StatusBadge";
import { formatMarkdownText } from "./EmbedCard";

interface UserProfileModalProps {
  user: DiscordUser | null;
  member?: DiscordMember | null;
  roles?: DiscordRole[];
  presence?: UserPresence;
  onClose: () => void;
  onOpenDM?: (userId: string) => void;
}

// Convert Discord snowflake ID to account creation Date
function getCreationDate(snowflake: string): string {
  try {
    const epoch = 1420070400000n;
    const ms = (BigInt(snowflake) >> 22n) + epoch;
    const date = new Date(Number(ms));
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Unknown";
  }
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  member,
  roles = [],
  presence,
  onClose,
  onOpenDM,
}) => {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    if (!user) return;

    invoke<any>("get_user_profile", { userId: user.id })
      .then((data) => {
        setProfile(data);
      })
      .catch((err) => {
        console.error("Failed to fetch full user profile:", err);
      });
  }, [user?.id]);

  if (!user) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const displayName = member?.nick || user.global_name || user.username;
  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
    : `https://cdn.discordapp.com/embed/avatars/${
        parseInt(user.discriminator || "0") % 5
      }.png`;

  const bannerHash = profile?.user?.banner || user.banner;
  const bannerUrl = bannerHash
    ? `https://cdn.discordapp.com/banners/${user.id}/${bannerHash}.png?size=600`
    : null;

  const accentColorHex = profile?.user?.accent_color
    ? `#${profile.user.accent_color.toString(16).padStart(6, "0")}`
    : profile?.user?.banner_color || null;

  const bio =
    profile?.user_profile?.bio || profile?.user?.bio || user.bio || null;
  const pronouns = profile?.user_profile?.pronouns;

  // Joined server formatted date
  const joinedDate = member?.joined_at
    ? new Date(member.joined_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const creationDate = getCreationDate(user.id);

  // User roles in current guild
  const userRoles = member
    ? roles.filter((r) => member.roles.includes(r.id))
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#0e1017]/90 rounded-3xl border border-white/10 shadow-2xl overflow-hidden backdrop-blur-3xl text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner Area */}
        <div
          className="relative h-32 w-full bg-cover bg-center overflow-hidden shrink-0"
          style={{
            backgroundColor: accentColorHex || "var(--accent)",
            backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1017] via-transparent to-black/20" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/80 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Card Body */}
        <div className="px-5 pb-5 -mt-12 flex-1 flex flex-col">
          {/* Avatar & Badges */}
          <div className="flex items-end justify-between mb-3">
            <div className="relative">
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-20 h-20 rounded-2xl object-cover bg-black border-4 border-[#0e1017] shadow-xl"
              />
              <StatusBadge
                status={presence?.status || "offline"}
                size="lg"
                className="absolute -bottom-1 -right-1"
              />
            </div>

            {/* Actions button */}
            <div className="flex items-center gap-2">
              {onOpenDM && (
                <button
                  onClick={() => {
                    onOpenDM(user.id);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent)] text-black text-xs font-bold hover:bg-[var(--accent-hover)] transition-all cursor-pointer shadow-md"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Message
                </button>
              )}

              <button
                onClick={handleCopyId}
                className="p-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Copy User ID"
              >
                {copiedId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Name & Pronouns */}
          <div className="mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white truncate">
                {displayName}
              </h2>
              {pronouns && (
                <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-medium">
                  {pronouns}
                </span>
              )}
            </div>

            <div className="text-xs text-slate-400 flex items-center gap-1">
              <span>@{user.username}</span>
              {user.discriminator && user.discriminator !== "0" && (
                <span>#{user.discriminator}</span>
              )}
            </div>

            {/* Custom Status / Activity */}
            {(presence?.custom_status || presence?.activity) && (
              <div className="mt-2 text-xs text-slate-300 bg-white/5 border border-white/5 rounded-xl px-2.5 py-1.5 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
                <span className="truncate">
                  {presence.custom_status || presence.activity}
                </span>
              </div>
            )}
          </div>

          <div className="h-px bg-white/10 my-2" />

          {/* Bio / About Me */}
          {bio && (
            <div className="mb-3">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                About Me
              </h3>
              <div className="text-xs text-slate-200 leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap">
                {formatMarkdownText(bio)}
              </div>
            </div>
          )}

          {/* Dates (Created & Joined) */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-white/5 rounded-xl p-2 border border-white/5">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                <Calendar className="w-3 h-3 text-[var(--accent)]" />
                Discord Member
              </div>
              <div className="text-xs font-medium text-slate-200">
                {creationDate}
              </div>
            </div>

            {joinedDate && (
              <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  Server Member
                </div>
                <div className="text-xs font-medium text-slate-200">
                  {joinedDate}
                </div>
              </div>
            )}
          </div>

          {/* Server Roles */}
          {userRoles.length > 0 && (
            <div className="mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Roles — {userRoles.length}
              </h3>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                {userRoles.map((role) => {
                  const roleColor =
                    role.color !== 0
                      ? `#${role.color.toString(16).padStart(6, "0")}`
                      : undefined;
                  return (
                    <div
                      key={role.id}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300"
                    >
                      {roleColor && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: roleColor }}
                        />
                      )}
                      <span className="truncate max-w-[120px]">{role.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
