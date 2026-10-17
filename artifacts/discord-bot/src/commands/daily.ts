import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types.js";
import { profileStore } from "../utils/store.js";
import { parisDateKey, previousParisDateKey } from "../utils/time.js";
import { orelyssIconAttachment, withOrelyssIcon } from "../utils/currency.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("[MEMBRE] Récolter ses Orëlyss quotidiens"),
  async execute(interaction: ChatInputCommandInteraction) {
    const today = parisDateKey();
    const result = await profileStore.claimDaily(
      interaction.guildId!,
      interaction.user.id,
      today,
      previousParisDateKey(),
    );
    if (!result.claimed) {
      await interaction.reply({ content: "⏳ Vous avez déjà récolté votre daily aujourd'hui. Revenez après minuit.", ephemeral: true });
      return;
    }

    const embed = withOrelyssIcon(
      new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("Daily récolté")
          .setDescription(`Vous avez récolté **${result.amount} Orëlyss**\nVotre streak est de **${result.profile.dailyStreak} jour(s)**.`),
      "Daily • réinitialisé chaque jour à minuit, heure de Paris",
    );
    await interaction.reply({
      embeds: [embed],
      files: [orelyssIconAttachment()],
    });
  },
};

export default command;