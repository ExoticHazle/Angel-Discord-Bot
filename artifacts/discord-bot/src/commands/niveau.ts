import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.js";
import { profileStore } from "../utils/store.js";
import { orelyssIconAttachment, withOrelyssIcon } from "../utils/currency.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("niveau")
    .setDescription("[MEMBRE] Consulter les niveaux et le classement")
    .addSubcommand((sub) =>
      sub
        .setName("voir")
        .setDescription("Voir le niveau d'un membre")
        .addUserOption((option) => option.setName("membre").setDescription("Membre à consulter")),
    )
    .addSubcommand((sub) => sub.setName("classement").setDescription("Voir le classement du serveur")),
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();
    if (sub === "voir") {
      const user = interaction.options.getUser("membre") ?? interaction.user;
      const profile = await profileStore.get(guildId, user.id);
      const needed = 100 * (profile.level + 1);
      const embed = withOrelyssIcon(
        new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle(`Niveau de ${user.tag}`)
          .setThumbnail(user.displayAvatarURL())
          .setDescription(
            profile.level === 0
              ? "Votre niveau s'affichera après votre première ascension."
              : `Niveau **${profile.level}**`,
          )
          .addFields(
            { name: "XP", value: `${profile.xp}/${needed}`, inline: true },
            { name: "Orëlyss", value: profile.orelyss.toLocaleString("fr-FR"), inline: true },
          ),
        "Solde en Orëlyss",
      );
      await interaction.reply({
        embeds: [embed],
        files: [orelyssIconAttachment()],
        ephemeral: user.id === interaction.user.id,
      });
      return;
    }

    const profiles = (await profileStore.allForGuild(guildId))
      .filter((profile) => profile.level > 0)
      .sort((a, b) => b.level - a.level || b.xp - a.xp)
      .slice(0, 10);
    const description = profiles.length
      ? profiles.map((profile, index) => `**${index + 1}.** <@${profile.userId}> — niveau **${profile.level}** (${profile.xp} XP)`).join("\n")
      : "Le classement est encore vide.";
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle("Classement des niveaux").setDescription(description)],
    });
  },
};

export default command;