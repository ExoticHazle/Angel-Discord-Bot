import { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types.js";
import { logChannelStore } from "../utils/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("logs")
    .setDescription("[ADMIN] Configurer les journaux du serveur")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub.setName("configurer").setDescription("Choisir le salon des logs")
      .addChannelOption(opt => opt.setName("salon").setDescription("Salon texte pour les logs").addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub => sub.setName("voir").setDescription("Afficher le salon configuré"))
    .addSubcommand(sub => sub.setName("desactiver").setDescription("Arrêter les journaux"))
    .addSubcommand(sub => sub.setName("test").setDescription("Tester l'envoi des logs")),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "❌ Permission Gérer le serveur requise.", ephemeral: true }); return;
    }
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();
    if (sub === "configurer") {
      const requested = interaction.options.getChannel("salon", true);
      const channel = await guild.channels.fetch(requested.id).catch(() => null);
      const bot = await guild.members.fetchMe().catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText || !bot ||
        !channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
        await interaction.reply({ content: "❌ Angel doit pouvoir voir le salon, y envoyer des messages et intégrer des liens.", ephemeral: true }); return;
      }
      await logChannelStore.set(guild.id, channel.id);
      await interaction.reply({ content: `✅ Logs activés dans <#${channel.id}>. Les nouveaux événements y seront enregistrés.`, ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }
    if (sub === "voir") {
      const id = logChannelStore.get(guild.id);
      await interaction.reply({ content: id ? `📋 Les logs sont activés dans <#${id}>.` : "ℹ️ Aucun salon de logs configuré.", ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }
    if (sub === "desactiver") {
      await logChannelStore.remove(guild.id);
      await interaction.reply({ content: "✅ Journaux désactivés.", ephemeral: true }); return;
    }
    const id = logChannelStore.get(guild.id);
    const channel = id ? await guild.channels.fetch(id).catch(() => null) : null;
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: "❌ Configure d'abord un salon avec /logs configurer.", ephemeral: true }); return;
    }
    try {
      await channel.send({ embeds: [new EmbedBuilder().setColor(0x57f287).setTitle("✅ Test des journaux").setDescription(`Test demandé par <@${interaction.user.id}>.`).setTimestamp()], allowedMentions: { parse: [] } });
      await interaction.reply({ content: "✅ Test envoyé.", ephemeral: true });
    } catch {
      await interaction.reply({ content: "❌ Impossible d'envoyer le test dans le salon.", ephemeral: true });
    }
  },
};
export default command;
