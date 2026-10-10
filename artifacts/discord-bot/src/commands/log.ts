import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.js";
import { articleStore } from "../utils/store.js";

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
      content: logs.length
        ? logs.map((log) =>
          `• ${log.userTag} — **${log.articleName}** — ${log.price} Orëlyss — <t:${Math.floor(log.timestamp / 1000)}:R>`,
        ).join("\n")
        : "Aucun achat enregistré.",
      ephemeral: true,
    });
  },
};

export default command;
