import React, { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, Crown, X } from "lucide-react";
import {
  DiscordGuild,
  DiscordMember,
  DiscordRole,
  DiscordUser,
  UserPresence,
} from "../types";
import { StatusBadge } from "./StatusBadge";

interface MemberListProps {
  activeGuild: DiscordGuild | null;
  presences: Record<string, UserPresence>;
  onSelectUser: (user: DiscordUser, member?: DiscordMember) => void;
  onClose?: () => void;
  initialMembers?: DiscordMember[];
}

interface MemberGroup {
  id: string;
  name: string;
  color?: string;
  members: DiscordMember[];
}

export const MemberList: React.FC<MemberListProps> = ({
  activeGuild,
  presences,
  onSelectUser,
  onClose,
  initialMembers = [],
}) => {
  const [members, setMembers] = useState<DiscordMember[]>(initialMembers);

  useEffect(() => {
    if (initialMembers.length > 0) {
      setMembers(initialMembers);
    }
  }, [initialMembers]);
  const [roles, setRoles] = useState<DiscordRole[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Load members and roles on guild change
  useEffect(() => {
    if (!activeGuild) {
      setMembers([]);
      setRoles([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    Promise.all([
      invoke<DiscordMember[]>("get_guild_members", {
        guildId: activeGuild.id,
        limit: 1000,
      }).catch((e) => {
        console.error("Failed to load members:", e);
        return [];
      }),
      invoke<DiscordRole[]>("get_guild_roles", {
        guildId: activeGuild.id,
      }).catch((e) => {
        console.error("Failed to load roles:", e);
        return [];
      }),
    ]).then(([fetchedMembers, fetchedRoles]) => {
      if (!isMounted) return;
      setMembers(fetchedMembers);
      setRoles(fetchedRoles);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [activeGuild?.id]);

  // Roles map by ID
  const rolesMap = useMemo(() => {
    const map = new Map<string, DiscordRole>();
    for (const r of roles) {
      map.set(r.id, r);
    }
    return map;
  }, [roles]);

  // Sorted hoisted roles (highest position first)
  const hoistedRoles = useMemo(() => {
    return roles
      .filter((r) => r.hoist)
      .sort((a, b) => b.position - a.position);
  }, [roles]);

  // Filter and group members
  const memberGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filteredMembers = query
      ? members.filter((m) => {
          const nick = m.nick?.toLowerCase() || "";
          const username = m.user.username.toLowerCase();
          const globalName = m.user.global_name?.toLowerCase() || "";
          return (
            nick.includes(query) ||
            username.includes(query) ||
            globalName.includes(query)
          );
        })
      : members;

    // Groups storage
    const roleBuckets = new Map<string, DiscordMember[]>();
    for (const hr of hoistedRoles) {
      roleBuckets.set(hr.id, []);
    }
    const onlineBucket: DiscordMember[] = [];
    const offlineBucket: DiscordMember[] = [];

    for (const m of filteredMembers) {
      const p = presences[m.user.id];
      const isOnline = p && p.status !== "offline";

      if (!isOnline) {
        offlineBucket.push(m);
        continue;
      }

      // Find highest hoisted role that member belongs to
      let placedRole: DiscordRole | null = null;
      for (const hr of hoistedRoles) {
        if (m.roles.includes(hr.id)) {
          placedRole = hr;
          break;
        }
      }

      if (placedRole) {
        roleBuckets.get(placedRole.id)?.push(m);
      } else {
        onlineBucket.push(m);
      }
    }

    const groups: MemberGroup[] = [];

    // Add hoisted role groups
    for (const hr of hoistedRoles) {
      const bucket = roleBuckets.get(hr.id) || [];
      if (bucket.length > 0) {
        // Sort alphabetically by display name
        bucket.sort((a, b) => {
          const nameA = a.nick || a.user.global_name || a.user.username;
          const nameB = b.nick || b.user.global_name || b.user.username;
          return nameA.localeCompare(nameB);
        });

        const colorHex =
          hr.color !== 0
            ? `#${hr.color.toString(16).padStart(6, "0")}`
            : undefined;

        groups.push({
          id: hr.id,
          name: hr.name,
          color: colorHex,
          members: bucket,
        });
      }
    }

    // Add general Online group
    if (onlineBucket.length > 0) {
      onlineBucket.sort((a, b) => {
        const nameA = a.nick || a.user.global_name || a.user.username;
        const nameB = b.nick || b.user.global_name || b.user.username;
        return nameA.localeCompare(nameB);
      });
      groups.push({
        id: "online",
        name: "Online",
        members: onlineBucket,
      });
    }

    // Add Offline group
    if (offlineBucket.length > 0) {
      offlineBucket.sort((a, b) => {
        const nameA = a.nick || a.user.global_name || a.user.username;
        const nameB = b.nick || b.user.global_name || b.user.username;
        return nameA.localeCompare(nameB);
      });
      groups.push({
        id: "offline",
        name: "Offline",
        members: offlineBucket,
      });
    }

    return groups;
  }, [members, hoistedRoles, presences, searchQuery]);

  // Determine highest role color for a member
  const getMemberColor = (member: DiscordMember): string | undefined => {
    let highestRole: DiscordRole | null = null;
    for (const rid of member.roles) {
      const r = rolesMap.get(rid);
      if (r && r.color !== 0) {
        if (!highestRole || r.position > highestRole.position) {
          highestRole = r;
        }
      }
    }
    return highestRole
      ? `#${highestRole.color.toString(16).padStart(6, "0")}`
      : undefined;
  };

  const getAvatarUrl = (user: DiscordUser) => {
    if (user.avatar) {
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
    }
    const defaultIndex = parseInt(user.discriminator || "0") % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  };

  return (
    <aside className="w-60 bg-[#08090d]/80 backdrop-blur-2xl border-l border-white/5 flex flex-col h-full select-none shrink-0 z-20">
      {/* Search Header */}
      <div className="p-3 pb-2 border-b border-white/5 flex items-center justify-between gap-2">
        <div className="flex-1 relative flex items-center bg-white/5 rounded-xl border border-white/5 px-2.5 py-1.5 focus-within:border-[var(--accent)] transition-all">
          <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search members..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs text-white placeholder-slate-400"
          />
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close member list"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Member List Feed */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 custom-scrollbar">
        {isLoading && members.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            Loading members...
          </div>
        ) : memberGroups.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-400">
            No members found
          </div>
        ) : (
          memberGroups.map((group) => (
            <div key={group.id} className="space-y-0.5">
              {/* Group Title */}
              <div className="px-2 py-1 text-[11px] font-bold tracking-wider uppercase text-slate-400 flex items-center gap-1.5">
                <span
                  style={{ color: group.color }}
                  className={group.color ? "font-extrabold" : ""}
                >
                  {group.name}
                </span>
                <span className="text-[10px] text-slate-400 opacity-60">
                  — {group.members.length}
                </span>
              </div>

              {/* Members */}
              {group.members.map((member) => {
                const presence = presences[member.user.id];
                const displayName =
                  member.nick ||
                  member.user.global_name ||
                  member.user.username;
                const memberColor = getMemberColor(member);
                const status = presence?.status || "offline";
                const isOffline = status === "offline";

                return (
                  <div
                    key={member.user.id}
                    onClick={() => onSelectUser(member.user, member)}
                    className={`group flex items-center gap-2.5 px-2 py-1.5 rounded-xl cursor-pointer transition-all duration-150 ${
                      isOffline
                        ? "opacity-60 hover:opacity-100 hover:bg-white/5"
                        : "hover:bg-white/10 hover:shadow-sm"
                    }`}
                  >
                    {/* Avatar with Status badge */}
                    <div className="relative shrink-0">
                      <img
                        src={getAvatarUrl(member.user)}
                        alt={displayName}
                        className="w-8 h-8 rounded-full object-cover bg-black/40 border border-white/10"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "https://cdn.discordapp.com/embed/avatars/0.png";
                        }}
                      />
                      <StatusBadge
                        status={status}
                        size="sm"
                        className="absolute -bottom-0.5 -right-0.5"
                      />
                    </div>

                    {/* Member Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span
                          style={{ color: memberColor }}
                          className={`text-xs font-semibold truncate ${
                            !memberColor
                              ? "text-slate-200 group-hover:text-white"
                              : ""
                          }`}
                        >
                          {displayName}
                        </span>

                        {activeGuild?.owner && (
                          <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                        )}
                      </div>

                      {/* Presence or activity note */}
                      {(presence?.custom_status || presence?.activity) && (
                        <div className="text-[10px] text-slate-400 truncate leading-tight group-hover:text-slate-300">
                          {presence.custom_status || presence.activity}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
