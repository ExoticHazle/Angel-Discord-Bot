import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildTextBasedChannel,
} from "discord.js";
import type { Command } from "../types.js";
import { hasEveryoneMention } from "../utils/everyoneMention.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("say")
    .setDescription("[ADMIN] Faire envoyer un message par Angel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("Texte à envoyer (écris \\n pour un retour à la ligne)")
        .setMaxLength(2000)
        .setRequired(true),
    )
    .addChannelOption((option) =>
      option
        .setName("salon")
        .setDescription("Salon où envoyer le message (par défaut : ici)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: "❌ Cette commande fonctionne uniquement sur un serveur.", ephemeral: true });
      return;
    }

    const text = interaction.options.getString("message", true).replace(/\\n/g, "\n");
    const target = (interaction.options.getChannel("salon") ?? interaction.channel) as GuildTextBasedChannel | null;

    if (!target || !target.isTextBased()) {
      await interaction.reply({ content: "❌ Salon invalide.", ephemeral: true });
      return;
    }

    const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    const perms = me ? target.permissionsFor(me) : null;
    if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.SendMessages)) {
      await interaction.reply({ content: `❌ Je n'ai pas la permission d'écrire dans ${target}.`, ephemeral: true });
      return;
    }

    const wantsEveryonePing = hasEveryoneMention(text);
    if (wantsEveryonePing) {
      const author = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!author || !target.permissionsFor(author)?.has(PermissionFlagsBits.MentionEveryone) || !perms.has(PermissionFlagsBits.MentionEveryone)) {
        await interaction.reply({ content: "❌ Toi et Angel devez avoir la permission Mentionner @everyone dans ce salon.", ephemeral: true });
        return;
      }
    }

    try {
      await target.send({
        content: text,
        allowedMentions: { parse: wantsEveryonePing ? ["users", "roles", "everyone"] : ["users", "roles"] },
      });
      await interaction.reply({ content: `✅ Message envoyé dans ${target}.`, ephemeral: true });
    } catch (err) {
      console.error("Erreur /say:", err);
      await interaction.reply({ content: "❌ Impossible d'envoyer le message.", ephemeral: true });
    }
  },
};

export default command;
