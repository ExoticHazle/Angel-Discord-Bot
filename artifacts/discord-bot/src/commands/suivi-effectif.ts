import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("suivi-effectif")
    .setDescription("[ADMIN] Voir tous les membres possédant un rôle")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addRoleOption((option) => option.setName("role").setDescription("Rôle à suivre").setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    const role = interaction.options.getRole("role", true);
    const members = await interaction.guild!.members.fetch();
    const matching = members.filter((member) => member.roles.cache.has(role.id) && !member.user.bot);
    const list = matching.map((member) => `• ${member} — ${member.user.tag}`).slice(0, 100);
    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`Suivi effectif — ${role.name}`)
      .setDescription(list.length ? list.join("\n") : "Aucun membre ne possède ce rôle.")
      .setFooter({ text: `${matching.size} membre(s) trouvé(s)` })
      .setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;