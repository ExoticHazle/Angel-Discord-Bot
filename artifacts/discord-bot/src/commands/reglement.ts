import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type TextChannel,
} from "discord.js";
import type { Command } from "../types.js";
import { reglementStore } from "../utils/store.js";

const DEFAULT_REGLEMENT = `**1.** Respectez tous les membres du serveur.\n**2.** Pas de spam, flood ou publicité non autorisée.\n**3.** Pas de contenu NSFW en dehors des salons dédiés.\n**4.** Respectez les décisions des modérateurs.\n**5.** Pas de harcèlement, discrimination ou menaces.\n**6.** Gardez les discussions dans les salons appropriés.\n**7.** Tout contenu illégal est strictement interdit.`;

const DEFAULT_ACCEPT_ROLE = "1494338633803497492";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("reglement")
    .setDescription("Afficher ou configurer le règlement du serveur")
    .addSubcommand((sub) =>
      sub.setName("afficher").setDescription("Poster le règlement dans ce salon avec le bouton d'acceptation")
    )
    .addSubcommand((sub) =>
      sub
        .setName("definir")
        .setDescription("Définir un nouveau règlement")
        .addStringOption((opt) =>
          opt
            .setName("texte")
            .setDescription("Le nouveau règlement (utilisez \\n pour les sauts de ligne)")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("setrole")
        .setDescription("Définir le rôle attribué lors de l'acceptation du règlement")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Le rôle à attribuer").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName("reset").setDescription("Réinitialiser le règlement par défaut")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (sub === "afficher") {
      const texte = reglementStore.get(guildId) ?? DEFAULT_REGLEMENT;
      const acceptRoleId = reglementStore.getAcceptRole(guildId) ?? DEFAULT_ACCEPT_ROLE;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📜 Règlement de ${interaction.guild?.name ?? "ce serveur"}`)
        .setDescription(texte)
        .setFooter({ text: "Cliquez sur ✅ Accepter pour accéder au serveur." })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`reglement_accept:${acceptRoleId}`)
          .setLabel("✅ Accepter le règlement")
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({ content: "✅ Règlement posté.", ephemeral: true });
      await (interaction.channel as TextChannel)?.send({ embeds: [embed], components: [row] });

    } else if (sub === "definir") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ Permission insuffisante.", ephemeral: true });
        return;
      }
      const texte = interaction.options.getString("texte", true).replace(/\\n/g, "\n");
      reglementStore.set(guildId, texte);
      await interaction.reply({ content: "✅ Règlement mis à jour avec succès.", ephemeral: true });

    } else if (sub === "setrole") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ Permission insuffisante.", ephemeral: true });
        return;
      }
      const role = interaction.options.getRole("role", true);
      reglementStore.setAcceptRole(guildId, role.id);
      await interaction.reply({ content: `✅ Rôle d'acceptation défini sur ${role}.`, ephemeral: true });

    } else if (sub === "reset") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: "❌ Permission insuffisante.", ephemeral: true });
        return;
      }
      reglementStore.delete(guildId);
      await interaction.reply({ content: "✅ Règlement réinitialisé aux valeurs par défaut.", ephemeral: true });
    }
  },
};

export default command;
