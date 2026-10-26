import React, { useState, useEffect } from "react";
import { MessageSquare, Plus, Copy, CheckCheck, LogOut, Hash } from "lucide-react";
import { DiscordGuild } from "../types";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";

interface GuildRailProps {
  guilds: DiscordGuild[];
  activeGuildId: string | null;
  onSelectGuild: (guild: DiscordGuild | null) => void;
}

export const GuildRail: React.FC<GuildRailProps> = ({
  guilds,
  activeGuildId,
  onSelectGuild,
}) => {
  const [orderedGuilds, setOrderedGuilds] = useState<DiscordGuild[]>(guilds);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    items: ContextMenuItem[];
  } | null>(null);

  // Load saved custom ordering or synchronize with guilds
  useEffect(() => {
    try {
      const saved = localStorage.getItem("minicord_guild_order");
      if (saved) {
        const orderIds: string[] = JSON.parse(saved);
        const map = new Map(guilds.map((g) => [g.id, g]));
        const sorted: DiscordGuild[] = [];

        // Add saved in order
        for (const id of orderIds) {
          if (map.has(id)) {
            sorted.push(map.get(id)!);
            map.delete(id);
          }
        }
        // Append any new guilds not in saved list
        map.forEach((g) => sorted.push(g));
        setOrderedGuilds(sorted);
        return;
      }
    } catch (e) {
      console.error("Guild ordering parse error:", e);
    }
    setOrderedGuilds(guilds);
  }, [guilds]);

  const saveOrder = (list: DiscordGuild[]) => {
    setOrderedGuilds(list);
    try {
      const ids = list.map((g) => g.id);
      localStorage.setItem("minicord_guild_order", JSON.stringify(ids));
    } catch {}
  };

  const getAcronym = (name: string) => {
    return name
      .replace(/'s /g, " ")
      .replace(/\w+/g, (e) => e[0])
      .replace(/\s/g, "")
      .substring(0, 3)
      .toUpperCase();
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTargetIdx !== index) {
      setDropTargetIdx(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) {
      setDraggedIdx(null);
      setDropTargetIdx(null);
      return;
    }

    const updated = [...orderedGuilds];
    const [moved] = updated.splice(draggedIdx, 1);
    updated.splice(targetIndex, 0, moved);

    saveOrder(updated);
    setDraggedIdx(null);
    setDropTargetIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDropTargetIdx(null);
  };

  const handleGuildContextMenu = (e: React.MouseEvent, guild: DiscordGuild) => {
    e.preventDefault();
    e.stopPropagation();

    const items: ContextMenuItem[] = [
      {
        label: "Mark As Read",
        icon: <CheckCheck className="w-3.5 h-3.5" />,
        onClick: () => {
          console.log("Mark as read:", guild.id);
        },
      },
      {
        label: "Copy Server ID",
        icon: <Hash className="w-3.5 h-3.5" />,
        onClick: () => {
          navigator.clipboard.writeText(guild.id);
        },
      },
      {
        label: "Copy Server Name",
        icon: <Copy className="w-3.5 h-3.5" />,
        onClick: () => {
          navigator.clipboard.writeText(guild.name);
        },
      },
      {
        label: "Leave Server",
        icon: <LogOut className="w-3.5 h-3.5" />,
        danger: true,
        onClick: () => {
          console.log("Leave server:", guild.id);
        },
      },
    ];

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items,
    });
  };

  return (
    <nav className="w-[72px] min-w-[72px] max-w-[72px] h-full py-3 flex flex-col items-center gap-2 select-none shrink-0 bg-[var(--bg-deep)]/60 backdrop-blur-md border-r border-white/5">
      {/* Home / Direct Messages button */}
      <div className="relative flex items-center justify-center w-full group">
        <div
          className={`absolute left-0 w-1 rounded-r-full transition-all duration-200 ${
            activeGuildId === null
              ? "h-10 bg-[var(--accent)]"
              : "h-0 group-hover:h-5 bg-white/50"
          }`}
        />
        <button
          onClick={() => onSelectGuild(null)}
          className={`w-12 h-12 rounded-[24px] flex items-center justify-center transition-all duration-200 group-hover:rounded-[16px] group-hover:bg-[var(--accent)] cursor-pointer ${
            activeGuildId === null
              ? "rounded-[16px] bg-[var(--accent)] text-black"
              : "bg-white/10 text-white/80"
          }`}
          title="Direct Messages"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      </div>

      <div className="w-8 h-[2px] bg-white/10 rounded-full my-1" />

      {/* Guilds List with Drag & Drop */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-2 no-scrollbar">
        {orderedGuilds.map((guild, index) => {
          const isActive = activeGuildId === guild.id;
          const isDragging = draggedIdx === index;
          const isDropTarget = dropTargetIdx === index;

          const iconUrl = guild.icon
            ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=96`
            : null;

          return (
            <div
              key={guild.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onContextMenu={(e) => handleGuildContextMenu(e, guild)}
              className={`relative flex items-center justify-center w-full group transition-all duration-150 ${
                isDragging ? "opacity-30 scale-95" : "opacity-100"
              }`}
            >
              {/* Drop Target Glow Indicator Line */}
              {isDropTarget && draggedIdx !== index && (
                <div className="absolute -top-1 w-10 h-[3px] bg-[var(--accent)] rounded-full shadow-[0_0_8px_var(--accent)] z-20" />
              )}

              {/* Active Indicator Bar */}
              <div
                className={`absolute left-0 w-1 rounded-r-full transition-all duration-200 ${
                  isActive
                    ? "h-10 bg-[var(--accent)]"
                    : "h-0 group-hover:h-5 bg-white/50"
                }`}
              />

              <button
                onClick={() => onSelectGuild(guild)}
                className={`relative w-12 h-12 flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:rounded-[16px] cursor-pointer ${
                  isActive
                    ? "rounded-[16px] ring-2 ring-[var(--accent)]"
                    : "rounded-[24px] bg-white/10 hover:bg-white/15"
                }`}
                title={guild.name}
              >
                {iconUrl ? (
                  <img
                    src={iconUrl}
                    alt={guild.name}
                    className="w-full h-full object-cover pointer-events-none"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-xs font-bold text-white/90 tracking-wider">
                    {getAcronym(guild.name)}
                  </span>
                )}
              </button>
            </div>
          );
        })}

        {/* Add Server Pill */}
        <div className="relative flex items-center justify-center w-full group mt-1">
          <button
            className="w-12 h-12 rounded-[24px] flex items-center justify-center bg-white/5 text-emerald-400 hover:bg-emerald-500 hover:text-black hover:rounded-[16px] transition-all duration-200 cursor-pointer"
            title="Explore / Add Server"
          >
            <Plus className="w-5 h-5" />
          </button>
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
    </nav>
  );
};
