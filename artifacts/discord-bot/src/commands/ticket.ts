import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
} from "discord.js";
import type { Command } from "../types.js";
import { openTickets } from "../types.js";
import { closeTicket } from "../utils/closeTicket.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Système de tickets de support")
    .addSubcommand((sub) =>
      sub
        .setName("panel")
        .setDescription("Envoyer le panel de création de ticket dans ce salon")
        .addStringOption((opt) =>
          opt.setName("titre").setDescription("Titre du panel (optionnel)").setRequired(false)
        )
        .addStringOption((opt) =>
          opt.setName("description").setDescription("Description du panel (optionnel)").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("fermer")
        .setDescription("Fermer le ticket actuel")
        .addStringOption((opt) =>
          opt.setName("raison").setDescription("Raison de fermeture").setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("ajouter")
        .setDescription("Ajouter un membre au ticket")
        .addUserOption((opt) =>
          opt.setName("membre").setDescription("Le membre à ajouter").setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    // ── /ticket panel ─────────────────────────────────────────────────
    if (sub === "panel") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: "❌ Permission insuffisante.", ephemeral: true });
        return;
      }

      const titre = interaction.options.getString("titre") ?? "🎫 Créer un ticket";
      const description =
        interaction.options.getString("description") ??
        "Vous avez besoin d'aide ou avez une question ?\nCliquez sur le bouton ci-dessous pour ouvrir un ticket privé avec l'équipe.";

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(titre)
        .setDescription(description)
        .setFooter({ text: "Un ticket = un salon privé avec l'équipe." })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_create")
          .setLabel("Créer un ticket")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🎫")
      );

      await interaction.reply({ content: "✅ Panel envoyé.", ephemeral: true });
      await (interaction.channel as TextChannel)?.send({ embeds: [embed], components: [row] });
    }

    // ── /ticket fermer ────────────────────────────────────────────────
    else if (sub === "fermer") {
      const channel = interaction.channel as TextChannel;
      const raison = interaction.options.getString("raison") ?? "Aucune raison fournie";

      if (!channel?.name.startsWith("ticket-")) {
        await interaction.reply({
          content: "❌ Cette commande doit être utilisée dans un salon de ticket.",
          ephemeral: true,
        });
        return;
      }

      const hasPerm = interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels);
      const isOwner = channel.topic?.includes(interaction.user.tag);

      if (!hasPerm && !isOwner) {
        await interaction.reply({
          content: "❌ Vous n'avez pas la permission de fermer ce ticket.",
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({ content: "🔒 Fermeture du ticket en cours...", ephemeral: true });
      await closeTicket(channel, interaction.user, raison);
    }

    // ── /ticket ajouter ───────────────────────────────────────────────
    else if (sub === "ajouter") {
      const channel = interaction.channel as TextChannel;
      const target = interaction.options.getUser("membre", true);

      if (!channel?.name.startsWith("ticket-")) {
        await interaction.reply({
          content: "❌ Cette commande doit être utilisée dans un salon de ticket.",
          ephemeral: true,
        });
        return;
      }

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: "❌ Permission insuffisante.", ephemeral: true });
        return;
      }

      await channel.permissionOverwrites.edit(target.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });

      await interaction.reply({ content: `✅ ${target} a été ajouté au ticket.` });
    }
  },
};

export default command;
