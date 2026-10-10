import {
  ChannelType,
  type Client,
  type Guild,
  type GuildMember,
  type TextChannel,
  type VoiceState,
} from "discord.js";
import { staffWarnsStore, communityConfigStore, profileStore } from "./store.js";
import {
  currentQuotaPeriodKey,
  isQuotaReminderSunday,
  quotaSundayKey,
} from "./time.js";
import { recordActivity } from "./gamification.js";

interface VoiceSession {
  guild: Guild;
  member: GuildMember;
  channelId: string;
  startedAt: number;
  creditedMinutes: number;
}

const voiceSessions = new Map<string, VoiceSession>();

function voiceSessionKey(guildId: string, userId: string) {
  return `${guildId}:${userId}`;
}

function isEligibleForVoiceXp(state: VoiceState) {
  return Boolean(
    state.channelId &&
      state.member &&
      !state.member.user.bot &&
      !state.serverMute &&
      !state.serverDeaf &&
      !state.selfMute &&
      !state.selfDeaf,
  );
}

async function getMembers(guild: Guild) {
  return guild.members.fetch().catch(() => guild.members.cache);
}

function quotaForMember(member: GuildMember, roles: Record<string, number>) {
  return Math.max(
    0,
    ...Object.entries(roles)
      .filter(([roleId]) => member.roles.cache.has(roleId))
      .map(([, quota]) => quota),
  );
}

async function sendQuotaMessage(guild: Guild, content: string) {
  const channelId = (await communityConfigStore.get(guild.id)).quotaAdminChannelId;
  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (channel?.type === ChannelType.GuildText) {
    const lines = content.split("\n");
    const chunks: string[] = [];
    let chunk = "";
    for (const line of lines) {
      if (chunk.length + line.length + 1 > 1_800) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk += `${chunk ? "\n" : ""}${line}`;
    }
    if (chunk) chunks.push(chunk);
    for (const part of chunks) {
      await (channel as TextChannel).send(part).catch(() => null);
    }
  }
}

async function remindQuotas(guild: Guild, sundayKey: string) {
  const config = await communityConfigStore.get(guild.id);
  if (config.quotaReminderKey === sundayKey) return;
  const members = await getMembers(guild);

  for (const member of members.values()) {
    if (member.user.bot) continue;
    const quota = quotaForMember(member, config.quotaRoles);
    if (!quota) continue;
    const profile = await profileStore.get(guild.id, member.id);
    await member.user
      .send(
        `⏰ Rappel quota sur **${guild.name}** : ` +
        `vous êtes à **${profile.quotaMessages}/${quota}** messages.`,
      )
      .catch(() => null);
  }

  config.quotaReminderKey = sundayKey;
  await communityConfigStore.save(guild.id, config);
}

async function resetQuotas(guild: Guild) {
  const config = await communityConfigStore.get(guild.id);
  const members = await getMembers(guild);
  const report: string[] = [];

  for (const member of members.values()) {
    if (member.user.bot) continue;
    const quota = quotaForMember(member, config.quotaRoles);
    if (!quota) continue;
    const profile = await profileStore.get(guild.id, member.id);
    const missed = profile.quotaMessages < quota;
    if (missed) {
      const reason = `Quota non respecté : ${profile.quotaMessages}/${quota} messages`;
      staffWarnsStore.add(`${guild.id}-${member.id}`, {
        moderator: "Angel — système automatique",
        moderatorId: guild.client.user?.id ?? "system",
        reason,
        timestamp: Date.now(),
      });
      report.push(`• <@${member.id}> (${member.user.tag}) — ${profile.quotaMessages}/${quota} ⚠️`);
      await member.user
        .send(`⚠️ Votre quota sur **${guild.name}** n’a pas été respecté : **${profile.quotaMessages}/${quota}**.`)
        .catch(() => null);
    } else {
      report.push(`• <@${member.id}> (${member.user.tag}) — ${profile.quotaMessages}/${quota} ✅`);
      await member.user
        .send(`✅ Quota terminé sur **${guild.name}** : **${profile.quotaMessages}/${quota}** messages.`)
        .catch(() => null);
    }
  }

  await profileStore.resetQuotaMessages(guild.id);
  await sendQuotaMessage(
    guild,
    [
      "📊 **Bilan des quotas — réinitialisation effectuée**",
      ...(report.length ? report : ["Aucun membre avec un quota configuré."]),
    ].join("\n"),
  );
}

function beginVoiceSession(state: VoiceState, startedAt = Date.now()) {
  if (!isEligibleForVoiceXp(state) || !state.member || !state.channelId) return;
  voiceSessions.set(voiceSessionKey(state.guild.id, state.id), {
    guild: state.guild,
    member: state.member,
    channelId: state.channelId,
    startedAt,
    creditedMinutes: 0,
  });
}

export function observeVoiceStateUpdate(previous: VoiceState, current: VoiceState) {
  const key = voiceSessionKey(current.guild.id, current.id);
  const wasEligible = isEligibleForVoiceXp(previous);
  const isEligible = isEligibleForVoiceXp(current);
  if (!isEligible) {
    voiceSessions.delete(key);
    return;
  }
  if (!wasEligible || previous.channelId !== current.channelId || !voiceSessions.has(key)) {
    voiceSessions.delete(key);
    beginVoiceSession(current);
  } else {
    const session = voiceSessions.get(key);
    if (session && current.member) session.member = current.member;
  }
}

function seedVoiceSessions(client: Client) {
  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    for (const state of guild.voiceStates.cache.values()) {
      beginVoiceSession(state, now);
    }
  }
}

async function trackVoiceMinutes() {
  const now = Date.now();
  for (const [key, session] of voiceSessions) {
    const state = session.member.voice;
    if (
      !isEligibleForVoiceXp(state) ||
      state.channelId !== session.channelId
    ) {
      voiceSessions.delete(key);
      continue;
    }
    const elapsedMinutes = Math.floor((now - session.startedAt) / 60_000);
    const minutesToCredit = elapsedMinutes - session.creditedMinutes;
    if (minutesToCredit <= 0) continue;
    await recordActivity(session.guild, session.member, "vocal", minutesToCredit);
    session.creditedMinutes = elapsedMinutes;
  }
}

async function syncQuotas(guild: Guild, currentSundayKey: string) {
  const config = await communityConfigStore.get(guild.id);
  const periodKey = currentQuotaPeriodKey();

  if (!config.quotaPeriodKey) {
    config.quotaPeriodKey = periodKey;
    await communityConfigStore.save(guild.id, config);
  } else if (config.quotaPeriodKey !== periodKey) {
    await resetQuotas(guild);
    config.quotaPeriodKey = periodKey;
    config.quotaReminderKey = undefined;
    await communityConfigStore.save(guild.id, config);
  }

  if (isQuotaReminderSunday() && config.quotaReminderKey !== currentSundayKey) {
    await remindQuotas(guild, currentSundayKey);
  }
}

export async function runCommunityScheduler(client: Client) {
  const sundayKey = quotaSundayKey();
  for (const guild of client.guilds.cache.values()) {
    await syncQuotas(guild, sundayKey);
  }
  await trackVoiceMinutes();
}

export function startCommunityScheduler(client: Client) {
  seedVoiceSessions(client);
  const run = () => runCommunityScheduler(client).catch((error) => {
    console.error("[CommunityScheduler]", error);
  });
  const timer = setInterval(run, 60_000);
  timer.unref();
  return timer;
}