import { EmbedBuilder, type GuildMember, type MessageCreateOptions } from "discord.js";

export const DEFAULT_GOODBYE_TEMPLATE = "👋 {username} a quitté **{server}**. Nous sommes maintenant {memberCount} membres.";

export function buildGoodbyePayload(template: string, member: GuildMember): MessageCreateOptions {
  const values: Record<string, string> = {
    user: member.user.username.replace(/@/g, "@\u200b"),
    username: member.user.username.replace(/@/g, "@\u200b"),
    server: member.guild.name.replace(/@/g, "@\u200b"),
    memberCount: member.guild.memberCount.toLocaleString("fr-FR"),
  };
  const description = template.replace(/\{(user|username|server|memberCount)\}/g, (_, key: string) => values[key]).slice(0, 1900);
  return {
    embeds: [new EmbedBuilder().setColor(0x10346b).setTitle("👋 Départ d’un membre").setDescription(description).setTimestamp()],
    allowedMentions: { parse: [] },
  };
}
