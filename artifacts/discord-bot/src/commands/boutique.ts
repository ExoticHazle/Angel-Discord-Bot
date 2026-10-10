import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Role,
} from "discord.js";
import { randomUUID } from "node:crypto";
import type { Command } from "../types.js";
import { articleStore, objectStore, profileStore } from "../utils/store.js";

const ARTICLES_PER_EMBED = 12;

function compactText(value: string, maxLength: number) {
  const safe = value.replace(/@/g, "@\u200b").replace(/\s+/g, " ").trim();
  if (safe.length <= maxLength) return safe;
  return `${safe.slice(0, maxLength - 1).trimEnd()}…`;
}

function stockLabel(stock: number | undefined) {
  if (stock === undefined) return "♾️ Stock illimité";
  if (stock <= 0) return "⛔ Épuisé";
  if (stock <= 3) return `⚠️ Plus que ${stock}`;
  return `📦 ${stock} en stock`;
}

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
      const [profile, objects] = await Promise.all([
        profileStore.get(guildId, interaction.user.id),
        objectStore.get(guildId),
      ]);
      const objectById = new Map(objects.map((object) => [object.id, object]));
      const pageCount = Math.max(1, Math.ceil(articles.length / ARTICLES_PER_EMBED));
      const pages: EmbedBuilder[] = [];

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const pageArticles = articles.slice(
          pageIndex * ARTICLES_PER_EMBED,
          (pageIndex + 1) * ARTICLES_PER_EMBED,
        );
        const guildIcon = interaction.guild?.iconURL({ size: 256 });
        const embed = new EmbedBuilder()
          .setColor(0x8e73d7)
          .setTitle("✦ Boutique d’Angel ✦")
          .setDescription(
            articles.length
              ? [
                "Une sélection d’objets à échanger contre des **Orëlyss**.",
                "",
                `🪙 **Ton solde :** ${profile.orelyss.toLocaleString("fr-FR")} Orëlyss`,
                "Pour acheter, utilise `/boutique acheter` avec l’ID affiché.",
              ].join("\n")
              : "La boutique est encore vide. L’équipe pourra bientôt y ajouter des articles.",
          )
          .setFooter({
            text: `${articles.length} article${articles.length === 1 ? "" : "s"} • Page ${pageIndex + 1}/${pageCount}`,
          });
        if (interaction.guild) {
          embed.setAuthor({
            name: interaction.guild.name,
            ...(guildIcon ? { iconURL: guildIcon } : {}),
          });
        }
        const thumbnail = guildIcon ?? interaction.client.user?.displayAvatarURL();
        if (thumbnail) embed.setThumbnail(thumbnail);

        pageArticles.forEach((article, index) => {
          const object = article.objectId ? objectById.get(article.objectId) : undefined;
          const itemNumber = (pageIndex * ARTICLES_PER_EMBED + index + 1)
            .toString()
            .padStart(2, "0");
          const name = compactText(article.name, 72);
          const description = compactText(article.description, 155) || "Un objet du catalogue.";
          const price = article.price.toLocaleString("fr-FR");
          embed.addFields({
            name: `${itemNumber} · ${object?.emoji ?? "🛍️"} ${name}`.slice(0, 256),
            value: [
              description,
              "",
              `🪙 **${price} Orëlyss** · ${stockLabel(article.stock)}`,
              ...(object?.roleId ? [`🎭 **Rôle offert :** <@&${object.roleId}>`] : []),
              `ID : \`${article.id}\``,
            ].join("\n"),
            inline: true,
          });
        });
        pages.push(embed);
      }

      await interaction.reply({
        embeds: pages.slice(0, 10),
        allowedMentions: { parse: [] },
      });
      for (let start = 10; start < pages.length; start += 10) {
        await interaction.followUp({
          embeds: pages.slice(start, start + 10),
          allowedMentions: { parse: [] },
        });
      }
      return;
    }
    if (sub === "acheter") {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild!;
      const id = interaction.options.getString("id", true);
      const article = await articleStore.getById(guildId, id);
      if (!article) {
        await interaction.editReply("❌ Article introuvable.");
        return;
      }

      // Un article peut récompenser un rôle par l'intermédiaire de son objet.
      const object = article.objectId ? await objectStore.getById(guildId, article.objectId) : undefined;
      let rewardRole: Role | null = null;
      if (object?.roleId) {
        const [role, member, botMember] = await Promise.all([
          guild.roles.fetch(object.roleId).catch(() => null),
          guild.members.fetch(interaction.user.id).catch(() => null),
          guild.members.fetchMe().catch(() => null),
        ]);
        if (!role || !role.editable || !botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
          await interaction.editReply("❌ Achat indisponible : le bot ne peut pas attribuer le rôle de cet objet. Préviens un administrateur.");
          return;
        }
        if (!member) {
          await interaction.editReply("❌ Impossible de vérifier tes rôles pour cet achat.");
          return;
        }
        if (member.roles.cache.has(role.id)) {
          await interaction.editReply("❌ Tu possèdes déjà le rôle offert par cet article. Aucun Orëlyss débité.");
          return;
        }
        rewardRole = role;
      }

      const result = await articleStore.purchase(guildId, id, interaction.user.id, interaction.user.tag);
      const messages = {
        not_found: "❌ Article introuvable.",
        sold_out: "❌ Cet article est épuisé.",
        funds: "❌ Vous n'avez pas assez d'Orëlyss.",
      } as const;
      if (!result.ok) {
        await interaction.editReply(messages[result.reason]);
        return;
      }

      if (rewardRole) {
        try {
          // Relecture après l'achat pour éviter une deuxième attribution concurrente.
          const member = await guild.members.fetch({ user: interaction.user.id, force: true });
          if (member.roles.cache.has(rewardRole.id)) {
            const refunded = await articleStore.refundRolePurchase(guildId, result.log, result.article.objectId);
            await interaction.editReply(refunded
              ? "❌ Tu possèdes déjà ce rôle. Ton achat a été annulé et remboursé."
              : "⚠️ Rôle déjà possédé. Vérifie ton solde et contacte un administrateur.");
            return;
          }
          await member.roles.add(rewardRole, `Achat boutique : ${result.article.name}`);
        } catch (err) {
          console.error(`[Boutique] Attribution du rôle ${rewardRole.id} échouée :`, err);
          let refunded = false;
          try {
            refunded = await articleStore.refundRolePurchase(guildId, result.log, result.article.objectId);
          } catch (refundError) {
            console.error(`[Boutique] Remboursement de l'achat ${result.log.id} échoué :`, refundError);
          }
          await interaction.editReply(refunded
            ? "❌ Le rôle n'a pas pu être attribué. L'achat a été annulé et tes Orëlyss ont été remboursés."
            : "⚠️ Impossible d'attribuer le rôle ou de confirmer le remboursement. Contacte un administrateur avec cet ID d'achat : `" + result.log.id + "`.");
          return;
        }
      }

      await interaction.editReply({
        content: `✅ Achat effectué : **${result.article.name}** pour ${result.article.price} Orëlyss.` +
          (rewardRole ? `\n🎭 Tu as reçu le rôle <@&${rewardRole.id}> !` : ""),
        allowedMentions: { parse: [] },
      });
      if (result.article.stock === 0) {
        const owners = await guild.fetchOwner().catch(() => null);
        await owners?.send(`⚠️ L'article **${result.article.name}** est épuisé sur ${guild.name}.`).catch(() => null);
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