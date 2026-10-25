import React, { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Users,
  MessageSquare,
  Search,
} from "lucide-react";
import { DiscordRelationship, DiscordUser, UserPresence } from "../types";
import { StatusBadge } from "./StatusBadge";

interface FriendsTabProps {
  presences: Record<string, UserPresence>;
  onOpenDM: (userId: string) => void;
  onSelectUser: (user: DiscordUser) => void;
  onStartCall?: (channelId: string) => void;
}

type TabType = "online" | "all" | "pending" | "blocked";

export const FriendsTab: React.FC<FriendsTabProps> = ({
  presences,
  onOpenDM,
  onSelectUser,
}) => {
  const [relationships, setRelationships] = useState<DiscordRelationship[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("online");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    invoke<DiscordRelationship[]>("get_relationships")
      .then((data) => {
        setRelationships(data);
      })
      .catch((err) => {
        console.error("Failed to fetch relationships:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Filter relationships by tab
  const filteredList = useMemo(() => {
    let list: DiscordRelationship[] = [];

    if (activeTab === "online") {
      list = relationships.filter((r) => {
        if (r.type !== 1) return false;
        const p = presences[r.user.id];
        return p && p.status !== "offline";
      });
    } else if (activeTab === "all") {
      list = relationships.filter((r) => r.type === 1);
    } else if (activeTab === "pending") {
      list = relationships.filter((r) => r.type === 3 || r.type === 4);
    } else if (activeTab === "blocked") {
      list = relationships.filter((r) => r.type === 2);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((r) => {
        const u = r.user;
        const name = (u.global_name || u.username).toLowerCase();
        const handle = u.username.toLowerCase();
        return name.includes(q) || handle.includes(q);
      });
    }

    // Sort alphabetically
    list.sort((a, b) => {
      const nameA = a.user.global_name || a.user.username;
      const nameB = b.user.global_name || b.user.username;
      return nameA.localeCompare(nameB);
    });

    return list;
  }, [relationships, activeTab, presences, searchQuery]);

  const counts = useMemo(() => {
    const online = relationships.filter(
      (r) => r.type === 1 && presences[r.user.id]?.status !== "offline"
    ).length;
    const all = relationships.filter((r) => r.type === 1).length;
    const pending = relationships.filter(
      (r) => r.type === 3 || r.type === 4
    ).length;
    const blocked = relationships.filter((r) => r.type === 2).length;
    return { online, all, pending, blocked };
  }, [relationships, presences]);

  const getAvatarUrl = (user: DiscordUser) => {
    if (user.avatar) {
      return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
    }
    const defaultIndex = parseInt(user.discriminator || "0") % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0c12]/80 backdrop-blur-2xl select-none overflow-hidden">
      {/* Top Header & Subtabs */}
      <header className="h-14 border-b border-white/5 px-6 flex items-center justify-between gap-4 shrink-0 bg-white/[0.02]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Users className="w-5 h-5 text-slate-300" />
            <span>Friends</span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Sub-tabs */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("online")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "online"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              Online ({counts.online})
            </button>
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              All ({counts.all})
            </button>
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "pending"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              Pending ({counts.pending})
            </button>
            <button
              onClick={() => setActiveTab("blocked")}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "blocked"
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              Blocked ({counts.blocked})
            </button>
          </nav>
        </div>
      </header>

      {/* Search Input Bar */}
      <div className="px-6 py-4">
        <div className="flex items-center bg-white/5 border border-white/5 rounded-2xl px-3.5 py-2 focus-within:border-[var(--accent)] transition-all">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-xs text-white placeholder-slate-400"
          />
        </div>
      </div>

      {/* Friends List Container */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 custom-scrollbar">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">
          {activeTab.toUpperCase()} — {filteredList.length}
        </div>

        {isLoading && relationships.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Loading friends...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <Users className="w-10 h-10 opacity-30 text-white" />
            <div className="text-sm font-semibold">No friends found here</div>
            <div className="text-xs text-slate-400 opacity-70">
              {activeTab === "online"
                ? "No friends are currently online. Check back later!"
                : "Your friends list is currently empty."}
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredList.map((item) => {
              const u = item.user;
              const presence = presences[u.id];
              const status = presence?.status || "offline";
              const displayName = u.global_name || u.username;

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectUser(u)}
                  className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-white/5 transition-all duration-150 cursor-pointer border border-transparent hover:border-white/5"
                >
                  {/* Left info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={getAvatarUrl(u)}
                        alt={displayName}
                        className="w-10 h-10 rounded-full object-cover bg-black/40 border border-white/10"
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

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-200 group-hover:text-white truncate">
                          {displayName}
                        </span>
                        <span className="text-xs text-slate-400 opacity-60">
                          @{u.username}
                        </span>
                      </div>

                      {/* Status / Activity text */}
                      <div className="text-xs text-slate-400 truncate">
                        {presence?.custom_status ||
                          presence?.activity ||
                          (status !== "offline"
                            ? status.charAt(0).toUpperCase() + status.slice(1)
                            : "Offline")}
                      </div>
                    </div>
                  </div>

                  {/* Right Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDM(u.id);
                      }}
                      className="p-2 rounded-xl bg-white/5 text-slate-300 hover:text-white hover:bg-[var(--accent)] hover:text-black transition-all cursor-pointer shadow-sm"
                      title="Open Direct Message"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
