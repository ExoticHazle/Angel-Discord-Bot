import type { MessageCreateOptions } from "discord.js";

/**
 * Les mentions présentes uniquement dans un embed ne déclenchent aucune
 * notification. Lorsqu'un administrateur écrit @everyone ou @here dans
 * son modèle, on les place donc dans le contenu du message Discord.
 */
const EVERYONE_PATTERN = /@(?:everyone|here)\b/g;

export function hasEveryoneMention(template: string): boolean {
  return /@(?:everyone|here)\b/.test(template);
}

export function everyoneMessageParts(
  template: string,
  notify = true,
): { templateWithoutMentions: string; options: Pick<MessageCreateOptions, "content" | "allowedMentions"> } {
  const mentions = [...new Set(template.match(EVERYONE_PATTERN) ?? [])];
  const templateWithoutMentions = template
    .replace(EVERYONE_PATTERN, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  const sendMentions = notify && mentions.length > 0;

  return {
    templateWithoutMentions,
    options: {
      ...(sendMentions ? { content: mentions.join(" ") } : {}),
      allowedMentions: { parse: sendMentions ? ["everyone"] : [] },
    },
  };
}
