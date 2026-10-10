import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.js";
import { communityConfigStore } from "../utils/store.js";
import {
  DEFAULT_WELCOME_TEMPLATE,
  buildWelcomePayload,
} from "../utils/welcome.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("bienvenue")
    .setDescription("[ADMIN] Configurer le message envoyé aux nouveaux membres")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("configurer")
        .setDescription("Choisir le salon et le texte de bienvenue")
        .addChannelOption((option) =>
          option
            .setName("salon")
            .setDescription("Salon texte où annoncer les arrivées")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("Modèle : {user}, {username}, {server}, {memberCount}")
            .setMaxLength(1_500),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("voir")
        .setDescription("Afficher la configuration de bienvenue"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("test")
        .setDescription("Envoyer un aperçu dans le salon configuré"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("desactiver")
        .setDescription("Désactiver les messages de bienvenue"),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: "Cette commande doit être utilisée dans un serveur.",
        ephemeral: true,
      });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({
        content: "❌ Seuls les administrateurs du serveur peuvent modifier cette configuration.",
        ephemeral: true,
      });
      return;
    }

    const config = await communityConfigStore.get(guild.id);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "configurer") {
      const channel = interaction.options.getChannel("salon", true);
      if (channel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: "Choisis un salon texte du serveur.",
          ephemeral: true,
        });
        return;
      }
      const message = interaction.options.getString("message");
      if (message !== null && !message.trim()) {
        await interaction.reply({
          content: "Le modèle de message ne peut pas être vide.",
          ephemeral: true,
        });
        return;
      }

      config.welcomeChannelId = channel.id;
      config.welcomeMessage = message?.trim() || DEFAULT_WELCOME_TEMPLATE;
      await communityConfigStore.save(guild.id, config);
      await interaction.reply({
        content:
          `✅ Message de bienvenue activé dans ${channel}.\n` +
          "Variables disponibles : `{user}`, `{username}`, `{server}`, `{memberCount}`.",
        ephemeral: true,
      });
      return;
    }

    if (subcommand === "voir") {
      const embed = new EmbedBuilder()
        .setColor(0x8e73d7)
        .setTitle("Configuration de bienvenue")
        .setDescription(
          config.welcomeChannelId
            ? `**Salon :** <#${config.welcomeChannelId}>\n\n**Modèle :**\n${config.welcomeMessage ?? DEFAULT_WELCOME_TEMPLATE}`
            : "Aucun message de bienvenue n’est configuré. Utilise `/bienvenue configurer`.",
        );
      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
        allowedMentions: { parse: [] },
      });
      return;
    }

    if (subcommand === "test") {
      if (!config.welcomeChannelId) {
        await interaction.reply({
          content: "Configure d’abord un salon avec `/bienvenue configurer`.",
          ephemeral: true,
        });
        return;
      }

      const channel = await guild.channels.fetch(config.welcomeChannelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({
          content: "Le salon configuré est introuvable ou n’est plus un salon texte.",
          ephemeral: true,
        });
        return;
      }
      const member = await guild.members.fetch(interaction.user.id);
      try {
        await channel.send(
          buildWelcomePayload(
            config.welcomeMessage ?? DEFAULT_WELCOME_TEMPLATE,
            member,
          ),
        );
      } catch {
        await interaction.reply({
          content: "❌ Je n’ai pas la permission d’envoyer un message dans ce salon.",
          ephemeral: true,
        });
        return;
      }
      await interaction.reply({
        content: `✅ Aperçu envoyé dans ${channel}.`,
        ephemeral: true,
      });
      return;
    }

    delete config.welcomeChannelId;
    delete config.welcomeMessage;
    await communityConfigStore.save(guild.id, config);
    await interaction.reply({
      content: "✅ Les messages de bienvenue sont désactivés. Les rôles automatiques restent actifs.",
      ephemeral: true,
    });
  },
};

export default command;
