import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../types.js";
import { historyStore } from "../utils/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("delban")
    .setDescription("Révoquer le ban d'un utilisateur")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption((opt) =>
      opt.setName("userid").setDescription("L'ID de l'utilisateur à débannir").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("raison").setDescription("Raison du déban").setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const userId = interaction.options.getString("userid", true).trim();
    const raison = interaction.options.getString("raison") ?? "Aucune raison fournie";

    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({ content: "❌ ID invalide. Exemple : `123456789012345678`", ephemeral: true });
      return;
    }

    await interaction.deferReply();

    let bannedUser;
    try {
      bannedUser = await interaction.guild!.bans.fetch(userId);
    } catch {
      await interaction.editReply({ content: "❌ Cet utilisateur n'est pas banni sur ce serveur." });
      return;
    }

    await interaction.guild!.members.unban(userId, raison);

    historyStore.add({
      type: "unban",
      guildId: interaction.guildId!,
      targetId: bannedUser.user.id,
      targetTag: bannedUser.user.tag,
      moderatorTag: interaction.user.tag,
      reason: raison,
      timestamp: Date.now(),
    });

    try {
      const user = await interaction.client.users.fetch(userId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0x00c851)
        .setTitle(`✅ Votre ban a été levé sur ${interaction.guild?.name}`)
        .addFields(
          { name: "Raison du déban", value: raison },
          { name: "Modérateur", value: interaction.user.tag }
        )
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] });
    } catch { /* DMs fermés */ }

    const embed = new EmbedBuilder()
      .setColor(0x00c851)
      .setTitle("✅ Ban révoqué")
      .addFields(
        { name: "Utilisateur", value: `${bannedUser.user.tag} (${userId})`, inline: true },
        { name: "Modérateur", value: interaction.user.tag, inline: true },
        { name: "Raison", value: raison }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
