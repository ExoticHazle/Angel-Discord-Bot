import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types.js";
import { objectStore } from "../utils/store.js";

/**
 * Un administrateur ne peut configurer que les rôles qu'il a lui-même
 * le droit de gérer et que le bot peut attribuer.
 */
async function validateRewardRole(
  interaction: ChatInputCommandInteraction,
  roleId: string,
): Promise<string | null> {
  const guild = interaction.guild;
  if (!guild) return "❌ Cette commande doit être utilisée sur un serveur.";
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
    return "❌ Il te faut la permission Gérer les rôles pour associer un rôle à un objet.";
  }
  const role = await guild.roles.fetch(roleId).catch(() => null);
  if (!role || role.id === guild.id || role.managed) {
    return "❌ Ce rôle est introuvable ou ne peut pas être attribué.";
  }
  const [botMember, author] = await Promise.all([
    guild.members.fetchMe().catch(() => null),
    guild.members.fetch(interaction.user.id).catch(() => null),
  ]);
  if (!botMember || !botMember.permissions.has(PermissionFlagsBits.ManageRoles) || !role.editable) {
    return "❌ Je ne peux pas donner ce rôle. Active « Gérer les rôles » et place mon rôle au-dessus du rôle récompense.";
  }
  if (!author || (author.id !== guild.ownerId && author.roles.highest.comparePositionTo(role) <= 0)) {
    return "❌ Tu ne peux pas configurer un rôle aussi élevé que ton propre rôle.";
  }
  return null;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("objet")
    .setDescription("[ADMIN] Créer et afficher les objets de la boutique")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("creer")
        .setDescription("Créer un objet, avec rôle cadeau facultatif")
        .addStringOption((option) => option.setName("nom").setDescription("Nom de l'objet").setRequired(true))
        .addStringOption((option) => option.setName("description").setDescription("Description").setRequired(true))
        .addStringOption((option) => option.setName("emoji").setDescription("Emoji de l'objet").setRequired(true))
        .addRoleOption((option) => option.setName("role").setDescription("Rôle offert à l'achat (facultatif)")),
    )
    .addSubcommand((sub) =>
      sub
        .setName("role")
        .setDescription("Associer ou retirer un rôle d'un objet existant")
        .addStringOption((option) => option.setName("id").setDescription("ID de l'objet").setRequired(true))
        .addRoleOption((option) => option.setName("role").setDescription("Rôle offert à l'achat"))
        .addBooleanOption((option) => option.setName("retirer").setDescription("Retirer le rôle associé à cet objet")),
    )
    .addSubcommand((sub) => sub.setName("liste").setDescription("Afficher tous les objets"))
    .addSubcommand((sub) => sub.setName("afficher").setDescription("Afficher tous les objets")),
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();

    if (sub === "creer") {
      const rewardRole = interaction.options.getRole("role");
      if (rewardRole) {
        const error = await validateRewardRole(interaction, rewardRole.id);
        if (error) {
          await interaction.reply({ content: error, ephemeral: true });
          return;
        }
      }
      const object = {
        id: `${Date.now().toString(36)}`,
        name: interaction.options.getString("nom", true),
        description: interaction.options.getString("description", true),
        emoji: interaction.options.getString("emoji", true),
        roleId: rewardRole?.id,
        createdAt: Date.now(),
      };
      await objectStore.add(guildId, object);
      await interaction.reply({
        content: `✅ Objet créé : ${object.emoji} **${object.name}**\nID : \`${object.id}\`` +
          (object.roleId ? `\n🎭 Rôle à l'achat : <@&${object.roleId}>` : ""),
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (sub === "role") {
      const id = interaction.options.getString("id", true);
      const rewardRole = interaction.options.getRole("role");
      const retirer = interaction.options.getBoolean("retirer") ?? false;
      if (Boolean(rewardRole) === retirer) {
        await interaction.reply({
          content: "❌ Choisis soit un rôle, soit `retirer: true` (pas les deux).",
          ephemeral: true,
        });
        return;
      }
      const object = await objectStore.getById(guildId, id);
      if (!object) {
        await interaction.reply({ content: "❌ Objet introuvable. Utilise /objet liste.", ephemeral: true });
        return;
      }
      if (rewardRole) {
        const error = await validateRewardRole(interaction, rewardRole.id);
        if (error) {
          await interaction.reply({ content: error, ephemeral: true });
          return;
        }
      } else if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)) {
        await interaction.reply({ content: "❌ Permission Gérer les rôles requise.", ephemeral: true });
        return;
      }
      await objectStore.setRole(guildId, id, rewardRole?.id ?? null);
      await interaction.reply({
        content: rewardRole
          ? `✅ L'objet **${object.name}** donnera maintenant <@&${rewardRole.id}> à l'achat.`
          : `✅ Le rôle associé à **${object.name}** a été retiré.`,
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    const objects = await objectStore.get(guildId);
    await interaction.reply({
      content: objects.length
        ? objects.map((object) =>
            `\`${object.id}\` — ${object.emoji} **${object.name}** : ${object.description}` +
            (object.roleId ? ` — 🎭 <@&${object.roleId}>` : "")
          ).join("\n").slice(0, 1900)
        : "Aucun objet créé.",
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
  },
};

export default command;
