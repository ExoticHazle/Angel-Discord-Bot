import { Events, type GuildMember } from "discord.js";
import { autoroleStore } from "../utils/store.js";

export default {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member: GuildMember) {
    const roleIds = autoroleStore.get(member.guild.id);
    if (!roleIds || roleIds.length === 0) return;

    for (const roleId of roleIds) {
      try {
        await member.roles.add(roleId);
        console.log(`[Autorole] Rôle ${roleId} ajouté à ${member.user.tag}`);
      } catch (err) {
        console.error(`[Autorole] Impossible d'ajouter le rôle ${roleId} à ${member.user.tag}:`, err);
      }
    }
  },
};
