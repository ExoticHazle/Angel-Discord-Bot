import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL || !process.env.AIVEN_CA_CERT) {
  throw new Error("DATABASE_URL and AIVEN_CA_CERT are required");
}

const url = new URL(process.env.DATABASE_URL);

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    ssl: {
      ca: process.env.AIVEN_CA_CERT.replace(/\\n/g, "\n"),
      rejectUnauthorized: true,
    },
  },
});
