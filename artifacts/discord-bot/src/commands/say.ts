import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
} from "discord.js";
import type { Command } from "../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("[ADMIN] Faire envoyer un message par Angel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Texte à envoyer (écris \\n pour un retour à la ligne)")
        .setMaxLength(2000)
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName("salon")
        .setDescription("Salon où envoyer le message (par défaut : ici)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: "❌ Cette commande fonctionne uniquement sur un serveur.", ephemeral: true });
      return;
    }

    const text = interaction.options.getString("message", true).replace(/\\n/g, "\n");
    const target = (interaction.options.getChannel("salon") ?? interaction.channel) as GuildTextBasedChannel | null;

    if (!target || !target.isTextBased()) {
      await interaction.reply({ content: "❌ Salon invalide.", ephemeral: true });
      return;
    }

    const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    const perms = me ? target.permissionsFor(me) : null;
    if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.SendMessages)) {
      await interaction.reply({ content: `❌ Je n'ai pas la permission d'écrire dans ${target}.`, ephemeral: true });
      return;
    }

    try {
      await target.send({
        content: text,
        allowedMentions: { parse: ["users", "roles"] },
      });
      await interaction.reply({ content: `✅ Message envoyé dans ${target}.`, ephemeral: true });
    } catch (err) {
      console.error("Erreur /say:", err);
      await interaction.reply({ content: "❌ Impossible d'envoyer le message.", ephemeral: true });
    }
  },
};

export default command;
