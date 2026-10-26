import {
  AuditLogEvent, ChannelType, Client, EmbedBuilder, Events,
  type Guild, type GuildMember, type Message, type PartialMessage,
  type MessageReaction, type PartialMessageReaction, type User,
  type VoiceState, type GuildChannel,
} from "discord.js";
import { logChannelStore } from "./store.js";

const trim = (value: unknown, max = 950) => {
  const str = String(value ?? "").replace(/\u0000/g, "");
  return str ? (str.length > max ? str.slice(0, max - 1) + "…" : str) : "*Indisponible*";
};
const who = (id: string | undefined) => id ? `<@${id}> (\`${id}\`)` : "Inconnu";
const ch = (id: string | null | undefined) => id ? `<#${id}>` : "Aucun";
const names = (values: Iterable<string>) => [...values].join(", ") || "Aucun";

async function emit(guild: Guild | null | undefined, title: string, fields: Array<[string, unknown]>, color = 0x5865f2, excludedChannelId?: string) {
  if (!guild) return;
  try {
    const id = logChannelStore.get(guild.id);
    if (!id || id === excludedChannelId) return;
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) return;
    const embed = new EmbedBuilder().setColor(color).setTitle(trim(title, 256)).setTimestamp()
      .addFields(fields.slice(0, 25).map(([name, value]) => ({ name: trim(name, 256), value: trim(value, 1024), inline: false })));
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (error) {
    console.error("[Logs] Envoi impossible :", error);
  }
}
const messageText = (message: Message | PartialMessage) => {
  const files = message.attachments?.map(a => a.url).join("\n");
  return [message.content || "(aucun texte / contenu indisponible)", files ? `Pièces jointes :\n${files}` : ""].filter(Boolean).join("\n");
};
const reactionText = (reaction: MessageReaction | PartialMessageReaction) =>
  reaction.emoji.id ? `<:${reaction.emoji.name ?? "emoji"}:${reaction.emoji.id}>` : reaction.emoji.name ?? "Emoji inconnu";

// Les événements de suppression peuvent contenir seulement un message "partial".
// On garde temporairement les messages récents pour pouvoir afficher leur contenu.
interface SavedMessage {
  authorId?: string;
  authorName?: string;
  text: string;
  savedAt: number;
}
const recentMessages = new Map<string, SavedMessage>();
const MAX_SAVED_MESSAGES = 3000;
const MAX_MESSAGE_AGE = 24 * 60 * 60 * 1000;

function rememberMessage(message: Message | PartialMessage) {
  if (!message.guild || message.partial || message.channelId === logChannelStore.get(message.guild.id)) return;
  const attachments = message.attachments.map(a => a.url).slice(0, 5);
  const text = [message.content || "(message sans texte)",
    attachments.length ? `Pièces jointes :\n${attachments.join("\n")}` : ""].filter(Boolean).join("\n");
  const saved: SavedMessage = {
    authorId: message.author?.id,
    authorName: message.author?.tag,
    text: trim(text, 3500),
    savedAt: Date.now(),
  };
  recentMessages.delete(message.id);
  recentMessages.set(message.id, saved);
  // Limite mémoire et durée de conservation même sur les serveurs très actifs.
  while (recentMessages.size > MAX_SAVED_MESSAGES) {
    const oldest = recentMessages.keys().next().value;
    if (!oldest) break;
    recentMessages.delete(oldest);
  }
  for (const [id, entry] of recentMessages) {
    if (Date.now() - entry.savedAt < MAX_MESSAGE_AGE) break;
    recentMessages.delete(id);
  }
}

function deletedMessageDetails(message: Message | PartialMessage): { author: string; text: string } {
  const saved = recentMessages.get(message.id);
  recentMessages.delete(message.id);
  const authorId = message.author?.id ?? saved?.authorId;
  const authorName = message.author?.tag ?? saved?.authorName;
  const text = !message.partial ? messageText(message) : saved?.text ?? "(contenu indisponible : message non présent en cache)";
  return {
    author: `${who(authorId)}${authorName ? ` — ${authorName}` : ""}`,
    text,
  };
}

export function registerDiscordLogs(client: Client) {
  client.on(Events.MessageCreate, message => {
    rememberMessage(message);
  });
  client.on(Events.MessageUpdate, async (oldMsg, newMsg) => {
    if (!newMsg.guild) return;
    rememberMessage(newMsg);
    if (newMsg.author?.bot || oldMsg.content === newMsg.content) return;
    await emit(newMsg.guild, "✏️ Message modifié", [
      ["Auteur", who(newMsg.author?.id ?? oldMsg.author?.id)],
      ["Salon", ch(newMsg.channelId)],
      ["Avant", messageText(oldMsg)],
      ["Après", messageText(newMsg)],
      ["Message", `https://discord.com/channels/${newMsg.guild.id}/${newMsg.channelId}/${newMsg.id}`],
    ], 0xfee75c, newMsg.channelId);
  });
  client.on(Events.MessageDelete, async msg => {
    if (!msg.guild) return;
    const details = deletedMessageDetails(msg);
    await emit(msg.guild, "🗑️ Message supprimé", [
      ["Auteur", details.author],
      ["Salon", ch(msg.channelId)],
      ["Contenu du message", details.text],
      ["ID du message", msg.id],
    ], 0xed4245, msg.channelId);
  });
  client.on(Events.MessageBulkDelete, async msgs => {
    const first = msgs.first();
    if (!first?.guild) return;
    // /clear et les autres suppressions multiples : afficher chaque message,
    // mais regrouper les résultats pour ne pas envoyer 100 embeds séparés.
    const entries = [...msgs.values()].map(msg => ({ msg, details: deletedMessageDetails(msg) }));
    for (let index = 0; index < entries.length; index += 10) {
      const part = entries.slice(index, index + 10);
      await emit(first.guild, `🗑️ Messages supprimés (${index + 1}–${index + part.length} / ${entries.length})`, [
        ["Salon", ch(first.channelId)],
        ["Nombre total", entries.length],
        ...part.map(({ msg, details }): [string, string] =>
          [`Message ${msg.id} — ${details.author}`, details.text]),
      ], 0xed4245, first.channelId);
    }
  });
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (!reaction.message.guild || user.bot) return;
    await emit(reaction.message.guild, "➕ Réaction ajoutée", [["Membre", who(user.id)], ["Salon", ch(reaction.message.channelId)],
      ["Réaction", reactionText(reaction)], ["Message", reaction.message.url]], 0x57f287, reaction.message.channelId);
  });
  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (!reaction.message.guild || user.bot) return;
    await emit(reaction.message.guild, "➖ Réaction retirée", [["Membre", who(user.id)], ["Salon", ch(reaction.message.channelId)],
      ["Réaction", reactionText(reaction)], ["Message", reaction.message.url]], 0xed4245, reaction.message.channelId);
  });
  client.on(Events.MessageReactionRemoveAll, async message => {
    if (!message.guild) return;
    await emit(message.guild, "🧹 Réactions supprimées", [["Salon", ch(message.channelId)], ["Message", message.url]], 0xfaa61a, message.channelId);
  });
  client.on(Events.VoiceStateUpdate, async (before: VoiceState, after: VoiceState) => {
    if (before.channelId !== after.channelId) {
      const title = !before.channelId ? "🔊 Vocal rejoint" : !after.channelId ? "🔇 Vocal quitté" : "🔀 Vocal déplacé";
      await emit(after.guild, title, [["Membre", who(after.id)], ["Avant", ch(before.channelId)], ["Après", ch(after.channelId)]]);
    }
    for (const [field, label] of [["selfMute", "Micro personnel"], ["selfDeaf", "Casque personnel"],
      ["serverMute", "Micro serveur"], ["serverDeaf", "Casque serveur"], ["streaming", "Partage d'écran"],
      ["selfVideo", "Caméra"]] as const) {
      if (before[field] !== after[field]) {
        await emit(after.guild, "🎙️ État vocal modifié", [["Membre", who(after.id)], ["Salon", ch(after.channelId)],
          ["Action", label], ["État", String(after[field] ? "Activé" : "Désactivé")]]);
      }
    }
  });
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    await emit(member.guild, "📥 Membre arrivé", [["Membre", who(member.id)], ["Compte créé", `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>`]], 0x57f287);
  });
  client.on(Events.GuildMemberRemove, async (member: GuildMember) => {
    await emit(member.guild, "📤 Membre parti", [["Membre", who(member.id)], ["Pseudo", member.user.tag]], 0xed4245);
  });
  client.on(Events.GuildMemberUpdate, async (before, after) => {
    if (before.nickname !== after.nickname) {
      await emit(after.guild, "📝 Surnom modifié", [["Membre", who(after.id)], ["Avant", before.nickname ?? before.user.username],
        ["Après", after.nickname ?? after.user.username]]);
    }
    const added = after.roles.cache.filter(r => !before.roles.cache.has(r.id)).map(r => r.name);
    const removed = before.roles.cache.filter(r => !after.roles.cache.has(r.id)).map(r => r.name);
    if (added.length || removed.length) await emit(after.guild, "🏷️ Rôles du membre modifiés", [
      ["Membre", who(after.id)], ["Ajoutés", names(added)], ["Retirés", names(removed)]]);
    if (before.communicationDisabledUntilTimestamp !== after.communicationDisabledUntilTimestamp) {
      await emit(after.guild, "⏳ Timeout modifié", [["Membre", who(after.id)], ["Fin du timeout", after.communicationDisabledUntilTimestamp
        ? `<t:${Math.floor(after.communicationDisabledUntilTimestamp / 1000)}:F>` : "Aucun"]], 0xfaa61a);
    }
  });
  client.on(Events.GuildBanAdd, async ban => emit(ban.guild, "🔨 Membre banni",
    [["Membre", who(ban.user.id)], ["Pseudo", ban.user.tag], ["Raison", ban.reason ?? "Non fournie"]], 0xed4245));
  client.on(Events.GuildBanRemove, async ban => emit(ban.guild, "✅ Bannissement levé",
    [["Membre", who(ban.user.id)], ["Pseudo", ban.user.tag]], 0x57f287));
  client.on(Events.ChannelCreate, async channel => {
    if (!("guild" in channel)) return;
    await emit(channel.guild, "📁 Salon créé", [["Salon", channel.name], ["ID", channel.id]]);
  });
  client.on(Events.ChannelDelete, async channel => {
    if (!("guild" in channel)) return;
    await emit(channel.guild, "🗑️ Salon supprimé", [["Nom", channel.name], ["ID", channel.id]], 0xed4245);
  });
  client.on(Events.ChannelUpdate, async (before, after) => {
    if (!("guild" in after) || !("name" in after) || !("name" in before)) return;
    const changes: Array<[string, unknown]> = [];
    if (before.name !== after.name) changes.push(["Nom", `${before.name} → ${after.name}`]);
    if ("topic" in before && "topic" in after && before.topic !== after.topic)
      changes.push(["Sujet", `${before.topic ?? "Aucun"} → ${after.topic ?? "Aucun"}`]);
    if ("parentId" in before && "parentId" in after && before.parentId !== after.parentId)
      changes.push(["Catégorie", `${ch(before.parentId)} → ${ch(after.parentId)}`]);
    if ("rateLimitPerUser" in before && "rateLimitPerUser" in after && before.rateLimitPerUser !== after.rateLimitPerUser)
      changes.push(["Slowmode", `${before.rateLimitPerUser}s → ${after.rateLimitPerUser}s`]);
    if ("permissionOverwrites" in before && "permissionOverwrites" in after &&
      JSON.stringify(before.permissionOverwrites.cache.map(p => [p.id, p.allow.bitfield.toString(), p.deny.bitfield.toString()]).sort()) !==
      JSON.stringify(after.permissionOverwrites.cache.map(p => [p.id, p.allow.bitfield.toString(), p.deny.bitfield.toString()]).sort()))
      changes.push(["Permissions", "Permissions du salon modifiées"]);
    if (changes.length) await emit(after.guild, "⚙️ Salon modifié", [["Salon", ch(after.id)], ...changes]);
  });
  client.on(Events.GuildRoleCreate, async role => emit(role.guild, "➕ Rôle créé", [["Rôle", role.name], ["ID", role.id]], 0x57f287));
  client.on(Events.GuildRoleDelete, async role => emit(role.guild, "➖ Rôle supprimé", [["Rôle", role.name], ["ID", role.id]], 0xed4245));
  client.on(Events.GuildRoleUpdate, async (before, after) => {
    const changes: Array<[string, unknown]> = [];
    if (before.name !== after.name) changes.push(["Nom", `${before.name} → ${after.name}`]);
    if (before.hexColor !== after.hexColor) changes.push(["Couleur", `${before.hexColor} → ${after.hexColor}`]);
    if (before.permissions.bitfield !== after.permissions.bitfield) changes.push(["Permissions", "Permissions du rôle modifiées"]);
    if (before.hoist !== after.hoist) changes.push(["Affichage séparé", String(after.hoist)]);
    if (before.mentionable !== after.mentionable) changes.push(["Mentionnable", String(after.mentionable)]);
    if (changes.length) await emit(after.guild, "🛠️ Rôle modifié", [["Rôle", `<@&${after.id}>`], ...changes]);
  });
  client.on(Events.GuildUpdate, async (before, after) => {
    const changes: Array<[string, unknown]> = [];
    if (before.name !== after.name) changes.push(["Nom", `${before.name} → ${after.name}`]);
    if (before.description !== after.description) changes.push(["Description", `${before.description ?? "Aucune"} → ${after.description ?? "Aucune"}`]);
    if (before.verificationLevel !== after.verificationLevel) changes.push(["Vérification", `${before.verificationLevel} → ${after.verificationLevel}`]);
    if (changes.length) await emit(after, "🏠 Serveur modifié", changes);
  });
  client.on(Events.GuildEmojiCreate, async emoji => emit(emoji.guild, "😀 Emoji ajouté", [["Emoji", emoji.name], ["ID", emoji.id]]));
  client.on(Events.GuildEmojiDelete, async emoji => emit(emoji.guild, "😀 Emoji supprimé", [["Emoji", emoji.name], ["ID", emoji.id]]));
  client.on(Events.GuildEmojiUpdate, async (before, after) => {
    if (before.name !== after.name) await emit(after.guild, "😀 Emoji renommé", [["Avant", before.name], ["Après", after.name]]);
  });
  client.on(Events.InviteCreate, async invite => {
    if (!invite.guild || !("channels" in invite.guild)) return;
    await emit(invite.guild as Guild, "🔗 Invitation créée", [["Code", invite.code], ["Salon", ch(invite.channelId)],
      ["Créateur", who(invite.inviter?.id)]]);
  });
  client.on(Events.InviteDelete, async invite => {
    if (!invite.guild || !("channels" in invite.guild)) return;
    await emit(invite.guild as Guild, "🔗 Invitation supprimée", [["Code", invite.code], ["Salon", ch(invite.channelId)]], 0xed4245);
  });
  client.on(Events.ThreadCreate, async thread => emit(thread.guild, "🧵 Fil créé", [["Fil", thread.name], ["ID", thread.id]]));
  client.on(Events.ThreadDelete, async thread => emit(thread.guild, "🧵 Fil supprimé", [["Fil", thread.name], ["ID", thread.id]], 0xed4245));
  client.on(Events.ThreadUpdate, async (before, after) => {
    if (before.name !== after.name || before.archived !== after.archived || before.locked !== after.locked)
      await emit(after.guild, "🧵 Fil modifié", [["Fil", after.name], ["Ancien nom", before.name],
        ["Archivé", String(after.archived)], ["Verrouillé", String(after.locked)]]);
  });
  client.on(Events.AutoModerationActionExecution, async result => {
    await emit(result.guild, "🛡️ AutoMod déclenché", [
      ["Membre", who(result.userId)], ["Salon", ch(result.channelId)], ["Règle", result.ruleId],
      ["Action", String(result.action.type)], ["Contenu", result.matchedContent || "(indisponible)"]], 0xfaa61a);
  });
}
