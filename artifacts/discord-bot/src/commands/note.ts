import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.js";
import { noteStore } from "../utils/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("note")
    .setDescription("[ADMIN] Ajouter et gérer les notes des membres")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Ajouter une note à un membre")
        .addUserOption((option) => option.setName("membre").setDescription("Le membre").setRequired(true))
        .addStringOption((option) => option.setName("texte").setDescription("Contenu de la note").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("clear")
        .setDescription("Supprimer une note")
        .addStringOption((option) => option.setName("id").setDescription("Identifiant de la note").setRequired(true)),
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();
    if (sub === "add") {
      const member = interaction.options.getUser("membre", true);
      const text = interaction.options.getString("texte", true);
      const id = `${Date.now().toString(36)}-${member.id.slice(-4)}`;
      await noteStore.add({
        id,
        guildId,
        memberId: member.id,
        memberTag: member.tag,
        authorId: interaction.user.id,
        authorTag: interaction.user.tag,
        text,
        timestamp: Date.now(),
      });
      await interaction.reply({ content: `✅ Note ajoutée pour ${member}. ID : \`${id}\``, ephemeral: true });
      return;
    }
    const id = interaction.options.getString("id", true);
    await interaction.reply({
      content: (await noteStore.remove(guildId, id)) ? "✅ Note supprimée." : "❌ Note introuvable.",
      ephemeral: true,
    });
  },
};

export default command;