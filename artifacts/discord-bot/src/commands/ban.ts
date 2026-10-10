import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  type GuildMember,
} from "discord.js";
import type { Command } from "../types.js";
import { historyStore } from "../utils/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannir un membre du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((opt) =>
      opt.setName("membre").setDescription("Le membre à bannir").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Raison du ban").setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("jours")
        .setDescription("Nombre de jours de messages à supprimer (0-7)")
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember("membre");
    const raison = interaction.options.getString("raison") ?? "Aucune raison fournie";
    const jours = interaction.options.getInteger("jours") ?? 0;

    if (!target || typeof target === "string") {
      await interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
      return;
    }

    const member = target as GuildMember;

    if (!member.bannable) {
      await interaction.reply({
        content: "❌ Je ne peux pas bannir ce membre (permissions insuffisantes).",
        ephemeral: true,
      });
      return;
    }

    const dmEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle(`🔨 Vous avez été banni de ${interaction.guild?.name}`)
      .addFields(
        { name: "Raison", value: raison },
        { name: "Modérateur", value: interaction.user.tag }
      )
      .setTimestamp();

    try { await member.user.send({ embeds: [dmEmbed] }); } catch { /* DMs fermés */ }

    await member.ban({ deleteMessageDays: jours as 0|1|2|3|4|5|6|7, reason: raison });

    historyStore.add({
      type: "ban",
      guildId: interaction.guildId!,
      targetId: member.user.id,
      targetTag: member.user.tag,
      moderatorTag: interaction.user.tag,
      reason: raison,
      extra: jours > 0 ? `${jours}j de messages supprimés` : undefined,
      timestamp: Date.now(),
    });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🔨 Membre banni")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (${member.user.id})`, inline: true },
        { name: "Modérateur", value: interaction.user.tag, inline: true },
        { name: "Raison", value: raison },
        { name: "Messages supprimés", value: `${jours} jour(s)`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
