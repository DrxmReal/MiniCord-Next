import React from "react";

interface StatusBadgeProps {
  status?: "online" | "idle" | "dnd" | "offline" | string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status = "offline",
  className = "",
  size = "md",
}) => {
  const currentStatus = status || "offline";

  const sizeClasses = {
    sm: "w-2.5 h-2.5 ring-[2px]",
    md: "w-3 h-3 ring-[2px]",
    lg: "w-3.5 h-3.5 ring-[2.5px]",
  }[size];

  switch (currentStatus) {
    case "online":
      return (
        <span
          title="Online"
          className={`rounded-full bg-[#23a55a] ring-[#0c0e17] shrink-0 ${sizeClasses} ${className}`}
        />
      );

    case "idle":
      return (
        <span
          title="Idle / Away"
          className={`relative rounded-full bg-[#f0b232] ring-[#0c0e17] shrink-0 overflow-hidden flex items-center justify-center ${sizeClasses} ${className}`}
        >
          {/* Crescent moon cutout effect */}
          <span className="absolute top-0 left-0 w-[60%] h-[60%] rounded-full bg-[#0c0e17]" />
        </span>
      );

    case "dnd":
      return (
        <span
          title="Do Not Disturb"
          className={`rounded-full bg-[#f23f43] ring-[#0c0e17] shrink-0 flex items-center justify-center ${sizeClasses} ${className}`}
        >
          {/* White minus sign */}
          <span className="w-[60%] h-[1.5px] bg-white rounded-full" />
        </span>
      );

    case "offline":
    default:
      return (
        <span
          title="Offline"
          className={`rounded-full bg-[#80848e] ring-[#0c0e17] shrink-0 flex items-center justify-center ${sizeClasses} ${className}`}
        >
          {/* Inner dark center for offline ring */}
          <span className="w-[45%] h-[45%] rounded-full bg-[#0c0e17]" />
        </span>
      );
  }
};
