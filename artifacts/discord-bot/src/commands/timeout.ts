import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  type GuildMember,
} from "discord.js";
import type { Command } from "../types.js";
import { historyStore } from "../utils/store.js";

const DURATIONS: Record<string, number> = {
  "60s": 60, "5m": 300, "10m": 600, "30m": 1800,
  "1h": 3600, "12h": 43200, "24h": 86400, "7j": 604800,
};
const DURATION_LABELS: Record<string, string> = {
  "60s": "60 secondes", "5m": "5 minutes", "10m": "10 minutes",
  "30m": "30 minutes", "1h": "1 heure", "12h": "12 heures",
  "24h": "24 heures", "7j": "7 jours",
};

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Mettre un membre en sourdine temporairement")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("membre").setDescription("Le membre à timeout").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("durée").setDescription("Durée du timeout").setRequired(true)
        .addChoices(
          { name: "60 secondes", value: "60s" },
          { name: "5 minutes", value: "5m" },
          { name: "10 minutes", value: "10m" },
          { name: "30 minutes", value: "30m" },
          { name: "1 heure", value: "1h" },
          { name: "12 heures", value: "12h" },
          { name: "24 heures", value: "24h" },
          { name: "7 jours", value: "7j" }
        )
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Raison du timeout").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getMember("membre");
    const dureeKey = interaction.options.getString("durée", true);
    const raison = interaction.options.getString("raison") ?? "Aucune raison fournie";

    if (!target || typeof target === "string") {
      await interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
      return;
    }

    const member = target as GuildMember;
    if (!member.moderatable) {
      await interaction.reply({ content: "❌ Je ne peux pas timeout ce membre.", ephemeral: true });
      return;
    }

    const seconds = DURATIONS[dureeKey] ?? 60;
    const label = DURATION_LABELS[dureeKey] ?? dureeKey;

    const dmEmbed = new EmbedBuilder()
      .setColor(0xff8c00)
      .setTitle(`⏰ Vous avez été mis en timeout sur ${interaction.guild?.name}`)
      .addFields(
        { name: "Durée", value: label, inline: true },
        { name: "Raison", value: raison },
        { name: "Modérateur", value: interaction.user.tag, inline: true }
      )
      .setTimestamp();

    try { await member.user.send({ embeds: [dmEmbed] }); } catch { /* DMs fermés */ }

    await member.timeout(seconds * 1000, raison);

    historyStore.add({
      type: "timeout",
      guildId: interaction.guildId!,
      targetId: member.user.id,
      targetTag: member.user.tag,
      moderatorTag: interaction.user.tag,
      reason: raison,
      extra: label,
      timestamp: Date.now(),
    });

    const embed = new EmbedBuilder()
      .setColor(0xff8c00)
      .setTitle("⏰ Membre mis en timeout")
      .addFields(
        { name: "Membre", value: `${member.user.tag} (${member.user.id})`, inline: true },
        { name: "Modérateur", value: interaction.user.tag, inline: true },
        { name: "Durée", value: label, inline: true },
        { name: "Raison", value: raison }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
