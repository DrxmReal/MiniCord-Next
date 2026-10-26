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
  bio?: string | null;
  banner?: string | null;
  banner_color?: string | null;
  accent_color?: number | null;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions?: string;
  icon?: string | null;
}

export interface DiscordMember {
  user: DiscordUser;
  nick?: string | null;
  roles: string[];
  joined_at: string;
  premium_since?: string | null;
  deaf?: boolean;
  mute?: boolean;
}

export interface DiscordReaction {
  count: number;
  me: boolean;
  emoji: {
    id?: string | null;
    name: string;
  };
}

export interface DiscordRelationship {
  id: string;
  type: number; // 1 = Friend, 2 = Blocked, 3 = Incoming Request, 4 = Outgoing Request
  nickname?: string | null;
  user: DiscordUser;
}

export interface UserProfileData {
  user: DiscordUser;
  connected_accounts?: Array<{ type: string; name: string }>;
  premium_since?: string | null;
  badges?: Array<{ id: string; description: string; icon: string }>;
  user_profile?: {
    bio?: string;
    pronouns?: string;
  };
  mutual_guilds?: Array<{ id: string; nick?: string }>;
}

export interface TypingEvent {
  channel_id: string;
  user_id: string;
  timestamp: number;
  member?: {
    user: DiscordUser;
    nick?: string;
  };
}

export interface DiscordVoiceState {
  guild_id?: string | null;
  channel_id?: string | null;
  user_id: string;
  session_id?: string;
  deaf?: boolean;
  mute?: boolean;
  self_deaf?: boolean;
  self_mute?: boolean;
  self_video?: boolean;
  suppress?: boolean;
  member?: DiscordMember | null;
}

export interface DiscordEmoji {
  id: string;
  name: string;
  roles?: string[];
  animated?: boolean;
  require_colons?: boolean;
  managed?: boolean;
  available?: boolean;
}

export interface DiscordSticker {
  id: string;
  name: string;
  description?: string | null;
  format_type: number; // 1 = PNG, 2 = APNG, 3 = Lottie, 4 = GIF
  pack_id?: string;
  tags?: string;
}

export interface DiscordGif {
  id?: string;
  title?: string;
  url: string;
  src?: string;
  preview?: string;
  width?: number;
  height?: number;
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
  edited_timestamp?: string | null;
  author: DiscordUser;
  attachments?: DiscordAttachment[];
  embeds?: DiscordEmbed[];
  reactions?: DiscordReaction[];
  referenced_message?: DiscordMessage | null;
  mentions?: DiscordUser[];
  mention_roles?: string[];
}

export interface MentionContext {
  mentions?: DiscordUser[];
  members?: DiscordMember[];
  roles?: DiscordRole[];
  channels?: DiscordChannel[];
  currentUser?: DiscordUser | null;
  onSelectUser?: (user: DiscordUser) => void;
  onSelectChannel?: (channel: DiscordChannel) => void;
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
