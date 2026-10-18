import { ChannelType, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder, type ChatInputCommandInteraction } from "discord.js";
import type { Command } from "../types.js";
import { communityConfigStore } from "../utils/store.js";
import { DEFAULT_GOODBYE_TEMPLATE, buildGoodbyePayload } from "../utils/goodbye.js";
import { hasEveryoneMention } from "../utils/everyoneMention.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("aurevoir")
    .setDescription("[ADMIN] Configurer les messages de départ")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) => sub.setName("configurer").setDescription("Activer les annonces de départ")
      .addChannelOption((option) => option.setName("salon").setDescription("Salon des départs").addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption((option) => option.setName("message").setDescription("Variables : {username}, {server}, {memberCount}, @everyone").setMaxLength(1500)))
    .addSubcommand((sub) => sub.setName("voir").setDescription("Afficher la configuration"))
    .addSubcommand((sub) => sub.setName("test").setDescription("Envoyer un aperçu"))
    .addSubcommand((sub) => sub.setName("desactiver").setDescription("Désactiver les annonces de départ")),
  async execute(interaction: ChatInputCommandInteraction) {
    const guild = interaction.guild;
    if (!guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      await interaction.reply({ content: "❌ Permission Gérer le serveur nécessaire.", ephemeral: true });
      return;
    }
    const sub = interaction.options.getSubcommand();
    const config = await communityConfigStore.get(guild.id);
    if (sub === "configurer") {
      const channel = interaction.options.getChannel("salon", true);
      const raw = interaction.options.getString("message");
      if (raw !== null && !raw.trim()) {
        await interaction.reply({ content: "❌ Le message ne peut pas être vide.", ephemeral: true });
        return;
      }
      if (hasEveryoneMention(raw ?? "")) {
        const [author, bot] = await Promise.all([
          guild.members.fetch(interaction.user.id).catch(() => null),
          guild.members.fetchMe().catch(() => null),
        ]);
        if (!author || !bot || !channel.permissionsFor(author)?.has(PermissionFlagsBits.MentionEveryone) || !channel.permissionsFor(bot)?.has(PermissionFlagsBits.MentionEveryone)) {
          await interaction.reply({ content: "❌ Pour utiliser @everyone ou @here, toi et Angel devez avoir la permission Mentionner @everyone dans ce salon.", ephemeral: true });
          return;
        }
      }
      config.goodbyeChannelId = channel.id;
      config.goodbyeMessage = raw?.trim() || DEFAULT_GOODBYE_TEMPLATE;
      await communityConfigStore.save(guild.id, config);
      await interaction.reply({ content: `✅ Messages d’au revoir activés dans <#${channel.id}>. Ajoute \`@everyone\` dans le texte si tu veux notifier tout le serveur.`, ephemeral: true });
      return;
    }
    if (sub === "voir") {
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x8e73d7).setTitle("Messages d’au revoir")
        .setDescription(config.goodbyeChannelId
          ? `**Salon :** <#${config.goodbyeChannelId}>\n**Message :** ${config.goodbyeMessage ?? DEFAULT_GOODBYE_TEMPLATE}`
          : "Aucun message configuré. Utilise /aurevoir configurer.")], ephemeral: true, allowedMentions: { parse: [] } });
      return;
    }
    if (sub === "test") {
      if (!config.goodbyeChannelId) {
        await interaction.reply({ content: "❌ Configure d’abord /aurevoir configurer.", ephemeral: true });
        return;
      }
      const channel = await guild.channels.fetch(config.goodbyeChannelId).catch(() => null);
      if (!channel || channel.type !== ChannelType.GuildText) {
        await interaction.reply({ content: "❌ Salon introuvable.", ephemeral: true });
        return;
      }
      const member = await guild.members.fetch(interaction.user.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: "❌ Impossible de charger ton profil.", ephemeral: true });
        return;
      }
      try {
        await channel.send(buildGoodbyePayload(config.goodbyeMessage ?? DEFAULT_GOODBYE_TEMPLATE, member, new Date(), false));
        await interaction.reply({ content: `✅ Aperçu envoyé dans <#${channel.id}> (sans ping @everyone).`, ephemeral: true });
      } catch {
        await interaction.reply({ content: "❌ Impossible d'envoyer le message dans ce salon.", ephemeral: true });
      }
      return;
    }
    delete config.goodbyeChannelId;
    delete config.goodbyeMessage;
    await communityConfigStore.save(guild.id, config);
    await interaction.reply({ content: "✅ Messages d’au revoir désactivés.", ephemeral: true });
  },
};
export default command;
