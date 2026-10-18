import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Collection,
} from "discord.js";
import type { Command } from "../types.js";
import { communityConfigStore } from "../utils/store.js";

/**
 * /test-commandes — diagnostic en LECTURE SEULE.
 * N'exécute aucune commande (pas de ban, clear, dm...) et n'écrit rien en base.
 * Il vérifie que chaque commande est saine et que le bot est bien configuré.
 */

const REQUIRED_PERMS: [bigint, string][] = [
  [PermissionFlagsBits.SendMessages, "Envoyer des messages"],
  [PermissionFlagsBits.EmbedLinks, "Intégrer des liens"],
  [PermissionFlagsBits.AttachFiles, "Joindre des fichiers"],
  [PermissionFlagsBits.ManageMessages, "Gérer les messages (/clear)"],
  [PermissionFlagsBits.ManageChannels, "Gérer les salons (/ticket)"],
  [
    PermissionFlagsBits.ManageRoles,
    "Gérer les rôles (/autorole, /reglement, boutique)",
  ],
  [PermissionFlagsBits.BanMembers, "Bannir (/ban, /delban)"],
  [PermissionFlagsBits.ModerateMembers, "Timeout (/timeout, /delto)"],
];

function chunk(lines: string[], max = 1000): string[] {
  const out: string[] = [];
  let cur = "";
  for (const line of lines) {
    if ((cur + "\n" + line).length > max) {
      out.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + "\n" + line : line;
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : ["—"];
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName("test-commandes")
    .setDescription(
      "[ADMIN] Vérifier que toutes les commandes et la configuration sont saines",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(
    interaction: ChatInputCommandInteraction,
    commands?: Collection<string, Command>,
  ) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const results: string[] = [];
    let okCount = 0;
    let koCount = 0;

    // ── 1. Santé de chaque commande chargée ─────────────────────────
    const loaded = commands ? [...commands.values()] : [];
    for (const cmd of loaded) {
      const name = cmd.data.name;
      const problems: string[] = [];
      try {
        const json = cmd.data.toJSON() as {
          description?: string;
          options?: { type: number; options?: unknown[] }[];
        };
        if (!json.description) problems.push("description vide");
        if (typeof cmd.execute !== "function")
          problems.push("execute manquant");
        const subs = (json.options ?? []).filter(
          (o) => o.type === 1 || o.type === 2,
        ).length;
        results.push(
          `${problems.length ? "❌" : "✅"} \`/${name}\`${subs ? ` (${subs} sous-cmd)` : ""}${problems.length ? " — " + problems.join(", ") : ""}`,
        );
      } catch (err) {
        problems.push(`définition invalide : ${(err as Error).message}`);
        results.push(`❌ \`/${name}\` — ${problems.join(", ")}`);
      }
      if (problems.length) koCount++;
      else okCount++;
    }

    // ── 2. Commandes publiées sur Discord vs commandes du code ──────
    let deployLine = "";
    try {
      const client = interaction.client;
      const globalCmds = await client.application!.commands.fetch();
      const guildCmds = guild ? await guild.commands.fetch() : null;
      const published = new Set([
        ...globalCmds.map((c) => c.name),
        ...(guildCmds ? guildCmds.map((c) => c.name) : []),
      ]);
      const local = new Set(loaded.map((c) => c.data.name));
      const notPublished = [...local].filter((n) => !published.has(n));
      const orphan = [...published].filter((n) => !local.has(n));
      deployLine =
        notPublished.length || orphan.length
          ? `⚠️ Non publiées : ${notPublished.map((n) => `/${n}`).join(", ") || "aucune"}\n⚠️ Publiées mais absentes du code : ${orphan.map((n) => `/${n}`).join(", ") || "aucune"}\n→ Lance \`pnpm --filter @workspace/discord-bot run deploy\`.`
          : `✅ Les ${local.size} commandes du code sont bien publiées sur Discord.`;
    } catch (err) {
      deployLine = `❌ Impossible de lire les commandes publiées : ${(err as Error).message}`;
    }

    // ── 3. Base de données (lecture seule) ──────────────────────────
    let dbLine = "";
    let config: Awaited<ReturnType<typeof communityConfigStore.get>> | null =
      null;
    try {
      const t0 = Date.now();
      config = await communityConfigStore.get(guild?.id ?? "0");
      dbLine = `✅ PostgreSQL répond (${Date.now() - t0} ms)`;
    } catch (err) {
      dbLine = `❌ PostgreSQL inaccessible : ${(err as Error).message}`;
    }

    // ── 4. Permissions du bot ───────────────────────────────────────
    const permLines: string[] = [];
    if (guild) {
      const me =
        guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
      for (const [flag, label] of REQUIRED_PERMS) {
        permLines.push(`${me?.permissions.has(flag) ? "✅" : "❌"} ${label}`);
      }
    }

    // ── 5. Configuration du serveur ─────────────────────────────────
    const cfgLines: string[] = [];
    if (guild && config) {
      const checkChannel = async (label: string, id?: string) => {
        if (!id) {
          cfgLines.push(`⚠️ ${label} : non configuré`);
          return;
        }
        const ch = await guild.channels.fetch(id).catch(() => null);
        if (!ch || ch.type !== ChannelType.GuildText) {
          cfgLines.push(
            `❌ ${label} : salon introuvable ou invalide (<#${id}>)`,
          );
          return;
        }
        const canSend = ch
          .permissionsFor(guild.members.me!)
          ?.has(PermissionFlagsBits.SendMessages);
        cfgLines.push(
          `${canSend ? "✅" : "❌"} ${label} : <#${id}>${canSend ? "" : " (le bot ne peut pas écrire)"}`,
        );
      };
      await checkChannel("Salon rapports quotas", config.quotaAdminChannelId);
      await checkChannel("Salon niveaux", config.levelsChannelId);
      await checkChannel("Salon bienvenue", config.welcomeChannelId);

      const roleIds = Object.keys(config.quotaRoles);
      if (!roleIds.length) cfgLines.push("⚠️ Quotas : aucun rôle configuré");
      for (const id of roleIds) {
        const exists =
          guild.roles.cache.has(id) ||
          (await guild.roles.fetch(id).catch(() => null));
        cfgLines.push(
          `${exists ? "✅" : "❌"} Quota <@&${id}> : ${config.quotaRoles[id]} msg${exists ? "" : " (rôle supprimé)"}`,
        );
      }
    }

    // ── Rapport ─────────────────────────────────────────────────────
    const allGood =
      koCount === 0 && !deployLine.startsWith("❌") && !dbLine.startsWith("❌");
    const embed = new EmbedBuilder()
      .setColor(allGood ? 0x2ecc71 : 0xe74c3c)
      .setTitle("🧪 Diagnostic d'Angel")
      .setDescription(
        `**${okCount}/${loaded.length}** commandes saines.\nAucune commande n'a été exécutée et aucune donnée n'a été modifiée.`,
      )
      .addFields(
        ...chunk(results).map((v, i) => ({
          name: i === 0 ? "Commandes" : "Commandes (suite)",
          value: v,
        })),
        { name: "Publication Discord", value: deployLine.slice(0, 1000) },
        { name: "Base de données", value: dbLine.slice(0, 1000) },
      )
      .setTimestamp();

    if (permLines.length)
      embed.addFields({
        name: "Permissions du bot",
        value: permLines.join("\n").slice(0, 1000),
      });
    if (cfgLines.length)
      embed.addFields({ name: "Configuration", value: chunk(cfgLines)[0] });

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
