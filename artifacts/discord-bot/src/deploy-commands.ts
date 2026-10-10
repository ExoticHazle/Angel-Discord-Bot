import { REST, Routes } from "discord.js";
import { readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_CLIENT_ID");
  process.exit(1);
}

const commands: unknown[] = [];

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
const route = guildId
  ? Routes.applicationGuildCommands(clientId, guildId)
  : Routes.applicationCommands(clientId);

console.log(
  `Deploying ${commands.length} slash commands ${guildId ? `to guild ${guildId}` : "globally"}...`,
);

await rest.put(route, {
  body: commands,
});

const deployed = await rest.get(route) as Array<{ name: string }>;
const expectedNames = commands.map((command) => (command as { name: string }).name);
const deployedNames = deployed.map((command) => command.name);
const missing = expectedNames.filter((name) => !deployedNames.includes(name));
const unexpected = deployedNames.filter((name) => !expectedNames.includes(name));

if (missing.length || unexpected.length || deployed.length !== commands.length) {
  throw new Error(
    `Slash command verification failed. Missing: ${missing.join(", ") || "none"}. ` +
    `Unexpected: ${unexpected.join(", ") || "none"}.`,
  );
}

console.log(`Successfully deployed and verified ${deployed.length} commands.`);
console.log(`Commands: ${deployedNames.sort().join(", ")}`);
