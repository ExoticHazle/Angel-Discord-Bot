import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import type { Command } from "../types.js";

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("commandes")
    .setDescription("[MEMBRE] Afficher les commandes classées par accès"),
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("Commandes d'Angel")
      .setDescription(
        "Les commandes sont regroupées ci-dessous. Les commandes d'administration et de modération restent protégées par les permissions Discord.",
      )
      .addFields(
        {
          name: "Administration",
          value: [
            "`/autorole` — rôles automatiques",
            "`/dm` — envoyer un message privé",
            "`/say` — faire écrire un message par Angel",
            "`/test-commandes` — vérifier que le bot et ses commandes fonctionnent",
            "`/bienvenue` — configurer le message d’arrivée",
            "`/aurevoir` — configurer le message de départ",
            "`/note` et `/notes` — gérer et consulter les notes",
            "`/objet creer|role|liste` — créer des objets et choisir les rôles offerts",
            "`/quota` — gérer les quotas et leurs salons",
            "`/suivi-effectif` — lister les membres d'un rôle",
            "`/boutique ajouter|modifier|supprimer|ordre` — gérer la boutique et ses rôles requis",
            "`/quete ajouter|supprimer` — créer et supprimer des quêtes",
            "`/log achat` — consulter les achats",
            "`/warnstaff` — avertissements du staff",
            "`/reglement` — configurer le règlement",
          ].join("\n"),
        },
        {
          name: "Modération",
          value: [
            "`/ban`, `/delban` — bannir ou débannir",
            "`/timeout`, `/delto` — gérer les timeouts",
            "`/warn`, `/delwarn` — gérer les avertissements",
            "`/clear` — supprimer des messages",
            "`/historique` — consulter les actions",
            "`/ticket` — gérer les tickets",
          ].join("\n"),
        },
        {
          name: "Membres",
          value: [
            "`/daily` — récolter les Orëlyss quotidiens",
            "`/boutique afficher|acheter` — consulter et acheter",
            "`/inventaire` — voir son solde et ses objets",
            "`/niveau voir|classement` — consulter les niveaux",
            "`/quete liste` — voir les quêtes disponibles",
            "`/reglement afficher` — lire et accepter le règlement",
            "`/sondage` — participer aux sondages",
          ].join("\n"),
        },
      )
      .setFooter({
        text: "Discord choisit l'ordre de sa liste slash ; utilisez cette commande pour parcourir les catégories.",
      });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

export default command;
