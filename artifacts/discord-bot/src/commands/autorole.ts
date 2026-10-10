import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../types.js";
import { autoroleStore } from "../utils/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Gérer les rôles attribués automatiquement aux nouveaux membres")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Ajouter un rôle automatique")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Le rôle à ajouter").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Retirer un rôle automatique")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Le rôle à retirer").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Voir tous les rôles automatiques configurés")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === "add") {
      const role = interaction.options.getRole("role", true);
      const added = autoroleStore.add(guildId, role.id);

      if (!added) {
        await interaction.reply({ content: "❌ Ce rôle est déjà dans les autoroles.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00c851)
        .setTitle("✅ Autorole ajouté")
        .setDescription(`Le rôle ${role} sera automatiquement attribué aux nouveaux membres.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

    } else if (sub === "remove") {
      const role = interaction.options.getRole("role", true);
      const removed = autoroleStore.remove(guildId, role.id);

      if (!removed) {
        await interaction.reply({ content: "❌ Ce rôle n'est pas dans les autoroles.", ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `✅ Le rôle ${role} a été retiré des autoroles.`,
        ephemeral: true,
      });

    } else if (sub === "list") {
      const roles = autoroleStore.get(guildId);

      if (roles.length === 0) {
        await interaction.reply({ content: "ℹ️ Aucun autorole configuré.", ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🎭 Autoroles configurés")
        .setDescription(roles.map((id) => `<@&${id}>`).join("\n"))
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default command;
