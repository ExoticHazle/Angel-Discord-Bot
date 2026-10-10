import { PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types.js";
import { objectStore } from "../utils/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("objet")
    .setDescription("[ADMIN] Créer et afficher les objets de la boutique")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("creer")
        .setDescription("Créer un objet utilisable comme récompense")
        .addStringOption((option) => option.setName("nom").setDescription("Nom de l'objet").setRequired(true))
        .addStringOption((option) => option.setName("description").setDescription("Description").setRequired(true))
        .addStringOption((option) => option.setName("emoji").setDescription("Emoji de l'objet").setRequired(true)),
    )
    .addSubcommand((sub) => sub.setName("liste").setDescription("Afficher tous les objets"))
    .addSubcommand((sub) => sub.setName("afficher").setDescription("Afficher tous les objets")),
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    if (interaction.options.getSubcommand() === "creer") {
      const object = {
        id: `${Date.now().toString(36)}`,
        name: interaction.options.getString("nom", true),
        description: interaction.options.getString("description", true),
        emoji: interaction.options.getString("emoji", true),
        createdAt: Date.now(),
      };
      await objectStore.add(guildId, object);
      await interaction.reply({ content: `✅ Objet créé : ${object.emoji} **${object.name}**\nID : \`${object.id}\``, ephemeral: true });
      return;
    }
    const objects = await objectStore.get(guildId);
    await interaction.reply({
      content: objects.length
        ? objects.map((object) => `\`${object.id}\` — ${object.emoji} **${object.name}** : ${object.description}`).join("\n")
        : "Aucun objet créé.",
      ephemeral: true,
    });
  },
};

export default command;