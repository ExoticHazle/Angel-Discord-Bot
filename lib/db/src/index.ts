import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set.");
}

if (!process.env.AIVEN_CA_CERT) {
  throw new Error("AIVEN_CA_CERT must be set.");
}

// Nettoyage des paramètres SSL de l'URL
const databaseUrl = new URL(process.env.DATABASE_URL);

databaseUrl.searchParams.delete("sslmode");
databaseUrl.searchParams.delete("sslrootcert");
databaseUrl.searchParams.delete("sslcert");
databaseUrl.searchParams.delete("sslkey");

export const pool = new Pool({
  connectionString: databaseUrl.toString(),
  ssl: {
    ca: process.env.AIVEN_CA_CERT.replace(/\\n/g, "\n"),
    rejectUnauthorized: true,
  },
});

export const db = drizzle(pool, { schema });

export * from "./schema/index.js";
