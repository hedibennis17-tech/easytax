import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "@/db/schema";

// WebSockets sont requis pour les transactions avec Neon.
// Sur le serveur Next.js (Node.js), on utilise 'ws' si disponible, sinon le
// WebSocket natif de Node 22+. En local sans Next.js (tests, drizzle-kit) on
// retombe sur le driver HTTP — pas de transactions, mais les migrations marchent.
if (typeof WebSocket === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    neonConfig.webSocketConstructor = require("ws");
  } catch {
    // ws non disponible (drizzle-kit, tests unitaires) — pas de transactions
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
export const db = drizzle({ client: pool, schema });
export type DB = typeof db;
