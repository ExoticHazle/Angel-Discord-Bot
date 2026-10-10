import { ChannelType, Events, type GuildMember } from "discord.js";
import { autoroleStore, communityConfigStore } from "../utils/store.js";
import { DEFAULT_WELCOME_TEMPLATE, buildWelcomePayload } from "../utils/welcome.js";

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member: GuildMember) {
    const roleIds = autoroleStore.get(member.guild.id);
    for (const roleId of roleIds) {
      try {
        await member.roles.add(roleId);
        console.log(`[Autorole] Rôle ${roleId} ajouté à ${member.user.tag}`);
      } catch (err) {
        console.error(`[Autorole] Impossible d'ajouter le rôle ${roleId} à ${member.user.tag}:`, err);
      }
    }

    let config;
    try {
      config = await communityConfigStore.get(member.guild.id);
    } catch (err) {
      console.error(`[Welcome] Impossible de lire la configuration de ${member.guild.name}:`, err);
      return;
    }
    if (!config.welcomeChannelId) return;

    const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
    if (!channel || channel.type !== ChannelType.GuildText) {
      console.error(`[Welcome] Le salon configuré est introuvable ou n'est pas un salon texte.`);
      return;
    }

    await channel.send(
      buildWelcomePayload(
        config.welcomeMessage ?? DEFAULT_WELCOME_TEMPLATE,
        member,
        member.joinedAt ?? new Date(),
      ),
    ).catch((err) => {
      console.error(`[Welcome] Impossible d'envoyer le message à ${channel.name}:`, err);
    });
  },
};
