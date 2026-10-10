import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.js";
import { communityConfigStore } from "../utils/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("quota")
    .setDescription("[ADMIN] Configurer et consulter les quotas du staff")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("role")
        .setDescription("Définir le quota bimensuel d'un rôle")
        .addRoleOption((option) => option.setName("role").setDescription("Rôle concerné").setRequired(true))
        .addIntegerOption((option) =>
          option.setName("messages").setDescription("Nombre de messages (facultatif pour Animateur=200 ou Modérateur=250)").setMinValue(1),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("retirer")
        .setDescription("Retirer un rôle du système de quota")
        .addRoleOption((option) => option.setName("role").setDescription("Rôle").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("liste").setDescription("Voir la configuration des quotas"))
    .addSubcommand((sub) =>
      sub
        .setName("salon-admin")
        .setDescription("Définir le salon des résultats de quota")
        .addChannelOption((option) =>
          option.setName("salon").setDescription("Salon texte").addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("salon-niveaux")
        .setDescription("Définir le salon des montées de niveau")
        .addChannelOption((option) =>
          option.setName("salon").setDescription("Salon texte").addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();
    if (sub === "role") {
      const role = interaction.options.getRole("role", true);
      const normalizedName = role.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const defaultQuota = normalizedName.includes("animateur")
        ? 200
        : normalizedName.includes("moderateur")
          ? 250
          : null;
      const messages = interaction.options.getInteger("messages") ?? defaultQuota;
      if (!messages) {
        await interaction.reply({
          content: "❌ Indiquez le nombre de messages, ou utilisez un rôle nommé Animateur (200) ou Modérateur (250).",
          ephemeral: true,
        });
        return;
      }
      await communityConfigStore.setQuotaRole(guildId, role.id, messages);
      await interaction.reply({ content: `✅ ${role} doit envoyer **${messages} messages toutes les deux semaines**.`, ephemeral: true });
    } else if (sub === "retirer") {
      const role = interaction.options.getRole("role", true);
      await communityConfigStore.removeQuotaRole(guildId, role.id);
      await interaction.reply({ content: `✅ ${role} a été retiré des quotas.`, ephemeral: true });
    } else if (sub === "liste") {
      const config = await communityConfigStore.get(guildId);
      const embed = new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("Configuration des quotas")
        .setDescription(
          Object.entries(config.quotaRoles).length
            ? Object.entries(config.quotaRoles).map(([roleId, quota]) => `<@&${roleId}> : **${quota} messages**`).join("\n")
            : "Aucun rôle configuré.",
        )
        .addFields(
          { name: "Salon admin", value: config.quotaAdminChannelId ? `<#${config.quotaAdminChannelId}>` : "Non défini", inline: true },
          { name: "Salon niveaux", value: config.levelsChannelId ? `<#${config.levelsChannelId}>` : "Non défini", inline: true },
        );
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      const channel = interaction.options.getChannel("salon", true);
      if (sub === "salon-admin") await communityConfigStore.setAdminChannel(guildId, channel.id);
      else await communityConfigStore.setLevelsChannel(guildId, channel.id);
      await interaction.reply({ content: `✅ Salon configuré : ${channel}.`, ephemeral: true });
    }
  },
};

export default command;