import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type TextChannel,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Supprimer un nombre de messages dans le salon")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((opt) =>
      opt
        .setName("nombre")
        .setDescription("Nombre de messages à supprimer (1–100)")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption((opt) =>
      opt
        .setName("membre")
        .setDescription("Filtrer par membre (optionnel)")
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const nombre = interaction.options.getInteger("nombre", true);
    const filterUser = interaction.options.getUser("membre");

    const channel = interaction.channel as TextChannel;
    if (!channel || !("bulkDelete" in channel)) {
      await interaction.reply({ content: "❌ Ce salon ne supporte pas la suppression.", ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    let messages = await channel.messages.fetch({ limit: 100 });

    if (filterUser) {
      messages = messages.filter((m) => m.author.id === filterUser.id);
    }

    const toDelete = [...messages.values()].slice(0, nombre);
    const deleted = await channel.bulkDelete(toDelete, true);

    const embed = new EmbedBuilder()
      .setColor(0x00bfff)
      .setTitle("🗑️ Messages supprimés")
      .addFields(
        { name: "Quantité", value: `${deleted.size} message(s)`, inline: true },
        { name: "Salon", value: `${channel}`, inline: true },
        { name: "Modérateur", value: `${interaction.user.tag}`, inline: true }
      )
      .setTimestamp();

    if (filterUser) {
      embed.addFields({ name: "Filtré par", value: `${filterUser.tag}`, inline: true });
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
