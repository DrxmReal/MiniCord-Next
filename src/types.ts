export interface ThemePalette {
  hex: string;
  r: number;
  g: number;
  b: number;
  accent_hover: string;
  accent_glow: string;
  accent_dim: string;
}

export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string | null;
  avatar?: string | null;
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon?: string | null;
  owner?: boolean;
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0 = text, 1 = DM, 2 = voice, 3 = Group DM, 4 = category, 5 = announcement, 15 = forum
  topic?: string | null;
  parent_id?: string | null;
  position?: number;
  recipient?: DiscordUser | null;
}

export interface DiscordDMChannel {
  id: string;
  type: number;
  last_message_id?: string | null;
  recipients?: DiscordUser[];
  name?: string | null;
}

export interface DiscordAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url?: string;
  content_type?: string;
  width?: number;
  height?: number;
}

export interface DiscordEmbedFooter {
  text: string;
  icon_url?: string;
  proxy_icon_url?: string;
}

export interface DiscordEmbedImage {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedThumbnail {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface DiscordEmbedAuthor {
  name: string;
  url?: string;
  icon_url?: string;
  proxy_icon_url?: string;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: DiscordEmbedFooter;
  image?: DiscordEmbedImage;
  thumbnail?: DiscordEmbedThumbnail;
  author?: DiscordEmbedAuthor;
  fields?: DiscordEmbedField[];
}

export interface DiscordMessage {
  id: string;
  channel_id: string;
  content: string;
  timestamp: string;
  author: DiscordUser;
  attachments?: DiscordAttachment[];
  embeds?: DiscordEmbed[];
}

export interface UserPresence {
  user_id: string;
  status: "online" | "idle" | "dnd" | "offline";
  custom_status?: string | null;
  activity?: string | null;
}

export interface AppSettings {
  fontFamily: string;
  fontSize: number;
  spacing: "compact" | "cozy";
  wallpaperSync: boolean;
  customAccent: string;
  blurIntensity: "low" | "medium" | "ultra";
}
