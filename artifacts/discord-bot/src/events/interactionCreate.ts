import {
  Events,
  type Interaction,
  Collection,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  type TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type GuildMember,
} from "discord.js";
import type { Command } from "../types.js";
import { openTickets } from "../types.js";
import { historyStore, autoroleStore } from "../utils/store.js";
import { closeTicket } from "../utils/closeTicket.js";

export default {
  name: Events.InteractionCreate,
  once: false,
  async execute(interaction: Interaction, commands: Collection<string, Command>) {

    // ── Slash commands ────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, commands);
      } catch (err) {
        console.error(`Erreur /${interaction.commandName}:`, err);
        const msg = { content: "❌ Une erreur s'est produite.", flags: 64 };
        try {
          if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
          else await interaction.reply(msg);
        } catch { /* interaction expirée */ }
      }
      return;
    }

    if (!interaction.isButton()) return;

    // ── Bouton : accepter le règlement ────────────────────────────────
    if (interaction.customId.startsWith("reglement_accept:")) {
      const roleId = interaction.customId.split(":")[1];
      const member = interaction.member as GuildMember;

      if (member.roles.cache.has(roleId)) {
        await interaction.reply({ content: "✅ Vous avez déjà accepté le règlement.", flags: 64 });
        return;
      }

      try {
        // Ajouter le rôle d'acceptation
        await member.roles.add(roleId);

        // Retirer tous les autoroles configurés pour ce serveur
        const autoroles = autoroleStore.get(interaction.guildId!);
        for (const arId of autoroles) {
          if (member.roles.cache.has(arId)) {
            await member.roles.remove(arId).catch(() => null);
          }
        }

        await interaction.reply({
          content: "✅ Vous avez accepté le règlement et reçu votre rôle !",
          flags: 64,
        });
      } catch {
        await interaction.reply({
          content: "❌ Impossible d'attribuer le rôle. Vérifiez que mon rôle est au-dessus du rôle cible.",
          flags: 64,
        });
      }
      return;
    }

    // ── Bouton : créer un ticket ──────────────────────────────────────
    if (interaction.customId === "ticket_create") {
      const guild = interaction.guild!;
      const userId = interaction.user.id;
      const key = `${guild.id}-${userId}`;

      const existing = openTickets.get(key);
      if (existing) {
        await interaction.reply({ content: `❌ Vous avez déjà un ticket ouvert : <#${existing}>`, flags: 64 });
        return;
      }

      await interaction.deferReply({ flags: 64 });

      const category = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes("ticket")
      );

      const ticketChannel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category?.id,
        topic: `Ticket de ${interaction.user.tag}`,
        permissionOverwrites: [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          {
            id: userId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          },
          {
            id: interaction.client.user!.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
          },
          // Rôles staff avec accès aux tickets
          ...["1496985767262818434", "1494338385806889093", "1494338334699425822", "1494338229397225482", "1485323994767818872"].map((id) => ({
            id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          })),
        ],
      }) as TextChannel;

      openTickets.set(key, ticketChannel.id);

      historyStore.add({
        type: "ticket_open",
        guildId: guild.id,
        targetId: interaction.user.id,
        targetTag: interaction.user.tag,
        moderatorTag: interaction.user.tag,
        reason: `Ticket ouvert : ${ticketChannel.name}`,
        timestamp: Date.now(),
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("🎫 Ticket ouvert")
        .setDescription(`Bienvenue ${interaction.user} !\n\nUn modérateur vous répondra bientôt.\nDécrivez votre problème en détail ci-dessous.`)
        .setFooter({ text: "Utilisez /ticket fermer ou le bouton ci-dessous pour clore ce ticket." })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close_btn")
          .setLabel("Fermer le ticket")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("🔒")
      );

      await ticketChannel.send({ content: `${interaction.user} <@&1496985767262818434>`, embeds: [embed], components: [row] });
      await interaction.editReply({ content: `✅ Votre ticket a été créé : ${ticketChannel}` });
      return;
    }

    // ── Bouton : fermer le ticket ─────────────────────────────────────
    if (interaction.customId === "ticket_close_btn") {
      const channel = interaction.channel as TextChannel;
      if (!channel?.name.startsWith("ticket-")) {
        await interaction.reply({ content: "❌ Ce bouton ne peut être utilisé que dans un ticket ouvert.", flags: 64 });
        return;
      }

      historyStore.add({
        type: "ticket_close",
        guildId: interaction.guildId!,
        targetId: interaction.user.id,
        targetTag: interaction.user.tag,
        moderatorTag: interaction.user.tag,
        reason: `Ticket fermé via bouton : ${channel.name}`,
        timestamp: Date.now(),
      });

      await interaction.reply({ content: "🔒 Fermeture du ticket en cours...", flags: 64 });
      await closeTicket(channel, interaction.user, "Fermé via le bouton");
      return;
    }

    // ── Bouton : supprimer le salon ───────────────────────────────────
    if (interaction.customId === "ticket_delete") {
      const channel = interaction.channel as TextChannel;

      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: "❌ Seuls les modérateurs peuvent supprimer le salon.", flags: 64 });
        return;
      }

      await interaction.reply({ content: "🗑️ Suppression dans 3 secondes...", flags: 64 });
      setTimeout(() => {
        channel.delete(`Ticket supprimé par ${interaction.user.tag}`).catch(() => null);
      }, 3000);
    }
  },
};
