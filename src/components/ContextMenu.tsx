import React, { useEffect, useRef } from "react";

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handleClickOutside, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to stay inside screen bounds
  const menuWidth = 190;
  const menuHeight = items.length * 36;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  const posX = x + menuWidth > screenW ? Math.max(10, screenW - menuWidth - 10) : x;
  const posY = y + menuHeight > screenH ? Math.max(10, screenH - menuHeight - 10) : y;

  return (
    <div
      ref={menuRef}
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="fixed z-[100] min-w-[190px] p-1.5 rounded-2xl glass-card bg-[#0e101a]/95 border border-white/10 shadow-2xl backdrop-blur-2xl select-none animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="space-y-0.5">
        {items.map((item, idx) => {
          if (item.separator) {
            return <div key={idx} className="my-1 border-t border-white/10" />;
          }

          return (
            <button
              key={idx}
              onClick={() => {
                item.onClick();
                onClose();
              }}
              className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-xs font-medium transition-all text-left cursor-pointer ${
                item.danger
                  ? "text-red-400 hover:bg-red-500/15 hover:text-red-300"
                  : "text-slate-200 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span>{item.label}</span>
              {item.icon && <span className="opacity-70 shrink-0 ml-2">{item.icon}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
};
