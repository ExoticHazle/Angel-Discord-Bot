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
    .setName("warn")
    .setDescription("Avertir un membre ou consulter ses avertissements")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub.setName("add").setDescription("Ajouter un avertissement")
        .addUserOption((opt) => opt.setName("membre").setDescription("Le membre à avertir").setRequired(true))
        .addStringOption((opt) => opt.setName("raison").setDescription("Raison").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Voir les avertissements d'un membre")
        .addUserOption((opt) => opt.setName("membre").setDescription("Le membre").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Effacer tous les avertissements d'un membre")
        .addUserOption((opt) => opt.setName("membre").setDescription("Le membre").setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser("membre", true);
    const key = `${interaction.guildId}-${target.id}`;

    if (sub === "add") {
      const raison = interaction.options.getString("raison", true);
      const entry = { moderator: interaction.user.tag, reason: raison, timestamp: Date.now() };
      warnsStore.add(key, entry);
      const warns = warnsStore.get(key);

      historyStore.add({
        type: "warn",
        guildId: interaction.guildId!,
        targetId: target.id,
        targetTag: target.tag,
        moderatorTag: interaction.user.tag,
        reason: raison,
        extra: `Warn #${warns.length}`,
        timestamp: Date.now(),
      });

      const dmEmbed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle(`⚠️ Vous avez reçu un avertissement sur ${interaction.guild?.name}`)
        .addFields(
          { name: "Raison", value: raison },
          { name: "Modérateur", value: interaction.user.tag, inline: true },
          { name: "Total avertissements", value: `${warns.length}`, inline: true }
        )
        .setFooter({ text: "Veuillez respecter les règles du serveur." })
        .setTimestamp();

      try { await target.send({ embeds: [dmEmbed] }); } catch { /* DMs fermés */ }

      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle("⚠️ Avertissement ajouté")
        .addFields(
          { name: "Membre", value: `${target.tag} (${target.id})`, inline: true },
          { name: "Modérateur", value: interaction.user.tag, inline: true },
          { name: "Raison", value: raison },
          { name: "Total warns", value: `${warns.length}`, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (sub === "list") {
      const warns = warnsStore.get(key);
      if (warns.length === 0) {
        await interaction.reply({ content: `✅ ${target.tag} n'a aucun avertissement.`, ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle(`⚠️ Avertissements de ${target.tag}`)
        .setDescription(
          warns.map((w, i) =>
            `**#${i + 1}** — ${w.reason}\n> Par ${w.moderator} — <t:${Math.floor(w.timestamp / 1000)}:R>`
          ).join("\n\n")
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === "clear") {
      warnsStore.clear(key);
      await interaction.reply({ content: `✅ Tous les avertissements de ${target.tag} ont été effacés.`, ephemeral: true });
    }
  },
};

export default command;
