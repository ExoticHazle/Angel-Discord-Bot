import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";

import type { Command } from "../types.js";
import { staffWarnsStore } from "../utils/store.js";

const RESPONSABLE_ID = "1483109167580577874";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("warnstaff")
    .setDescription("Gérer les avertissements des membres du staff")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    .addSubcommand((subcommand) =>
      subcommand
        .setName("add")
        .setDescription("Ajouter un avertissement à un membre du staff")
        .addUserOption((option) =>
          option
            .setName("membre")
            .setDescription("Le membre du staff à avertir")
            .setRequired(true),
        )
        .addStringOption((option) =>
          option
            .setName("raison")
            .setDescription("La raison de l’avertissement")
            .setRequired(true),
        ),
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("list")
        .setDescription("Voir les avertissements d’un membre du staff")
        .addUserOption((option) =>
          option
            .setName("membre")
            .setDescription("Le membre du staff")
            .setRequired(true),
        ),
    )

    .addSubcommand((subcommand) =>
      subcommand
        .setName("clear")
        .setDescription("Supprimer tous les avertissements d’un membre du staff")
        .addUserOption((option) =>
          option
            .setName("membre")
            .setDescription("Le membre du staff")
            .setRequired(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) {
      await interaction.reply({
        content: "❌ Cette commande doit être utilisée sur un serveur.",
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    const target = interaction.options.getUser("membre", true);
    const key = `${interaction.guildId}-${target.id}`;

    if (subcommand === "add") {
      const raison = interaction.options.getString("raison", true);

      await staffWarnsStore.add(key, {
        moderator: interaction.user.tag,
        moderatorId: interaction.user.id,
        reason: raison,
        timestamp: Date.now(),
      });

      const warns = staffWarnsStore.get(key);

      await target
        .send(
          [
            `⚠️ Tu as reçu un avertissement staff sur **${interaction.guild?.name}**.`,
            `**Raison :** ${raison}`,
            `**Avertissement :** ${warns.length}/3`,
          ].join("\n"),
        )
        .catch(() => null);

      if (warns.length === 3) {
        const responsable = await interaction.client.users
          .fetch(RESPONSABLE_ID)
          .catch(() => null);

        if (responsable) {
          await responsable
            .send(
              [
                "🚨 **Troisième avertissement staff**",
                "",
                `**Membre :** ${target.tag} (${target.id})`,
                `**Auteur du troisième warn :** ${interaction.user.tag}`,
                `**Raison :** ${raison}`,
                `**Serveur :** ${interaction.guild?.name}`,
              ].join("\n"),
            )
            .catch(() => null);
        }
      }

      await interaction.reply({
        content:
          `✅ Un avertissement staff a été ajouté à ${target}.\n` +
          `Total : **${warns.length}** avertissement(s).`,
        ephemeral: true,
      });

      return;
    }

    if (subcommand === "list") {
      const warns = staffWarnsStore.get(key);

      const embed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`Avertissements staff de ${target.tag}`)
        .setDescription(
          warns.length === 0
            ? "Ce membre ne possède aucun avertissement staff."
            : warns
                .map(
                  (warn, index) =>
                    `**#${index + 1} — ${warn.reason}**\n` +
                    `Par ${warn.moderator} — ` +
                    `<t:${Math.floor(warn.timestamp / 1000)}:R>`,
                )
                .join("\n\n"),
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });

      return;
    }

    if (subcommand === "clear") {
      await staffWarnsStore.clear(key);

      await interaction.reply({
        content: `✅ Tous les avertissements staff de ${target} ont été supprimés.`,
        ephemeral: true,
      });
    }
  },
};

export default command;
