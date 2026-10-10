import { randomUUID } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  communityConfigsTable,
  communityNotesTable,
  db,
  purchaseLogsTable,
  questsTable,
  serverObjectsTable,
  shopArticlesTable,
  userProfilesTable,
} from "@workspace/db";
import type {
  WarnEntry,
  HistoryEntry,
  StaffWarnEntry,
  NoteEntry,
  GuildCommunityConfig,
  UserProfile,
  ShopArticle,
  Quest,
  ServerObject,
  PurchaseLog,
} from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "../../data");
const COMMUNITY_FILE = "community.json";

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadJson<T>(file: string, fallback: T): T {
  const path = join(DATA_DIR, file);
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function saveJson(file: string, data: unknown) {
  writeFileSync(join(DATA_DIR, file), JSON.stringify(data, null, 2), "utf-8");
}

// ── Autoroles ────────────────────────────────────────────────────────
const autoroles = loadJson<Record<string, string[]>>("autoroles.json", {});

export const autoroleStore = {
  get(guildId: string): string[] {
    return autoroles[guildId] ?? [];
  },
  set(guildId: string, roleIds: string[]) {
    autoroles[guildId] = roleIds;
    saveJson("autoroles.json", autoroles);
  },
  add(guildId: string, roleId: string): boolean {
    const roles = this.get(guildId);
    if (roles.includes(roleId)) return false;
    roles.push(roleId);
    this.set(guildId, roles);
    return true;
  },
  remove(guildId: string, roleId: string): boolean {
    const roles = this.get(guildId);
    const index = roles.indexOf(roleId);
    if (index === -1) return false;
    roles.splice(index, 1);
    this.set(guildId, roles);
    return true;
  },
};

// ── Warns ────────────────────────────────────────────────────────────
const warns = loadJson<Record<string, WarnEntry[]>>("warns.json", {});

export const warnsStore = {
  get(key: string): WarnEntry[] {
    return warns[key] ?? [];
  },
  add(key: string, entry: WarnEntry) {
    if (!warns[key]) warns[key] = [];
    warns[key].push(entry);
    saveJson("warns.json", warns);
  },
  set(key: string, entries: WarnEntry[]) {
    warns[key] = entries;
    saveJson("warns.json", warns);
  },
  clear(key: string) {
    delete warns[key];
    saveJson("warns.json", warns);
  },
};

// ── Règlement ────────────────────────────────────────────────────────
interface ReglementData {
  texts: Record<string, string>;
  acceptRoles: Record<string, string>;
}

function loadReglement(): ReglementData {
  const raw = loadJson<unknown>("reglement.json", { texts: {}, acceptRoles: {} });
  if (raw && typeof raw === "object" && !("texts" in raw)) {
    return { texts: raw as Record<string, string>, acceptRoles: {} };
  }
  return raw as ReglementData;
}

const reglement = loadReglement();

export const reglementStore = {
  get(guildId: string): string | undefined {
    return reglement.texts?.[guildId];
  },
  set(guildId: string, texte: string) {
    if (!reglement.texts) reglement.texts = {};
    reglement.texts[guildId] = texte;
    saveJson("reglement.json", reglement);
  },
  delete(guildId: string) {
    delete reglement.texts?.[guildId];
    saveJson("reglement.json", reglement);
  },
  getAcceptRole(guildId: string): string | undefined {
    return reglement.acceptRoles?.[guildId];
  },
  setAcceptRole(guildId: string, roleId: string) {
    if (!reglement.acceptRoles) reglement.acceptRoles = {};
    reglement.acceptRoles[guildId] = roleId;
    saveJson("reglement.json", reglement);
  },
};

// ── Historique ───────────────────────────────────────────────────────
const history = loadJson<Record<string, HistoryEntry[]>>("history.json", {});
const MAX_PER_GUILD = 500;

export const historyStore = {
  add(entry: HistoryEntry) {
    if (!history[entry.guildId]) history[entry.guildId] = [];
    history[entry.guildId].unshift(entry);
    history[entry.guildId] = history[entry.guildId].slice(0, MAX_PER_GUILD);
    saveJson("history.json", history);
  },
  getForGuild(guildId: string, limit = 20): HistoryEntry[] {
    return (history[guildId] ?? []).slice(0, limit);
  },
  getForMember(guildId: string, userId: string, limit = 20): HistoryEntry[] {
    return (history[guildId] ?? []).filter((entry) => entry.targetId === userId).slice(0, limit);
  },
};

// ── Staff warns ──────────────────────────────────────────────────────
const staffWarns = loadJson<Record<string, StaffWarnEntry[]>>("staff-warns.json", {});

export const staffWarnsStore = {
  get(key: string): StaffWarnEntry[] {
    return staffWarns[key] ?? [];
  },
  add(key: string, entry: StaffWarnEntry) {
    if (!staffWarns[key]) staffWarns[key] = [];
    staffWarns[key].push(entry);
    saveJson("staff-warns.json", staffWarns);
  },
  clear(key: string) {
    delete staffWarns[key];
    saveJson("staff-warns.json", staffWarns);
  },
};

// ── PostgreSQL-backed community data ─────────────────────────────────
interface CommunityData {
  configs: Record<string, GuildCommunityConfig>;
  profiles: Record<string, UserProfile>;
  notes: Record<string, NoteEntry[]>;
  articles: Record<string, ShopArticle[]>;
  quests: Record<string, Quest[]>;
  objects: Record<string, ServerObject[]>;
  purchases: Record<string, PurchaseLog[]>;
}

const emptyCommunityData: CommunityData = {
  configs: {},
  profiles: {},
  notes: {},
  articles: {},
  quests: {},
  objects: {},
  purchases: {},
};

function profileKey(guildId: string, userId: string) {
  return `${guildId}-${userId}`;
}

function newProfile(guildId: string, userId: string): UserProfile {
  return {
    guildId,
    userId,
    xp: 0,
    level: 0,
    orelyss: 0,
    messageCount: 0,
    voiceMinutes: 0,
    quotaMessages: 0,
    dailyStreak: 0,
    inventory: {},
    questProgress: {},
    completedQuests: [],
  };
}

function profileFromRow(row: typeof userProfilesTable.$inferSelect): UserProfile {
  return {
    guildId: row.guildId,
    userId: row.userId,
    xp: row.xp,
    level: row.level,
    orelyss: row.orelyss,
    messageCount: row.messageCount,
    voiceMinutes: row.voiceMinutes,
    quotaMessages: row.quotaMessages,
    lastDailyKey: row.lastDailyKey ?? undefined,
    dailyStreak: row.dailyStreak,
    inventory: row.inventory ?? {},
    questProgress: row.questProgress ?? {},
    completedQuests: row.completedQuests ?? [],
  };
}

function articleFromRow(row: typeof shopArticlesTable.$inferSelect): ShopArticle {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    stock: row.stock ?? undefined,
    objectId: row.objectId ?? undefined,
    createdAt: row.createdAt,
    sortOrder: row.sortOrder,
  };
}

function objectFromRow(row: typeof serverObjectsTable.$inferSelect): ServerObject {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    emoji: row.emoji,
    roleId: row.roleId ?? undefined,
    createdAt: row.createdAt,
  };
}

function questFromRow(row: typeof questsTable.$inferSelect): Quest {
  return {
    id: row.id,
    guildId: row.guildId,
    name: row.name,
    activity: row.activity as Quest["activity"],
    requirement: row.requirement,
    rewardType: row.rewardType as Quest["rewardType"],
    rewardValue: row.rewardValue,
    rewardQuantity: row.rewardQuantity,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

function noteFromRow(row: typeof communityNotesTable.$inferSelect): NoteEntry {
  return {
    id: row.id,
    guildId: row.guildId,
    memberId: row.memberId,
    memberTag: row.memberTag,
    authorId: row.authorId,
    authorTag: row.authorTag,
    text: row.text,
    timestamp: row.createdAt,
  };
}

function purchaseFromRow(row: typeof purchaseLogsTable.$inferSelect): PurchaseLog {
  return {
    id: row.id,
    guildId: row.guildId,
    articleId: row.articleId,
    articleName: row.articleName,
    userId: row.userId,
    userTag: row.userTag,
    price: row.price,
    timestamp: row.createdAt,
  };
}

type DbExecutor = Pick<typeof db, "select" | "insert" | "update" | "delete">;

async function lockedProfile(executor: DbExecutor, guildId: string, userId: string) {
  const [row] = await executor.select().from(userProfilesTable).where(and(
    eq(userProfilesTable.guildId, guildId),
    eq(userProfilesTable.userId, userId),
  )).for("update").limit(1);
  return row ? profileFromRow(row) : newProfile(guildId, userId);
}

async function upsertProfile(executor: DbExecutor, profile: UserProfile) {
  await executor
    .insert(userProfilesTable)
    .values({
      guildId: profile.guildId,
      userId: profile.userId,
      xp: profile.xp,
      level: profile.level,
      orelyss: profile.orelyss,
      messageCount: profile.messageCount,
      voiceMinutes: profile.voiceMinutes,
      quotaMessages: profile.quotaMessages,
      lastDailyKey: profile.lastDailyKey ?? null,
      dailyStreak: profile.dailyStreak,
      inventory: profile.inventory,
      questProgress: profile.questProgress,
      completedQuests: profile.completedQuests,
    })
    .onConflictDoUpdate({
      target: [userProfilesTable.guildId, userProfilesTable.userId],
      set: {
        xp: profile.xp,
        level: profile.level,
        orelyss: profile.orelyss,
        messageCount: profile.messageCount,
        voiceMinutes: profile.voiceMinutes,
        quotaMessages: profile.quotaMessages,
        lastDailyKey: profile.lastDailyKey ?? null,
        dailyStreak: profile.dailyStreak,
        inventory: profile.inventory,
        questProgress: profile.questProgress,
        completedQuests: profile.completedQuests,
      },
    });
}

/**
 * Imports the legacy community file without replacing rows already in PostgreSQL.
 * Keeping the source file in place makes the migration retryable and preserves it
 * as a recoverable backup until the operator removes it.
 */
export async function initializeCommunityStore() {
  const seed = loadJson<CommunityData>(COMMUNITY_FILE, emptyCommunityData);
  await db.transaction(async (tx) => {
    for (const [guildId, config] of Object.entries(seed.configs ?? {})) {
      await tx.insert(communityConfigsTable).values({
        guildId,
        quotaRoles: config.quotaRoles ?? {},
        quotaAdminChannelId: config.quotaAdminChannelId ?? null,
        levelsChannelId: config.levelsChannelId ?? null,
        quotaPeriodKey: config.quotaPeriodKey ?? null,
        quotaReminderKey: config.quotaReminderKey ?? null,
      }).onConflictDoNothing();
    }
    for (const profile of Object.values(seed.profiles ?? {})) {
      await tx.insert(userProfilesTable).values({
        guildId: profile.guildId,
        userId: profile.userId,
        xp: profile.xp,
        level: profile.level,
        orelyss: profile.orelyss,
        messageCount: profile.messageCount,
        voiceMinutes: profile.voiceMinutes,
        quotaMessages: profile.quotaMessages,
        lastDailyKey: profile.lastDailyKey ?? null,
        dailyStreak: profile.dailyStreak,
        inventory: profile.inventory ?? {},
        questProgress: profile.questProgress ?? {},
        completedQuests: profile.completedQuests ?? [],
      }).onConflictDoNothing();
    }
    for (const notes of Object.values(seed.notes ?? {})) {
      for (const note of notes) {
        await tx.insert(communityNotesTable).values({
          id: note.id,
          guildId: note.guildId,
          memberId: note.memberId,
          memberTag: note.memberTag,
          authorId: note.authorId,
          authorTag: note.authorTag,
          text: note.text,
          createdAt: note.timestamp,
        }).onConflictDoNothing();
      }
    }
    for (const [guildId, articles] of Object.entries(seed.articles ?? {})) {
      for (const article of articles) {
        await tx.insert(shopArticlesTable).values({
          id: article.id,
          guildId,
          name: article.name,
          description: article.description,
          price: article.price,
          stock: article.stock ?? null,
          objectId: article.objectId ?? null,
          createdAt: article.createdAt,
          sortOrder: article.sortOrder,
        }).onConflictDoNothing();
      }
    }
    for (const quests of Object.values(seed.quests ?? {})) {
      for (const quest of quests) {
        await tx.insert(questsTable).values({
          id: quest.id,
          guildId: quest.guildId,
          name: quest.name,
          activity: quest.activity,
          requirement: quest.requirement,
          rewardType: quest.rewardType,
          rewardValue: quest.rewardValue,
          rewardQuantity: quest.rewardQuantity,
          expiresAt: quest.expiresAt,
          createdAt: quest.createdAt,
        }).onConflictDoNothing();
      }
    }
    for (const [guildId, objects] of Object.entries(seed.objects ?? {})) {
      for (const object of objects) {
        await tx.insert(serverObjectsTable).values({
          id: object.id,
          guildId,
          name: object.name,
          description: object.description,
          emoji: object.emoji,
          roleId: object.roleId ?? null,
          createdAt: object.createdAt,
        }).onConflictDoNothing();
      }
    }
    for (const purchases of Object.values(seed.purchases ?? {})) {
      for (const purchase of purchases) {
        await tx.insert(purchaseLogsTable).values({
          id: purchase.id,
          guildId: purchase.guildId,
          articleId: purchase.articleId,
          articleName: purchase.articleName,
          userId: purchase.userId,
          userTag: purchase.userTag,
          price: purchase.price,
          createdAt: purchase.timestamp,
        }).onConflictDoNothing();
      }
    }
  });
}

export const communityConfigStore = {
  async get(guildId: string): Promise<GuildCommunityConfig> {
    const [row] = await db.select().from(communityConfigsTable)
      .where(eq(communityConfigsTable.guildId, guildId)).limit(1);
    if (!row) return { quotaRoles: {} };
    return {
      quotaRoles: row.quotaRoles ?? {},
      quotaAdminChannelId: row.quotaAdminChannelId ?? undefined,
      levelsChannelId: row.levelsChannelId ?? undefined,
      welcomeChannelId: row.welcomeChannelId ?? undefined,
      welcomeMessage: row.welcomeMessage ?? undefined,
      quotaPeriodKey: row.quotaPeriodKey ?? undefined,
      quotaReminderKey: row.quotaReminderKey ?? undefined,
    };
  },
  async save(guildId: string, config: GuildCommunityConfig) {
    await db.insert(communityConfigsTable).values({
      guildId,
      quotaRoles: config.quotaRoles,
      quotaAdminChannelId: config.quotaAdminChannelId ?? null,
      levelsChannelId: config.levelsChannelId ?? null,
      welcomeChannelId: config.welcomeChannelId ?? null,
      welcomeMessage: config.welcomeMessage ?? null,
      quotaPeriodKey: config.quotaPeriodKey ?? null,
      quotaReminderKey: config.quotaReminderKey ?? null,
    }).onConflictDoUpdate({
      target: communityConfigsTable.guildId,
      set: {
        quotaRoles: config.quotaRoles,
        quotaAdminChannelId: config.quotaAdminChannelId ?? null,
        levelsChannelId: config.levelsChannelId ?? null,
        welcomeChannelId: config.welcomeChannelId ?? null,
        welcomeMessage: config.welcomeMessage ?? null,
        quotaPeriodKey: config.quotaPeriodKey ?? null,
        quotaReminderKey: config.quotaReminderKey ?? null,
      },
    });
  },
  async setQuotaRole(guildId: string, roleId: string, quota: number) {
    const config = await this.get(guildId);
    config.quotaRoles[roleId] = quota;
    await this.save(guildId, config);
  },
  async removeQuotaRole(guildId: string, roleId: string) {
    const config = await this.get(guildId);
    delete config.quotaRoles[roleId];
    await this.save(guildId, config);
  },
  async setAdminChannel(guildId: string, channelId: string) {
    const config = await this.get(guildId);
    config.quotaAdminChannelId = channelId;
    await this.save(guildId, config);
  },
  async setLevelsChannel(guildId: string, channelId: string) {
    const config = await this.get(guildId);
    config.levelsChannelId = channelId;
    await this.save(guildId, config);
  },
};

export const profileStore = {
  async get(guildId: string, userId: string): Promise<UserProfile> {
    const [row] = await db.select().from(userProfilesTable).where(and(
      eq(userProfilesTable.guildId, guildId),
      eq(userProfilesTable.userId, userId),
    )).limit(1);
    if (row) return profileFromRow(row);
    const profile = newProfile(guildId, userId);
    await upsertProfile(db, profile);
    return profile;
  },
  async allForGuild(guildId: string): Promise<UserProfile[]> {
    const rows = await db.select().from(userProfilesTable)
      .where(eq(userProfilesTable.guildId, guildId));
    return rows.map(profileFromRow);
  },
  async save(profile: UserProfile) {
    await upsertProfile(db, profile);
  },
  async claimDaily(guildId: string, userId: string, today: string, yesterday: string) {
    return db.transaction(async (tx) => {
      const profile = await lockedProfile(tx, guildId, userId);
      if (profile.lastDailyKey === today) {
        return { claimed: false as const, profile, amount: 0 };
      }

      profile.dailyStreak =
        profile.lastDailyKey === yesterday ? profile.dailyStreak + 1 : 1;
      profile.lastDailyKey = today;
      const amount =
        300 +
        (profile.dailyStreak === 7 ? 200 : 0) +
        (profile.dailyStreak === 14 ? 400 : 0) +
        (profile.dailyStreak === 30 ? 700 : 0);
      profile.orelyss += amount;
      await upsertProfile(tx, profile);
      return { claimed: true as const, profile, amount };
    });
  },
  async addXp(guildId: string, userId: string, amount: number) {
    return db.transaction(async (tx) => {
      const profile = await lockedProfile(tx, guildId, userId);
      profile.xp += amount;
      const levels: number[] = [];
      while (profile.xp >= 100 * (profile.level + 1)) {
        profile.xp -= 100 * (profile.level + 1);
        profile.level += 1;
        levels.push(profile.level);
        profile.orelyss += profile.level === 1 ? 100 : 100 + 50 * (profile.level - 1);
      }
      await upsertProfile(tx, profile);
      return { profile, levels };
    });
  },
  async addMessage(guildId: string, userId: string, amount = 1, countQuota = false) {
    return db.transaction(async (tx) => {
      const profile = await lockedProfile(tx, guildId, userId);
      profile.messageCount += amount;
      if (countQuota) profile.quotaMessages += amount;
      await upsertProfile(tx, profile);
      return profile;
    });
  },
  async addVoiceMinute(guildId: string, userId: string, amount = 1) {
    return db.transaction(async (tx) => {
      const profile = await lockedProfile(tx, guildId, userId);
      profile.voiceMinutes += amount;
      await upsertProfile(tx, profile);
      return profile;
    });
  },
  async resetQuotaMessages(guildId: string) {
    await db.update(userProfilesTable).set({ quotaMessages: 0 })
      .where(eq(userProfilesTable.guildId, guildId));
  },
  async addOrelyss(guildId: string, userId: string, amount: number) {
    return db.transaction(async (tx) => {
      const profile = await lockedProfile(tx, guildId, userId);
      profile.orelyss += amount;
      await upsertProfile(tx, profile);
      return profile;
    });
  },
  async addInventory(guildId: string, userId: string, objectId: string, amount: number) {
    return db.transaction(async (tx) => {
      const profile = await lockedProfile(tx, guildId, userId);
      profile.inventory[objectId] = (profile.inventory[objectId] ?? 0) + amount;
      if (profile.inventory[objectId] <= 0) delete profile.inventory[objectId];
      await upsertProfile(tx, profile);
      return profile;
    });
  },
};

export const noteStore = {
  async get(guildId: string): Promise<NoteEntry[]> {
    const rows = await db.select().from(communityNotesTable)
      .where(eq(communityNotesTable.guildId, guildId))
      .orderBy(desc(communityNotesTable.createdAt));
    return rows.map(noteFromRow);
  },
  async add(entry: NoteEntry) {
    await db.insert(communityNotesTable).values({
      id: entry.id,
      guildId: entry.guildId,
      memberId: entry.memberId,
      memberTag: entry.memberTag,
      authorId: entry.authorId,
      authorTag: entry.authorTag,
      text: entry.text,
      createdAt: entry.timestamp,
    });
  },
  async remove(guildId: string, id: string) {
    const deleted = await db.delete(communityNotesTable).where(and(
      eq(communityNotesTable.guildId, guildId),
      eq(communityNotesTable.id, id),
    )).returning({ id: communityNotesTable.id });
    return deleted.length > 0;
  },
};

export const articleStore = {
  async get(guildId: string): Promise<ShopArticle[]> {
    const rows = await db.select().from(shopArticlesTable)
      .where(eq(shopArticlesTable.guildId, guildId))
      .orderBy(asc(shopArticlesTable.sortOrder));
    return rows.map(articleFromRow);
  },
  async add(guildId: string, article: ShopArticle) {
    await db.insert(shopArticlesTable).values({
      id: article.id,
      guildId,
      name: article.name,
      description: article.description,
      price: article.price,
      stock: article.stock ?? null,
      objectId: article.objectId ?? null,
      createdAt: article.createdAt,
      sortOrder: article.sortOrder,
    });
  },
  async getById(guildId: string, id: string) {
    const [row] = await db.select().from(shopArticlesTable).where(and(
      eq(shopArticlesTable.guildId, guildId),
      eq(shopArticlesTable.id, id),
    )).limit(1);
    return row ? articleFromRow(row) : undefined;
  },
  async update(
    guildId: string,
    id: string,
    patch: Partial<Omit<ShopArticle, "stock">> & { stock?: number | null },
  ) {
    const article = await this.getById(guildId, id);
    if (!article) return false;
    await db.update(shopArticlesTable).set({
      name: patch.name ?? article.name,
      description: patch.description ?? article.description,
      price: patch.price ?? article.price,
      stock: patch.stock === undefined ? article.stock ?? null : patch.stock,
      objectId: patch.objectId ?? article.objectId ?? null,
      sortOrder: patch.sortOrder ?? article.sortOrder,
    }).where(and(eq(shopArticlesTable.guildId, guildId), eq(shopArticlesTable.id, id)));
    return true;
  },
  async updateOrder(guildId: string, id: string, position: number) {
    return db.transaction(async (tx) => {
      const rows = await tx.select().from(shopArticlesTable)
        .where(eq(shopArticlesTable.guildId, guildId))
        .orderBy(asc(shopArticlesTable.sortOrder))
        .for("update");
      const currentIndex = rows.findIndex((row) => row.id === id);
      if (currentIndex < 0) return false;

      const [article] = rows.splice(currentIndex, 1);
      const newIndex = Math.max(0, Math.min(rows.length, position - 1));
      rows.splice(newIndex, 0, article);
      for (let index = 0; index < rows.length; index += 1) {
        await tx.update(shopArticlesTable)
          .set({ sortOrder: index + 1 })
          .where(and(
            eq(shopArticlesTable.guildId, guildId),
            eq(shopArticlesTable.id, rows[index].id),
          ));
      }
      return true;
    });
  },
  async remove(guildId: string, id: string) {
    const deleted = await db.delete(shopArticlesTable).where(and(
      eq(shopArticlesTable.guildId, guildId),
      eq(shopArticlesTable.id, id),
    )).returning({ id: shopArticlesTable.id });
    return deleted.length > 0;
  },
  async purchase(guildId: string, id: string, userId: string, userTag: string) {
    return db.transaction(async (tx) => {
      const [articleRow] = await tx.select().from(shopArticlesTable).where(and(
        eq(shopArticlesTable.guildId, guildId),
        eq(shopArticlesTable.id, id),
      )).for("update").limit(1);
      if (!articleRow) return { ok: false as const, reason: "not_found" as const };
      if (articleRow.stock !== null && articleRow.stock <= 0) {
        return { ok: false as const, reason: "sold_out" as const };
      }
      const [profileRow] = await tx.select().from(userProfilesTable).where(and(
        eq(userProfilesTable.guildId, guildId),
        eq(userProfilesTable.userId, userId),
      )).for("update").limit(1);
      const profile = profileRow ? profileFromRow(profileRow) : newProfile(guildId, userId);
      if (profile.orelyss < articleRow.price) return { ok: false as const, reason: "funds" as const };
      profile.orelyss -= articleRow.price;
      if (articleRow.objectId) {
        profile.inventory[articleRow.objectId] = (profile.inventory[articleRow.objectId] ?? 0) + 1;
      }
      await upsertProfile(tx, profile);
      await tx.update(shopArticlesTable).set({
        stock: articleRow.stock === null ? null : articleRow.stock - 1,
      }).where(and(eq(shopArticlesTable.guildId, guildId), eq(shopArticlesTable.id, id)));
      const log: PurchaseLog = {
        id: randomUUID(),
        guildId,
        articleId: articleRow.id,
        articleName: articleRow.name,
        userId,
        userTag,
        price: articleRow.price,
        timestamp: Date.now(),
      };
      await tx.insert(purchaseLogsTable).values({
        id: log.id,
        guildId: log.guildId,
        articleId: log.articleId,
        articleName: log.articleName,
        userId: log.userId,
        userTag: log.userTag,
        price: log.price,
        createdAt: log.timestamp,
      });
      return { ok: true as const, article: articleFromRow({ ...articleRow, stock: articleRow.stock === null ? null : articleRow.stock - 1 }), profile, log };
    });
  },
  /**
   * Compense un achat si Discord refuse l'attribution du rôle.
   * La ligne d'achat empêche de rembourser deux fois la même transaction.
   */
  async refundRolePurchase(guildId: string, log: PurchaseLog, objectId?: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [purchaseRow] = await tx.select().from(purchaseLogsTable).where(and(
        eq(purchaseLogsTable.id, log.id),
        eq(purchaseLogsTable.guildId, guildId),
        eq(purchaseLogsTable.userId, log.userId),
      )).for("update").limit(1);
      if (!purchaseRow) return false;

      // Même ordre de verrouillage que purchase : article, puis profil.
      const [articleRow] = await tx.select().from(shopArticlesTable).where(and(
        eq(shopArticlesTable.guildId, guildId),
        eq(shopArticlesTable.id, purchaseRow.articleId),
      )).for("update").limit(1);
      const [profileRow] = await tx.select().from(userProfilesTable).where(and(
        eq(userProfilesTable.guildId, guildId),
        eq(userProfilesTable.userId, purchaseRow.userId),
      )).for("update").limit(1);
      if (!profileRow) throw new Error("Profil introuvable : remboursement impossible.");

      const profile = profileFromRow(profileRow);
      profile.orelyss += purchaseRow.price;
      if (objectId) {
        const quantity = profile.inventory[objectId] ?? 0;
        if (quantity > 1) profile.inventory[objectId] = quantity - 1;
        else delete profile.inventory[objectId];
      }
      await upsertProfile(tx, profile);
      if (articleRow && articleRow.stock !== null) {
        await tx.update(shopArticlesTable).set({ stock: articleRow.stock + 1 })
          .where(eq(shopArticlesTable.id, articleRow.id));
      }
      await tx.delete(purchaseLogsTable).where(eq(purchaseLogsTable.id, purchaseRow.id));
      return true;
    });
  },
  async purchases(guildId: string, limit = 25) {
    const rows = await db.select().from(purchaseLogsTable)
      .where(eq(purchaseLogsTable.guildId, guildId))
      .orderBy(desc(purchaseLogsTable.createdAt))
      .limit(limit);
    return rows.map(purchaseFromRow);
  },
};

export const objectStore = {
  async get(guildId: string): Promise<ServerObject[]> {
    const rows = await db.select().from(serverObjectsTable)
      .where(eq(serverObjectsTable.guildId, guildId))
      .orderBy(asc(serverObjectsTable.createdAt));
    return rows.map(objectFromRow);
  },
  async add(guildId: string, object: ServerObject) {
    await db.insert(serverObjectsTable).values({
      id: object.id,
      guildId,
      name: object.name,
      description: object.description,
      emoji: object.emoji,
      roleId: object.roleId ?? null,
      createdAt: object.createdAt,
    });
  },
  async setRole(guildId: string, id: string, roleId: string | null): Promise<boolean> {
    const rows = await db.update(serverObjectsTable)
      .set({ roleId })
      .where(and(eq(serverObjectsTable.guildId, guildId), eq(serverObjectsTable.id, id)))
      .returning({ id: serverObjectsTable.id });
    return rows.length > 0;
  },
  async getById(guildId: string, id: string) {
    const [row] = await db.select().from(serverObjectsTable).where(and(
      eq(serverObjectsTable.guildId, guildId),
      eq(serverObjectsTable.id, id),
    )).limit(1);
    return row ? objectFromRow(row) : undefined;
  },
};

export const questStore = {
  async get(guildId: string, includeExpired = false): Promise<Quest[]> {
    const rows = await db.select().from(questsTable)
      .where(eq(questsTable.guildId, guildId))
      .orderBy(asc(questsTable.createdAt));
    const quests = rows.map(questFromRow);
    return includeExpired ? quests : quests.filter((quest) => quest.expiresAt > Date.now());
  },
  async add(guildId: string, quest: Quest) {
    await db.insert(questsTable).values({
      id: quest.id,
      guildId,
      name: quest.name,
      activity: quest.activity,
      requirement: quest.requirement,
      rewardType: quest.rewardType,
      rewardValue: quest.rewardValue,
      rewardQuantity: quest.rewardQuantity,
      expiresAt: quest.expiresAt,
      createdAt: quest.createdAt,
    });
  },
  async getById(guildId: string, id: string) {
    const [row] = await db.select().from(questsTable).where(and(
      eq(questsTable.guildId, guildId),
      eq(questsTable.id, id),
    )).limit(1);
    return row ? questFromRow(row) : undefined;
  },
  async progress(guildId: string, userId: string, activity: "messages" | "vocal", amount: number) {
    return db.transaction(async (tx) => {
      const [profileRow] = await tx.select().from(userProfilesTable).where(and(
        eq(userProfilesTable.guildId, guildId),
        eq(userProfilesTable.userId, userId),
      )).for("update").limit(1);
      const profile = profileRow ? profileFromRow(profileRow) : newProfile(guildId, userId);
      const questRows = await tx.select().from(questsTable).where(eq(questsTable.guildId, guildId));
      const completed: Quest[] = [];
      for (const quest of questRows.map(questFromRow)) {
        if (quest.activity !== activity || quest.expiresAt <= Date.now() || profile.completedQuests.includes(quest.id)) continue;
        profile.questProgress[quest.id] = (profile.questProgress[quest.id] ?? 0) + amount;
        if (profile.questProgress[quest.id] >= quest.requirement) {
          profile.completedQuests.push(quest.id);
          completed.push(quest);
        }
      }
      await upsertProfile(tx, profile);
      return { profile, completed };
    });
  },
};