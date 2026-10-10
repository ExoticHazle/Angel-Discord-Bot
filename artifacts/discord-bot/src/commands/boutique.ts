import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { randomUUID } from "node:crypto";
import type { Command } from "../types.js";
import { articleStore, objectStore, profileStore } from "../utils/store.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("boutique")
    .setDescription("[MEMBRE/ADMIN] Consulter et gérer la boutique")
    .addSubcommand((sub) => sub.setName("afficher").setDescription("Afficher les articles disponibles"))
    .addSubcommand((sub) =>
      sub
        .setName("acheter")
        .setDescription("Acheter un article")
        .addStringOption((option) => option.setName("id").setDescription("ID de l'article").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ajouter")
        .setDescription("Ajouter un article")
        .addStringOption((option) => option.setName("nom").setDescription("Nom").setRequired(true))
        .addStringOption((option) => option.setName("description").setDescription("Description").setRequired(true))
        .addIntegerOption((option) => option.setName("prix").setDescription("Prix en Orëlyss").setMinValue(0).setRequired(true))
        .addIntegerOption((option) => option.setName("stock").setDescription("Stock maximal, omettre pour illimité").setMinValue(1))
        .addStringOption((option) => option.setName("objet").setDescription("ID de l'objet remis à l'achat")),
    )
    .addSubcommand((sub) =>
      sub
        .setName("modifier")
        .setDescription("Modifier un article")
        .addStringOption((option) => option.setName("id").setDescription("ID de l'article").setRequired(true))
        .addStringOption((option) => option.setName("nom").setDescription("Nouveau nom").setRequired(true))
        .addStringOption((option) => option.setName("description").setDescription("Nouvelle description").setRequired(true))
        .addIntegerOption((option) => option.setName("prix").setDescription("Nouveau prix").setMinValue(0).setRequired(true))
        .addIntegerOption((option) => option.setName("stock").setDescription("Nouveau stock (0 = épuisé, omettre pour conserver)").setMinValue(0))
        .addBooleanOption((option) => option.setName("illimite").setDescription("Rendre le stock illimité")),
    )
    .addSubcommand((sub) =>
      sub
        .setName("supprimer")
        .setDescription("Supprimer un article")
        .addStringOption((option) => option.setName("id").setDescription("ID de l'article").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ordre")
        .setDescription("Changer l'ordre d'affichage")
        .addStringOption((option) => option.setName("id").setDescription("ID").setRequired(true))
        .addIntegerOption((option) => option.setName("position").setDescription("Position").setMinValue(1).setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("logs")
        .setDescription("Voir les logs d'achat")
        ,
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    const guildId = interaction.guildId!;
    const sub = interaction.options.getSubcommand();
    const adminSubcommands = new Set(["ajouter", "modifier", "supprimer", "ordre", "logs"]);
    if (
      adminSubcommands.has(sub) &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      await interaction.reply({ content: "❌ Permission insuffisante.", ephemeral: true });
      return;
    }
    if (sub === "afficher") {
      const articles = await articleStore.get(guildId);
      const description = articles.length
        ? articles.map((article) => `**${article.name}** — ${article.description}\nID: \`${article.id}\` · **${article.price} Orëlyss** · ${article.stock === undefined ? "illimité" : article.stock > 0 ? `${article.stock} restant(s)` : "ÉPUISÉ"}`).join("\n\n")
        : "La boutique est vide.";
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe67e22).setTitle("Boutique").setDescription(description.slice(0, 4000))] });
      return;
    }
    if (sub === "acheter") {
      const id = interaction.options.getString("id", true);
      const result = await articleStore.purchase(guildId, id, interaction.user.id, interaction.user.tag);
      const messages = {
        not_found: "❌ Article introuvable.",
        sold_out: "❌ Cet article est épuisé.",
        funds: "❌ Vous n'avez pas assez d'Orëlyss.",
      } as const;
      if (!result.ok) {
        await interaction.reply({ content: messages[result.reason], ephemeral: true });
        return;
      }
      await interaction.reply({ content: `✅ Achat effectué : **${result.article.name}** pour ${result.article.price} Orëlyss.`, ephemeral: true });
      if (result.article.stock === 0) {
        const owners = await interaction.guild!.fetchOwner().catch(() => null);
        await owners?.send(`⚠️ L'article **${result.article.name}** est épuisé sur ${interaction.guild!.name}.`).catch(() => null);
      }
      return;
    }
    if (sub === "ajouter") {
      let objectId = interaction.options.getString("objet") ?? undefined;
      if (objectId && !(await objectStore.getById(guildId, objectId))) {
        await interaction.reply({ content: "❌ Objet introuvable. Utilisez /objet liste.", ephemeral: true });
        return;
      }
      const name = interaction.options.getString("nom", true);
      const description = interaction.options.getString("description", true);
      if (!objectId) {
        objectId = randomUUID();
        await objectStore.add(guildId, {
          id: objectId,
          name,
          description,
          emoji: "🎁",
          createdAt: Date.now(),
        });
      }
      const articles = await articleStore.get(guildId);
      const article = {
        id: randomUUID(),
        name,
        description,
        price: interaction.options.getInteger("prix", true),
        stock: interaction.options.getInteger("stock") ?? undefined,
        objectId,
        createdAt: Date.now(),
        sortOrder: articles.length + 1,
      };
      await articleStore.add(guildId, article);
      await interaction.reply({ content: `✅ Article créé : **${article.name}** (` + `\`${article.id}\`).`, ephemeral: true });
      return;
    }
    if (sub === "modifier") {
      const id = interaction.options.getString("id", true);
      const stock = interaction.options.getInteger("stock");
      const unlimited = interaction.options.getBoolean("illimite") ?? false;
      if (unlimited && stock !== null) {
        await interaction.reply({
          content: "❌ Choisissez soit un stock, soit l'option illimitée, pas les deux.",
          ephemeral: true,
        });
        return;
      }
      const changed = await articleStore.update(guildId, id, {
        name: interaction.options.getString("nom", true),
        description: interaction.options.getString("description", true),
        price: interaction.options.getInteger("prix", true),
        stock: unlimited ? null : stock ?? undefined,
      });
      await interaction.reply({ content: changed ? "✅ Article modifié." : "❌ Article introuvable.", ephemeral: true });
      return;
    }
    if (sub === "supprimer") {
      const changed = await articleStore.remove(guildId, interaction.options.getString("id", true));
      await interaction.reply({ content: changed ? "✅ Article supprimé." : "❌ Article introuvable.", ephemeral: true });
      return;
    }
    if (sub === "ordre") {
      const changed = await articleStore.updateOrder(
        guildId,
        interaction.options.getString("id", true),
        interaction.options.getInteger("position", true),
      );
      await interaction.reply({ content: changed ? "✅ Ordre modifié." : "❌ Article introuvable.", ephemeral: true });
      return;
    }
    const logs = await articleStore.purchases(guildId);
    await interaction.reply({
      content: logs.length
        ? logs.map((log) => `• ${log.userTag} — **${log.articleName}** — ${log.price} Orëlyss — <t:${Math.floor(log.timestamp / 1000)}:R>`).join("\n")
        : "Aucun achat enregistré.",
      ephemeral: true,
    });
  },
};

export default command;