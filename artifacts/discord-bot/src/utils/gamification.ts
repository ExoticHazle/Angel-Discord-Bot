import {
  EmbedBuilder,
  type Guild,
  type GuildMember,
  type User,
} from "discord.js";
import {
  communityConfigStore,
  objectStore,
  profileStore,
  questStore,
} from "./store.js";
import type { Quest, QuestActivity } from "../types.js";
import { orelyssIconAttachment, withOrelyssIcon } from "./currency.js";

async function sendLevelUp(guild: Guild, user: User, level: number, orelyss: number) {
  const channelId = (await communityConfigStore.get(guild.id)).levelsChannelId;
  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = withOrelyssIcon(
    new EmbedBuilder()
      .setColor(0x9b59b6)
      .setDescription(
        "╭─────────────────────────────✦\n\n" +
        "🌠 **ASCENSION CÉLESTE**\n\n" +
        `${user} vient d’atteindre le **Niveau ${level}** ! ✨\n\n` +
        `✧ **+${orelyss.toLocaleString("fr-FR")} Orëlyss**\n\n` +
        "« Une nouvelle étoile vient de s’éveiller dans les cieux 💫 »\n\n" +
        "╰─────────────────────────────✦",
      )
      .setThumbnail(user.displayAvatarURL())
      .setTimestamp(),
    "Récompense en Orëlyss",
  );

  await channel.send({
    embeds: [embed],
    files: [orelyssIconAttachment()],
  }).catch(() => null);
}

async function rewardQuest(guild: Guild, user: User, quest: Quest) {
  let rewardText = "";

  if (quest.rewardType === "orelyss") {
    const amount = Number(quest.rewardValue) || 0;
    await profileStore.addOrelyss(guild.id, user.id, amount);
    rewardText = `${amount.toLocaleString("fr-FR")} Orëlyss`;
  } else if (quest.rewardType === "xp") {
    const amount = Number(quest.rewardValue) || 0;
    const result = await profileStore.addXp(guild.id, user.id, amount);
    rewardText = `${amount} XP`;
    for (const level of result.levels) {
      await sendLevelUp(guild, user, level, level === 1 ? 100 : 100 + 50 * (level - 1));
    }
  } else if (quest.rewardType === "objet") {
    const object = await objectStore.getById(guild.id, quest.rewardValue);
    const quantity = Math.max(1, quest.rewardQuantity);
    if (object) {
      await profileStore.addInventory(guild.id, user.id, object.id, quantity);
      rewardText = `${object.emoji} ${object.name} ×${quantity}`;
    } else {
      rewardText = "objet configuré mais introuvable";
    }
  } else if (quest.rewardType === "role") {
    const role = guild.roles.cache.get(quest.rewardValue);
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (role && member) {
      await member.roles.add(role).catch(() => null);
      rewardText = `rôle ${role}`;
    } else {
      rewardText = "rôle configuré mais introuvable";
    }
  }

  if (quest.rewardType === "orelyss") {
    const embed = withOrelyssIcon(
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle("Quête accomplie")
        .setDescription(
          `✅ Quête accomplie sur **${guild.name}** !\n**${quest.name}**\nRécompense : **${rewardText}**`,
        ),
      "Récompense en Orëlyss",
    );
    await user.send({
      embeds: [embed],
      files: [orelyssIconAttachment()],
    }).catch(() => null);
  } else {
    await user
      .send(
        `✅ Quête accomplie sur **${guild.name}** !\n` +
        `**${quest.name}**\nRécompense : ${rewardText}`,
      )
      .catch(() => null);
  }
}

export async function recordActivity(
  guild: Guild,
  member: GuildMember,
  activity: QuestActivity,
  amount = 1,
) {
  if (member.user.bot) return;

  const config = await communityConfigStore.get(guild.id);
  const hasQuotaRole = Object.keys(config.quotaRoles).some((roleId) =>
    member.roles.cache.has(roleId),
  );
  if (activity === "messages") {
    await profileStore.addMessage(guild.id, member.id, amount, hasQuotaRole);
  } else {
    await profileStore.addVoiceMinute(guild.id, member.id, amount);
  }

  const xpResult = await profileStore.addXp(
    guild.id,
    member.id,
    activity === "messages" ? 20 * amount : 5 * amount,
  );
  for (const level of xpResult.levels) {
    await sendLevelUp(
      guild,
      member.user,
      level,
      level === 1 ? 100 : 100 + 50 * (level - 1),
    );
  }

  const questResult = await questStore.progress(guild.id, member.id, activity, amount);
  for (const quest of questResult.completed) {
    await rewardQuest(guild, member.user, quest);
  }
}