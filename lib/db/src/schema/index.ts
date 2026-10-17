import { bigint, integer, jsonb, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const communityConfigsTable = pgTable("discord_community_configs", {
  guildId: text("guild_id").primaryKey(),
  quotaRoles: jsonb("quota_roles").$type<Record<string, number>>().notNull().default({}),
  quotaAdminChannelId: text("quota_admin_channel_id"),
  levelsChannelId: text("levels_channel_id"),
  welcomeChannelId: text("welcome_channel_id"),
  welcomeMessage: text("welcome_message"),
  quotaPeriodKey: text("quota_period_key"),
  quotaReminderKey: text("quota_reminder_key"),
});

export const discordRuntimeStateTable = pgTable("discord_runtime_state", {
  stateKey: text("state_key").primaryKey(),
  stateValue: jsonb("state_value").$type<Record<string, unknown>>().notNull(),
});

export const userProfilesTable = pgTable("discord_user_profiles", {
  guildId: text("guild_id").notNull(),
  userId: text("user_id").notNull(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(0),
  orelyss: integer("orelyss").notNull().default(0),
  messageCount: integer("message_count").notNull().default(0),
  voiceMinutes: integer("voice_minutes").notNull().default(0),
  quotaMessages: integer("quota_messages").notNull().default(0),
  lastDailyKey: text("last_daily_key"),
  dailyStreak: integer("daily_streak").notNull().default(0),
  inventory: jsonb("inventory").$type<Record<string, number>>().notNull().default({}),
  questProgress: jsonb("quest_progress").$type<Record<string, number>>().notNull().default({}),
  completedQuests: jsonb("completed_quests").$type<string[]>().notNull().default([]),
}, (table) => [
  primaryKey({ columns: [table.guildId, table.userId] }),
]);

export const communityNotesTable = pgTable("discord_community_notes", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  memberId: text("member_id").notNull(),
  memberTag: text("member_tag").notNull(),
  authorId: text("author_id").notNull(),
  authorTag: text("author_tag").notNull(),
  text: text("text").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const shopArticlesTable = pgTable("discord_shop_articles", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  stock: integer("stock"),
  objectId: text("object_id"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const serverObjectsTable = pgTable("discord_server_objects", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  emoji: text("emoji").notNull(),
  roleId: text("role_id"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const questsTable = pgTable("discord_quests", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  name: text("name").notNull(),
  activity: text("activity").notNull(),
  requirement: integer("requirement").notNull(),
  rewardType: text("reward_type").notNull(),
  rewardValue: text("reward_value").notNull(),
  rewardQuantity: integer("reward_quantity").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const purchaseLogsTable = pgTable("discord_purchase_logs", {
  id: text("id").primaryKey(),
  guildId: text("guild_id").notNull(),
  articleId: text("article_id").notNull(),
  articleName: text("article_name").notNull(),
  userId: text("user_id").notNull(),
  userTag: text("user_tag").notNull(),
  price: integer("price").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export type CommunityConfigRow = typeof communityConfigsTable.$inferSelect;
export type UserProfileRow = typeof userProfilesTable.$inferSelect;
export type CommunityNoteRow = typeof communityNotesTable.$inferSelect;
export type ShopArticleRow = typeof shopArticlesTable.$inferSelect;
export type ServerObjectRow = typeof serverObjectsTable.$inferSelect;
export type QuestRow = typeof questsTable.$inferSelect;
export type PurchaseLogRow = typeof purchaseLogsTable.$inferSelect;