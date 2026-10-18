import { AttachmentBuilder, EmbedBuilder, type GuildMember, type MessageCreateOptions } from "discord.js";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { everyoneMessageParts } from "./everyoneMention.js";

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

/**
 * Le texte reste personnalisable via /bienvenue configurer.
 * L'embed, la bannière et la date sont ajoutés automatiquement.
 * La date est affichée dans le footer (en bas à gauche), en heure française.
 */
const WELCOME_IMAGE_NAME = "angel-welcome.webp";
const WELCOME_IMAGE_PATH = fileURLToPath(
  new URL("../../assets/angel-welcome.webp", import.meta.url),
);

export function buildWelcomePayload(
  template: string,
  member: GuildMember,
  arrivalDate: Date = new Date(),
  notifyEveryone = true,
): MessageCreateOptions {
  const date = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(arrivalDate);

  const { templateWithoutMentions, options } = everyoneMessageParts(template, notifyEveryone);

  const embed = new EmbedBuilder()
    .setColor(0x10346b)
    .setDescription(renderWelcomeMessage(templateWithoutMentions || DEFAULT_WELCOME_TEMPLATE, member))
    .setFooter({ text: `📅 ${date}` });

  const payload: MessageCreateOptions = {
    embeds: [embed],
    ...options,
  };

  if (existsSync(WELCOME_IMAGE_PATH)) {
    embed.setImage(`attachment://${WELCOME_IMAGE_NAME}`);
    payload.files = [
      new AttachmentBuilder(WELCOME_IMAGE_PATH, { name: WELCOME_IMAGE_NAME }),
    ];
  }

  return payload;
}
