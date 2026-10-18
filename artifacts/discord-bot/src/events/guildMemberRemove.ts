import { ChannelType, Events, type GuildMember } from "discord.js";
import { communityConfigStore } from "../utils/store.js";
import { DEFAULT_GOODBYE_TEMPLATE, buildGoodbyePayload } from "../utils/goodbye.js";

export default {
  name: Events.GuildMemberRemove,
  once: false,
  async execute(member: GuildMember) {
    try {
      const config = await communityConfigStore.get(member.guild.id);
      if (!config.goodbyeChannelId) return;
      const channel = await member.guild.channels.fetch(config.goodbyeChannelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) return;
      await channel.send(buildGoodbyePayload(config.goodbyeMessage ?? DEFAULT_GOODBYE_TEMPLATE, member));
    } catch (err) {
      console.error("[Goodbye] Impossible d'envoyer le message de départ :", err);
    }
  },
};
