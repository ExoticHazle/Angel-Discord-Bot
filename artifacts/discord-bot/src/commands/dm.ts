import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("dm")
    .setDescription("[ADMIN] Envoyer un message privé via Angel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption((option) => option.setName("membre").setDescription("Destinataire").setRequired(true))
    .addStringOption((option) => option.setName("message").setDescription("Message à envoyer").setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.options.getUser("membre", true);
    const message = interaction.options.getString("message", true);
    try {
      await member.send(`Message de **${interaction.guild?.name ?? "Angel"}** :\n\n${message}`);
      await interaction.reply({ content: `✅ Message envoyé à ${member}.`, ephemeral: true });
    } catch {
      await interaction.reply({ content: "❌ Impossible d'envoyer ce DM (messages privés fermés ou utilisateur introuvable).", ephemeral: true });
    }
  },
};

export default command;