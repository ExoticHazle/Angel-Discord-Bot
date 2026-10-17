import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.js";
import { articleStore } from "../utils/store.js";
import { orelyssIconAttachment, withOrelyssIcon } from "../utils/currency.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("log")
    .setDescription("[ADMIN] Consulter les journaux de la boutique")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("achat")
        .setDescription("Afficher les achats récents"),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const logs = await articleStore.purchases(interaction.guildId!);
    await interaction.reply({
      embeds: [
        withOrelyssIcon(
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle("Achats récents")
            .setDescription(
              logs.length
                ? logs.map((log) =>
                  `• ${log.userTag} — **${log.articleName}** — ${log.price.toLocaleString("fr-FR")} Orëlyss — <t:${Math.floor(log.timestamp / 1000)}:R>`,
                ).join("\n").slice(0, 3900)
                : "Aucun achat enregistré.",
            ),
          `${logs.length} achat${logs.length === 1 ? "" : "s"} • Monnaie Orëlyss`,
        ),
      ],
      files: [orelyssIconAttachment()],
      allowedMentions: { parse: [] },
      ephemeral: true,
    });
  },
};

export default command;
