import {
  AttachmentBuilder,
  EmbedBuilder,
  type GuildMember,
  type MessageCreateOptions,
} from "discord.js";
import { fileURLToPath } from "node:url";
import { everyoneMessageParts } from "./everyoneMention.js";

export const DEFAULT_GOODBYE_TEMPLATE = "{username} a quitté le serveur.";

const GOODBYE_IMAGE_NAME = "angel-goodbye.webp";
const GOODBYE_IMAGE_PATH = fileURLToPath(
  new URL("../../assets/angel-goodbye.webp", import.meta.url),
);

function renderGoodbyeMessage(template: string, member: GuildMember): string {
  // Un membre qui quitte le serveur ne doit pas être mentionné/ping.
  const safeUsername = member.user.username.replace(/@/g, "@\u200b");
  const variables: Record<string, string> = {
    user: safeUsername,
    username: safeUsername,
    server: member.guild.name.replace(/@/g, "@\u200b"),
    memberCount: member.guild.memberCount.toLocaleString("fr-FR"),
  };
  return template
    .replace(/\{(user|username|server|memberCount)\}/g, (_, key: string) => variables[key])
    .slice(0, 1900);
}

export function buildGoodbyePayload(
  template: string,
  member: GuildMember,
  departureDate: Date = new Date(),
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
  }).format(departureDate);

  const { templateWithoutMentions, options } = everyoneMessageParts(template, notifyEveryone);

  const embed = new EmbedBuilder()
    .setColor(0xf15b5b)
    .setTitle("👋 Départ")
    .setDescription(renderGoodbyeMessage(templateWithoutMentions || DEFAULT_GOODBYE_TEMPLATE, member))
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .setImage("attachment://" + GOODBYE_IMAGE_NAME)
    .setFooter({ text: date });

  return {
    embeds: [embed],
    files: [new AttachmentBuilder(GOODBYE_IMAGE_PATH, { name: GOODBYE_IMAGE_NAME })],
    ...options,
  };
}
