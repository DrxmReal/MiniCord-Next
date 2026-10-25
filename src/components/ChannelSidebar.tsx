import React, { useState, useMemo } from "react";
import {
  Hash,
  Volume2,
  Mic,
  MicOff,
  Headphones,
  Settings,
  ChevronDown,
  ChevronRight,
  Megaphone,
  MessageSquare,
  User,
  Users,
  Copy,
} from "lucide-react";
import {
  DiscordChannel,
  DiscordGuild,
  DiscordUser,
  DiscordDMChannel,
  UserPresence,
} from "../types";
import { StatusBadge } from "./StatusBadge";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";

interface ChannelSidebarProps {
  activeGuild: DiscordGuild | null;
  channels: DiscordChannel[];
  dms: DiscordDMChannel[];
  activeChannelId: string | null;
  currentUser: DiscordUser | null;
  onSelectChannel: (channel: DiscordChannel) => void;
  onOpenSettings?: () => void;
  presences?: Record<string, UserPresence>;
  isFriendsTabActive?: boolean;
  onSelectFriendsTab?: () => void;
}

// Compare Discord Snowflakes descending (newest timestamp first)
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

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  activeGuild,
  channels,
  dms,
  activeChannelId,
  currentUser,
  onSelectChannel,
  onOpenSettings,
  presences = {},
  isFriendsTabActive = false,
  onSelectFriendsTab,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  // 1. DMs Sorted by Most Recent Message First
  const sortedDms = useMemo(() => {
    return [...dms].sort((a, b) => {
      const timeA = a.last_message_id || a.id;
      const timeB = b.last_message_id || b.id;
      return compareSnowflakesDesc(timeA, timeB);
    });
  }, [dms]);

  // 2. Server Channels Grouped by Category & Sorted by Discord Position
  const { uncategorizedChannels, categoryGroups } = useMemo(() => {
    if (!activeGuild) return { uncategorizedChannels: [], categoryGroups: [] };

    // Categories are type === 4
    const categories = channels
      .filter((c) => c.type === 4)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    // Channels with no category (parent_id is null/undefined)
    const uncategorized = channels
      .filter((c) => c.type !== 4 && !c.parent_id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    // Group channels by their category parent_id
    const groups = categories.map((cat) => {
      const catChannels = channels
        .filter((c) => c.parent_id === cat.id && c.type !== 4)
        .sort((a, b) => {
          const posA = a.position ?? 0;
          const posB = b.position ?? 0;
          if (posA !== posB) return posA - posB;
          return a.type === 2 ? 1 : -1;
        });
      return { category: cat, channels: catChannels };
    });

    return { uncategorizedChannels: uncategorized, categoryGroups: groups };
  }, [activeGuild, channels]);

  const userAvatarUrl = currentUser?.avatar
    ? `https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png?size=80`
    : null;

  const handleDmContextMenu = (e: React.MouseEvent, dm: DiscordDMChannel) => {
    e.preventDefault();
    e.stopPropagation();

    const recipient = dm.recipients?.[0];
    const items: ContextMenuItem[] = [
      {
        label: "Copy User ID",
        icon: <Copy className="w-3.5 h-3.5" />,
        onClick: () => {
          if (recipient) navigator.clipboard.writeText(recipient.id);
        },
      },
      {
        label: "Copy Channel ID",
        icon: <Hash className="w-3.5 h-3.5" />,
        onClick: () => {
          navigator.clipboard.writeText(dm.id);
        },
      },
    ];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items,
    });
  };

  // Render individual channel item
  const renderChannelItem = (channel: DiscordChannel) => {
    const isActive = activeChannelId === channel.id;
    const isVoice = channel.type === 2;
    const isAnnouncement = channel.type === 5;
    const isForum = channel.type === 15;

    return (
      <button
        key={channel.id}
        onClick={() => onSelectChannel(channel)}
        className={`w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all cursor-pointer select-none group ${
          isActive
            ? "bg-[var(--accent-dim)] text-[var(--accent)] font-medium"
            : "text-slate-300 hover:bg-white/5 hover:text-white"
        }`}
      >
        {isVoice ? (
          <Volume2
            className={`w-4 h-4 shrink-0 ${
              isActive ? "text-[var(--accent)]" : "text-slate-400 group-hover:text-slate-300"
            }`}
          />
        ) : isAnnouncement ? (
          <Megaphone
            className={`w-4 h-4 shrink-0 ${
              isActive ? "text-[var(--accent)]" : "text-slate-400 group-hover:text-slate-300"
            }`}
          />
        ) : isForum ? (
          <MessageSquare
            className={`w-4 h-4 shrink-0 ${
              isActive ? "text-[var(--accent)]" : "text-slate-400 group-hover:text-slate-300"
            }`}
          />
        ) : (
          <Hash
            className={`w-4 h-4 shrink-0 ${
              isActive ? "text-[var(--accent)]" : "text-slate-400 group-hover:text-slate-300"
            }`}
          />
        )}
        <span className="truncate">{channel.name}</span>
      </button>
    );
  };

  return (
    <aside className="w-60 h-full flex flex-col bg-[var(--bg-sidebar)]/90 backdrop-blur-xl border-r border-white/5 select-none shrink-0">
      {/* Sidebar Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-white/5 font-semibold text-white/90 cursor-pointer hover:bg-white/5 transition-colors">
        <span className="truncate">{activeGuild ? activeGuild.name : "Direct Messages"}</span>
        {activeGuild && <ChevronDown className="w-4 h-4 text-white/50 shrink-0" />}
      </div>

      {/* Main Channels & DMs Scrollable View */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3">
        {/* ===================== SERVER VIEW ===================== */}
        {activeGuild ? (
          <div className="space-y-3">
            {/* 1. Uncategorized Channels at Top */}
            {uncategorizedChannels.length > 0 && (
              <div className="space-y-0.5">
                {uncategorizedChannels.map(renderChannelItem)}
              </div>
            )}

            {/* 2. Categorized Channels */}
            {categoryGroups.map(({ category, channels: groupChannels }) => {
              const isCollapsed = collapsedCategories[category.id] ?? false;

              return (
                <div key={category.id} className="space-y-1">
                  {/* Category Header with Collapse Toggle */}
                  <div
                    onClick={() => toggleCategory(category.id)}
                    className="flex items-center gap-1.5 px-1 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400/90 hover:text-white cursor-pointer transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="truncate">{category.name}</span>
                  </div>

                  {/* Channels inside Category */}
                  {!isCollapsed && groupChannels.length > 0 && (
                    <div className="space-y-0.5 pl-1">
                      {groupChannels.map(renderChannelItem)}
                    </div>
                  )}
                </div>
              );
            })}

            {uncategorizedChannels.length === 0 && categoryGroups.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-white/40">
                No accessible channels in this server
              </div>
            )}
          </div>
        ) : (
          /* ===================== DIRECT MESSAGES VIEW ===================== */
          <div>
            {/* Friends Navigation Item */}
            <button
              onClick={() => onSelectFriendsTab?.()}
              className={`w-full px-2.5 py-2 mb-2 rounded-xl flex items-center gap-2.5 transition-all text-left cursor-pointer group ${
                isFriendsTabActive
                  ? "bg-[var(--accent-dim)] text-white border-l-2 border-[var(--accent)] font-medium"
                  : "text-slate-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Users
                  className={`w-4 h-4 ${
                    isFriendsTabActive ? "text-[var(--accent)]" : "text-slate-300"
                  }`}
                />
              </div>
              <span className="text-sm font-medium">Friends</span>
            </button>

            <div className="px-2 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400/80 flex items-center justify-between">
              <span>Direct Messages</span>
              <span className="text-[10px] text-white/30 font-mono">{sortedDms.length}</span>
            </div>

            {sortedDms.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-white/40">
                Loading conversations...
              </div>
            ) : (
              <div className="space-y-1">
                {sortedDms.map((dm) => {
                  const isActive = activeChannelId === dm.id;
                  const isGroup = dm.type === 3;
                  const recipient = dm.recipients?.[0];
                  const displayName = isGroup
                    ? dm.name || dm.recipients?.map((r) => r.username).join(", ") || "Group Chat"
                    : recipient?.global_name || recipient?.username || "Unknown User";

                  const avatarUrl = recipient?.avatar
                    ? `https://cdn.discordapp.com/avatars/${recipient.id}/${recipient.avatar}.png?size=64`
                    : null;

                  const presence = recipient ? presences[recipient.id] : null;

                  return (
                    <button
                      key={dm.id}
                      onClick={() =>
                        onSelectChannel({
                          id: dm.id,
                          name: displayName,
                          type: dm.type,
                          recipient: recipient || null,
                        })
                      }
                      onContextMenu={(e) => handleDmContextMenu(e, dm)}
                      className={`w-full px-2.5 py-2 rounded-xl flex items-center gap-2.5 transition-all text-left cursor-pointer group ${
                        isActive
                          ? "bg-[var(--accent-dim)] text-white border-l-2 border-[var(--accent)]"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {/* Avatar with live Discord Presence Badge */}
                      <div className="relative w-8 h-8 shrink-0">
                        <div className="w-full h-full rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                          {isGroup ? (
                            <Users className="w-4 h-4 text-white/70" />
                          ) : avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={displayName}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-xs font-bold text-white/80">
                              {displayName[0]?.toUpperCase() || <User className="w-4 h-4" />}
                            </span>
                          )}
                        </div>

                        {/* Status Badge */}
                        {!isGroup && (
                          <StatusBadge
                            status={presence?.status}
                            size="sm"
                            className="absolute -bottom-0.5 -right-0.5"
                          />
                        )}
                      </div>

                      {/* Display Name & Status / Handle */}
                      <div className="flex-1 overflow-hidden">
                        <div className="text-xs font-medium truncate text-white">
                          {displayName}
                        </div>
                        {presence?.activity ? (
                          <div className="text-[10px] text-[var(--accent)] truncate font-medium">
                            {presence.activity}
                          </div>
                        ) : !isGroup && recipient?.username ? (
                          <div className="text-[10px] text-white/40 truncate font-mono">
                            @{recipient.username}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom User Profile Capsule */}
      <div className="p-2 border-t border-white/5 bg-[var(--bg-deep)]/40">
        <div className="flex items-center justify-between p-1.5 rounded-xl bg-white/5 backdrop-blur-md">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="relative w-8 h-8 shrink-0">
              <div className="w-full h-full rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
                {userAvatarUrl ? (
                  <img src={userAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="font-bold text-xs text-white">
                    {currentUser?.username?.[0]?.toUpperCase() || "U"}
                  </div>
                )}
              </div>
              <StatusBadge status="online" size="sm" className="absolute -bottom-0.5 -right-0.5" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-white truncate">
                {currentUser?.global_name || currentUser?.username || "Discord User"}
              </div>
              <div className="text-[10px] text-white/50 truncate font-mono">
                @{currentUser?.username || "user"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5 text-slate-400">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-1.5 rounded-md hover:bg-white/10 hover:text-white transition-colors cursor-pointer ${
                isMuted ? "text-red-400" : ""
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setIsDeafened(!isDeafened)}
              className={`p-1.5 rounded-md hover:bg-white/10 hover:text-white transition-colors cursor-pointer ${
                isDeafened ? "text-red-400" : ""
              }`}
              title={isDeafened ? "Undeafen" : "Deafen"}
            >
              <Headphones className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-md hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenu.items}
          onClose={() => setContextMenu(null)}
        />
      )}
    </aside>
  );
};
