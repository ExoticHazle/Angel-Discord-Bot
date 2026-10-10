import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../types.js";

const EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("sondage")
    .setDescription("Créer un sondage avec réactions")
    .addStringOption((opt) =>
      opt.setName("question").setDescription("La question du sondage").setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName("choix")
        .setDescription("Les choix séparés par | (ex: Oui|Non|Peut-être) — laissez vide pour Oui/Non")
        .setRequired(false)
    )
    .addIntegerOption((opt) =>
      opt
        .setName("durée")
        .setDescription("Durée en minutes (optionnel, pour affichage)")
        .setMinValue(1)
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const question = interaction.options.getString("question", true);
    const choixRaw = interaction.options.getString("choix");
    const duree = interaction.options.getInteger("durée");

    let choix: string[];
    let emojis: string[];

    if (choixRaw) {
      choix = choixRaw.split("|").map((c) => c.trim()).filter(Boolean).slice(0, 10);
      if (choix.length < 2) {
        await interaction.reply({ content: "❌ Il faut au moins 2 choix séparés par |.", ephemeral: true });
        return;
      }
      emojis = EMOJIS.slice(0, choix.length);
    } else {
      choix = ["Oui", "Non"];
      emojis = ["✅", "❌"];
    }

    const description = choix.map((c, i) => `${emojis[i]} — **${c}**`).join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📊 ${question}`)
      .setDescription(description)
      .setFooter({
        text: `Sondage créé par ${interaction.user.tag}${duree ? ` · Durée : ${duree} minute(s)` : ""}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTimestamp();

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

    for (const emoji of emojis) {
      await msg.react(emoji);
    }
  },
};

export default command;
