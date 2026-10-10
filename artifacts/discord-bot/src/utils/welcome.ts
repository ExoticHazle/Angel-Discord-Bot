import type { GuildMember } from "discord.js";

export const DEFAULT_WELCOME_TEMPLATE =
  "✨ Bienvenue {user} sur **{server}** ! Tu es notre {memberCount}ᵉ membre. Installe-toi et profite du serveur.";

export function renderWelcomeMessage(template: string, member: GuildMember) {
  const variables: Record<string, string> = {
    user: `<@${member.id}>`,
    username: member.displayName.replace(/@/g, "@\u200b"),
    server: member.guild.name.replace(/@/g, "@\u200b"),
    memberCount: member.guild.memberCount.toLocaleString("fr-FR"),
  };

  return template
    .replace(/\{(user|username|server|memberCount)\}/g, (_, key: string) => variables[key])
    .slice(0, 1_900);
}
