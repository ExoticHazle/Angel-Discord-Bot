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
    .setName("delto")
    .setDescription("Annuler le timeout d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("membre").setDescription("Le membre dont lever le timeout").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Raison de la levée du timeout").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember("membre");
    const raison = interaction.options.getString("raison") ?? "Aucune raison fournie";

    if (!target || typeof target === "string") {
      await interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
      return;
    }

    const member = target as GuildMember;
    if (!member.isCommunicationDisabled()) {
      await interaction.reply({ content: "❌ Ce membre n'est pas en timeout.", ephemeral: true });
      return;
    }

    await member.timeout(null, raison);

    historyStore.add({
      type: "untimeout",
      guildId: interaction.guildId!,
      targetId: member.user.id,
      targetTag: member.user.tag,
      moderatorTag: interaction.user.tag,
      reason: raison,
      timestamp: Date.now(),
    });

    const dmEmbed = new EmbedBuilder()
      .setColor(0x00c851)
      .setTitle(`✅ Votre timeout a été levé sur ${interaction.guild?.name}`)
      .addFields(
        { name: "Raison", value: raison },
        { name: "Modérateur", value: interaction.user.tag }
      )
      .setTimestamp();

    try { await member.user.send({ embeds: [dmEmbed] }); } catch { /* DMs fermés */ }

    const embed = new EmbedBuilder()
      .setColor(0x00c851)
      .setTitle("✅ Timeout annulé")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (${member.user.id})`, inline: true },
        { name: "Modérateur", value: interaction.user.tag, inline: true },
        { name: "Raison", value: raison }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
