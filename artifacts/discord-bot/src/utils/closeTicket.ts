import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  type TextChannel,
  type User,
} from "discord.js";
import { openTickets } from "../types.js";

export async function closeTicket(
  channel: TextChannel,
  closedBy: User,
  raison: string
) {
  const username = channel.name.replace(/^ticket-/, "");

  // Retirer du store
  for (const [key, chanId] of openTickets.entries()) {
    if (chanId === channel.id) {
      openTickets.delete(key);
      break;
    }
  }

  // 1. Envoyer l'embed + bouton supprimer EN PREMIER (avant tout verrouillage)
  const embed = new EmbedBuilder()
    .setColor(0xff0000)
    .setTitle("🔒 Ticket fermé")
    .addFields(
      { name: "Fermé par", value: closedBy.tag, inline: true },
      { name: "Raison", value: raison, inline: true }
    )
    .setFooter({ text: "Ce salon est en lecture seule. Cliquez sur Supprimer pour l'effacer définitivement." })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_delete")
      .setLabel("Supprimer le salon")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🗑️")
  );

  await channel.send({ embeds: [embed], components: [row] });

  // 2. Renommer le salon
  await channel.setName(`closed-${username}`);

  // 3. Verrouiller @everyone
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone, {
    SendMessages: false,
    ViewChannel: false,
  });

  // 4. Verrouiller tous les autres overrides (membres & rôles) sauf le bot
  for (const [, overwrite] of channel.permissionOverwrites.cache) {
    if (overwrite.id === channel.guild.roles.everyone.id) continue;
    if (overwrite.id === channel.client.user?.id) continue;
    await channel.permissionOverwrites.edit(overwrite.id, {
      SendMessages: false,
    }).catch(() => null);
  }
}
