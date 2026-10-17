import { ChannelType, Events, type Client } from "discord.js";
import { runCommunityScheduler, startCommunityScheduler } from "../utils/scheduler.js";
import { ticketStore } from "../utils/store.js";

async function restoreOpenTickets(client: Client) {
  for (const guild of client.guilds.cache.values()) {
    const [channels, members] = await Promise.all([
      guild.channels.fetch().catch(() => null),
      guild.members.fetch().catch(() => null),
    ]);
    if (!channels) continue;

    for (const channel of channels.values()) {
      if (!channel || channel.type !== ChannelType.GuildText || !channel.name.startsWith("ticket-")) continue;
      const explicitOwnerId = channel.topic?.match(/User ID:\s*(\d{17,20})/i)?.[1];
      const oldOwnerTag = channel.topic?.match(/^Ticket de (.+?)(?:\s*\||$)/)?.[1];
      const ownerId =
        explicitOwnerId ??
        members?.find((member) => member.user.tag === oldOwnerTag)?.id;
      if (ownerId && ticketStore.get(guild.id, ownerId) !== channel.id) {
        await ticketStore.set(guild.id, ownerId, channel.id);
      }
    }
  }
}

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client: Client) {
    console.log(`✅ Bot connecté en tant que ${client.user?.tag}`);
    client.user?.setActivity("Serveur protégé 🛡️");
    await restoreOpenTickets(client);
    await runCommunityScheduler(client);
    await startCommunityScheduler(client);
  },
};
