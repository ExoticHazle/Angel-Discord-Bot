import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types.js";
import { objectStore, profileStore } from "../utils/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("inventaire")
    .setDescription("[MEMBRE] Voir ses Orëlyss et ses objets")
    .addUserOption((option) => option.setName("membre").setDescription("Membre à consulter")),
  async execute(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("membre") ?? interaction.user;
    const profile = await profileStore.get(interaction.guildId!, user.id);
    const objects = await Promise.all(Object.entries(profile.inventory)
      .map(async ([objectId, quantity]) => {
        const object = await objectStore.getById(interaction.guildId!, objectId);
        return object ? `${object.emoji} **${object.name}** ×${quantity}` : `Objet supprimé ×${quantity}`;
      }));
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle(`Inventaire de ${user.tag}`)
          .addFields(
            { name: "Orëlyss", value: `${profile.orelyss} 🪙`, inline: true },
            { name: "Objets", value: objects.length ? objects.join("\n") : "Aucun objet." },
          )
          .setThumbnail(user.displayAvatarURL()),
      ],
      ephemeral: user.id === interaction.user.id,
    });
  },
};

export default command;