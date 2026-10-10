import { EmbedBuilder, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types.js";
import { profileStore } from "../utils/store.js";
import { parisDateKey, previousParisDateKey } from "../utils/time.js";

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

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("Daily récolté")
          .setDescription(`Vous avez récolté **${result.amount} Orëlyss** 🪙\nVotre streak est de **${result.profile.dailyStreak} jour(s)**.`)
          .setFooter({ text: "Le daily se réinitialise chaque jour à minuit, heure de Paris." }),
      ],
    });
  },
};

export default command;