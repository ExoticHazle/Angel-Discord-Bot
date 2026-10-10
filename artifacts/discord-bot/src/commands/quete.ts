import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { randomUUID } from "node:crypto";
import type { Command } from "../types.js";
import { objectStore, questStore } from "../utils/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("quete")
    .setDescription("[MEMBRE/ADMIN] Consulter et gérer les quêtes")
    .addSubcommand((sub) => sub.setName("liste").setDescription("Voir les quêtes disponibles"))
    .addSubcommand((sub) =>
      sub
        .setName("ajouter")
        .setDescription("Créer une quête")
        .addStringOption((option) => option.setName("nom").setDescription("Nom de la quête").setRequired(true))
        .addStringOption((option) =>
          option.setName("type").setDescription("Activité suivie").addChoices(
            { name: "Messages", value: "messages" },
            { name: "Minutes en vocal", value: "vocal" },
          ).setRequired(true),
        )
        .addIntegerOption((option) => option.setName("requis").setDescription("Nombre requis").setMinValue(1).setRequired(true))
        .addStringOption((option) =>
          option.setName("recompense").setDescription("Type de récompense").addChoices(
            { name: "Orëlyss", value: "orelyss" },
            { name: "XP", value: "xp" },
            { name: "Objet", value: "objet" },
            { name: "Rôle", value: "role" },
          ).setRequired(true),
        )
        .addStringOption((option) => option.setName("valeur").setDescription("Montant, ID objet ou ID rôle").setRequired(true))
        .addIntegerOption((option) => option.setName("jours").setDescription("Durée en jours").setMinValue(1).setRequired(true))
        .addIntegerOption((option) => option.setName("quantite").setDescription("Quantité d'objet").setMinValue(1)),
    )
    ,
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "liste") {
      const quests = await questStore.get(guildId);
      const description = quests.length
        ? quests.map((quest) => {
          const days = Math.max(0, Math.ceil((quest.expiresAt - Date.now()) / 86_400_000));
          return `**${quest.name}**\n${quest.activity === "messages" ? "Envoyer" : "Rester"} **${quest.requirement}** ${quest.activity === "messages" ? "message(s)" : "minute(s) en vocal"} · ${days} jour(s) restant(s)\nID: \`${quest.id}\``;
        }).join("\n\n")
        : "Aucune quête disponible.";
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x1abc9c).setTitle("Quêtes disponibles").setDescription(description.slice(0, 4000))] });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "❌ Seuls les administrateurs peuvent créer une quête.", ephemeral: true });
      return;
    }

    const activity = interaction.options.getString("type", true) as "messages" | "vocal";
    const rewardType = interaction.options.getString("recompense", true) as "orelyss" | "xp" | "objet" | "role";
    const rewardValue = interaction.options.getString("valeur", true);
    if (
      (rewardType === "orelyss" || rewardType === "xp") &&
      (!/^\d+$/.test(rewardValue) || Number(rewardValue) < 1)
    ) {
      await interaction.reply({
        content: "❌ La récompense en Orëlyss ou en XP doit être un nombre entier positif.",
        ephemeral: true,
      });
      return;
    }
    if (rewardType === "objet" && !(await objectStore.getById(guildId, rewardValue))) {
      await interaction.reply({
        content: "❌ Objet introuvable. Créez-le d'abord avec /objet creer ou récupérez son ID avec /objet afficher.",
        ephemeral: true,
      });
      return;
    }
    if (rewardType === "role" && !interaction.guild?.roles.cache.has(rewardValue)) {
      await interaction.reply({
        content: "❌ Rôle introuvable sur ce serveur. Indiquez l'ID d'un rôle existant.",
        ephemeral: true,
      });
      return;
    }

    const quest = {
      id: randomUUID(),
      guildId,
      name: interaction.options.getString("nom", true),
      activity,
      requirement: interaction.options.getInteger("requis", true),
      rewardType,
      rewardValue,
      rewardQuantity: interaction.options.getInteger("quantite") ?? 1,
      expiresAt: Date.now() + interaction.options.getInteger("jours", true) * 86_400_000,
      createdAt: Date.now(),
    };
    await questStore.add(guildId, quest);
    await interaction.reply({ content: `✅ Quête créée : **${quest.name}** (ID \`${quest.id}\`).`, ephemeral: true });
  },
};

export default command;