import { AttachmentBuilder, EmbedBuilder } from "discord.js";
import { fileURLToPath } from "node:url";

const COIN_FILENAME = "orelyss-coin.png";
const COIN_PATH = fileURLToPath(
  new URL("../../assets/orelyss-coin.png", import.meta.url),
);

export function orelyssIconAttachment() {
  return new AttachmentBuilder(COIN_PATH, { name: COIN_FILENAME });
}

export function withOrelyssIcon(embed: EmbedBuilder, footerText = "Orëlyss") {
  return embed.setFooter({
    text: footerText,
    iconURL: `attachment://${COIN_FILENAME}`,
  });
}
