import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  Collection,
} from "discord.js";

export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">;
  execute: (
    interaction: ChatInputCommandInteraction,
    commands?: Collection<string, Command>
  ) => Promise<void>;
}

export interface WarnEntry {
  moderator: string;
  reason: string;
  timestamp: number;
}

export interface StaffWarnEntry extends WarnEntry {
  moderatorId: string;
}

export interface NoteEntry {
  id: string;
  guildId: string;
  memberId: string;
  memberTag: string;
  authorId: string;
  authorTag: string;
  text: string;
  timestamp: number;
}

export interface GuildCommunityConfig {
  quotaRoles: Record<string, number>;
  quotaAdminChannelId?: string;
  levelsChannelId?: string;
  welcomeChannelId?: string;
  welcomeMessage?: string;
  quotaPeriodKey?: string;
  quotaReminderKey?: string;
}

export interface UserProfile {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  orelyss: number;
  messageCount: number;
  voiceMinutes: number;
  quotaMessages: number;
  lastDailyKey?: string;
  dailyStreak: number;
  inventory: Record<string, number>;
  questProgress: Record<string, number>;
  completedQuests: string[];
}

export interface ShopArticle {
  id: string;
  name: string;
  description: string;
  price: number;
  stock?: number;
  objectId?: string;
  createdAt: number;
  sortOrder: number;
}

export type QuestActivity = "messages" | "vocal";
export type QuestRewardType = "orelyss" | "xp" | "objet" | "role";

export interface Quest {
  id: string;
  guildId: string;
  name: string;
  activity: QuestActivity;
  requirement: number;
  rewardType: QuestRewardType;
  rewardValue: string;
  rewardQuantity: number;
  expiresAt: number;
  createdAt: number;
}

export interface ServerObject {
  id: string;
  name: string;
  description: string;
  emoji: string;
  /** Rôle donné automatiquement lors de l'achat d'un article lié à cet objet. */
  roleId?: string;
  createdAt: number;
}

export interface PurchaseLog {
  id: string;
  guildId: string;
  articleId: string;
  articleName: string;
  userId: string;
  userTag: string;
  price: number;
  timestamp: number;
}

export type HistoryType =
  | "ban"
  | "unban"
  | "timeout"
  | "untimeout"
  | "warn"
  | "delwarn"
  | "ticket_open"
  | "ticket_close";

export interface HistoryEntry {
  type: HistoryType;
  guildId: string;
  targetId: string;
  targetTag: string;
  moderatorTag: string;
  reason: string;
  extra?: string;
  timestamp: number;
}

