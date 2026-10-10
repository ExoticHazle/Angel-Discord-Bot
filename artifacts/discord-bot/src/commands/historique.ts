import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import type { Command, HistoryType } from "../types.js";
import { historyStore } from "../utils/store.js";

const TYPE_LABELS: Record<HistoryType, string> = {
  ban: "🔨 Ban",
  unban: "✅ Déban",
  timeout: "⏰ Timeout",
  untimeout: "✅ Timeout levé",
  warn: "⚠️ Warn",
  delwarn: "🗑️ Warn supprimé",
  ticket_open: "🎫 Ticket ouvert",
  ticket_close: "🔒 Ticket fermé",
};

function formatEntries(
  entries: ReturnType<typeof historyStore.getForGuild>
): string {
  if (entries.length === 0) return "*Aucun événement trouvé.*";
  return entries
    .map((e) => {
      const label = TYPE_LABELS[e.type] ?? e.type;
      const ts = `<t:${Math.floor(e.timestamp / 1000)}:R>`;
      const extra = e.extra ? ` (${e.extra})` : "";
      return `${label}${extra} — **${e.targetTag}**\n> Par ${e.moderatorTag} · ${e.reason} · ${ts}`;
    })
    .join("\n\n");
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("historique")
    .setDescription("Consulter l'historique des actions de modération")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((sub) =>
      sub
        .setName("serveur")
        .setDescription("Voir les dernières actions sur le serveur")
        .addIntegerOption((opt) =>
          opt
            .setName("limite")
            .setDescription("Nombre d'entrées à afficher (max 25, défaut 15)")
            .setMinValue(1)
            .setMaxValue(25)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("membre")
        .setDescription("Voir l'historique d'un membre spécifique")
        .addUserOption((opt) =>
          opt.setName("membre").setDescription("Le membre à consulter").setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("limite")
            .setDescription("Nombre d'entrées à afficher (max 25, défaut 15)")
            .setMinValue(1)
            .setMaxValue(25)
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;
    const limite = interaction.options.getInteger("limite") ?? 15;

    if (sub === "serveur") {
      const entries = historyStore.getForGuild(guildId, limite);
      const description = formatEntries(entries);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📋 Historique du serveur — ${entries.length} entrée(s)`)
        .setDescription(description.length > 4000 ? description.slice(0, 4000) + "\n…" : description)
        .setFooter({ text: `Dernières ${limite} actions de modération` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === "membre") {
      const target = interaction.options.getUser("membre", true);
      const entries = historyStore.getForMember(guildId, target.id, limite);
      const description = formatEntries(entries);

      const embed = new EmbedBuilder()
        .setColor(0xffa500)
        .setTitle(`📋 Historique de ${target.tag} — ${entries.length} entrée(s)`)
        .setDescription(description.length > 4000 ? description.slice(0, 4000) + "\n…" : description)
        .setThumbnail(target.displayAvatarURL())
        .setFooter({ text: `Dernières ${limite} actions pour ce membre` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

export default command;
