import { REST, Routes } from "discord.js";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID?.trim();

if (!token || !clientId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID");
  process.exit(1);
}

const commands: Array<{ name: string }> = [];
const commandsPath = join(__dirname, "commands");
const commandFiles = readdirSync(commandsPath).filter((f) => f.endsWith(".js"));

for (const file of commandFiles) {
  const filePath = pathToFileURL(join(commandsPath, file)).href;
  const mod = await import(filePath);
  if (mod.default?.data) {
    commands.push(mod.default.data.toJSON());
  }
}

const rest = new REST().setToken(token);
const expectedNames = commands.map((command) => command.name);

/**
 * Always register global commands so that Angel works in EVERY guild.
 * If DISCORD_GUILD_ID is set, refresh that guild's commands too: guild-scoped
 * commands take precedence over their global counterparts.
 */
async function deployAndVerify(route: `/applications/${string}/commands` | `/applications/${string}/guilds/${string}/commands`, label: string) {
  console.log(`Deploying ${commands.length} slash commands ${label}...`);
  await rest.put(route, { body: commands });

  const deployed = await rest.get(route) as Array<{ name: string }>;
  const deployedNames = deployed.map((command) => command.name);
  const missing = expectedNames.filter((name) => !deployedNames.includes(name));
  const unexpected = deployedNames.filter((name) => !expectedNames.includes(name));

  if (missing.length || unexpected.length || deployed.length !== commands.length) {
    throw new Error(
      `Slash command verification failed for ${label}. Missing: ${missing.join(", ") || "none"}. ` +
      `Unexpected: ${unexpected.join(", ") || "none"}.`,
    );
  }
  console.log(`Successfully deployed and verified ${deployed.length} commands ${label}.`);
  console.log(`Commands: ${deployedNames.sort().join(", ")}`);
}

await deployAndVerify(Routes.applicationCommands(clientId), "globally (all servers)");

if (guildId) {
  try {
    await deployAndVerify(
      Routes.applicationGuildCommands(clientId, guildId),
      `to guild ${guildId}`,
    );
  } catch (error) {
    // An outdated or inaccessible DISCORD_GUILD_ID must not prevent the global
    // commands from being installed on servers that the bot can access.
    console.warn(`[Deploy] Guild command sync failed for ${guildId}; global commands were registered.`, error);
  }
}
