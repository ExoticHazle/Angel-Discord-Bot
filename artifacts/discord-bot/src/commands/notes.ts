import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.js";
import { noteStore } from "../utils/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("notes")
    .setDescription("[ADMIN] Voir les notes globales du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub.setName("global").setDescription("Afficher toutes les notes du serveur"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("membre")
        .setDescription("Afficher les notes d'un membre")
        .addUserOption((option) => option.setName("membre").setDescription("Le membre").setRequired(true)),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const all = await noteStore.get(interaction.guildId!);
    const member = interaction.options.getUser("membre");
    const notes = member ? all.filter((note) => note.memberId === member.id) : all;
    const description = notes.length === 0
      ? "Aucune note enregistrée."
      : notes.slice(0, 25).map((note) =>
        `**${note.id}** — <@${note.memberId}>\n${note.text}\n> ${note.authorTag} · <t:${Math.floor(note.timestamp / 1000)}:R>`,
      ).join("\n\n");
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(member ? `Notes de ${member.tag}` : `Notes globales — ${notes.length}`)
      .setDescription(description.slice(0, 4000))
      .setFooter({ text: notes.length > 25 ? "25 notes affichées au maximum." : "Utilisez /note clear pour supprimer une note." })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;