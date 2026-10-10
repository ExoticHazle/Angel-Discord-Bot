import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../types.js";
import { warnsStore, historyStore } from "../utils/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("delwarn")
    .setDescription("Supprimer un avertissement spécifique d'un membre")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((opt) =>
      opt.setName("membre").setDescription("Le membre concerné").setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName("numéro").setDescription("Numéro du warn à supprimer (voir /warn list)")
        .setMinValue(1).setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const target = interaction.options.getUser("membre", true);
    const numero = interaction.options.getInteger("numéro", true);
    const key = `${interaction.guildId}-${target.id}`;
    const warns = warnsStore.get(key);

    if (warns.length === 0) {
      await interaction.reply({ content: `✅ ${target.tag} n'a aucun avertissement.`, ephemeral: true });
      return;
    }
    if (numero > warns.length) {
      await interaction.reply({
        content: `❌ Numéro invalide. ${target.tag} a ${warns.length} avertissement(s). Utilisez \`/warn list\` pour les voir.`,
        ephemeral: true,
      });
      return;
    }

    const removed = warns.splice(numero - 1, 1)[0];
    warnsStore.set(key, warns);

    historyStore.add({
      type: "delwarn",
      guildId: interaction.guildId!,
      targetId: target.id,
      targetTag: target.tag,
      moderatorTag: interaction.user.tag,
      reason: removed.reason,
      extra: `Warn #${numero} supprimé`,
      timestamp: Date.now(),
    });

    const dmEmbed = new EmbedBuilder()
      .setColor(0x00c851)
      .setTitle(`✅ Un de vos avertissements a été supprimé sur ${interaction.guild?.name}`)
      .addFields(
        { name: "Avertissement supprimé", value: removed.reason },
        { name: "Modérateur", value: interaction.user.tag, inline: true },
        { name: "Avertissements restants", value: `${warns.length}`, inline: true }
      )
      .setTimestamp();

    try { await target.send({ embeds: [dmEmbed] }); } catch { /* DMs fermés */ }

    const embed = new EmbedBuilder()
      .setColor(0x00c851)
      .setTitle("✅ Avertissement supprimé")
      .addFields(
        { name: "Membre", value: `${target.tag} (${target.id})`, inline: true },
        { name: `Warn #${numero}`, value: removed.reason },
        { name: "Ajouté par", value: removed.moderator, inline: true },
        { name: "Avertissements restants", value: `${warns.length}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
