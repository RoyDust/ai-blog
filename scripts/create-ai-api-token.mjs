import path from "node:path";
import crypto from "node:crypto";

import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const AI_SCOPES = ["drafts:read", "drafts:write", "taxonomy:read"];

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function readArg(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function hashAiToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function main() {
  const args = process.argv.slice(2);
  const email = readArg(args, "--email") ?? args[0];
  const name = readArg(args, "--name") ?? "AI Client";
  const scopesArg = readArg(args, "--scopes");

  if (!email) {
    throw new Error("Usage: node scripts/create-ai-api-token.mjs --email user@example.com [--name \"AI Client\"] [--scopes drafts:read,drafts:write]");
  }

  const scopes = scopesArg
    ? scopesArg.split(",").map((scope) => scope.trim()).filter(Boolean)
    : AI_SCOPES;

  const unknownScopes = scopes.filter((scope) => !AI_SCOPES.includes(scope));

  if (unknownScopes.length > 0) {
    throw new Error(`Unknown AI scopes: ${unknownScopes.join(", ")}`);
  }

  const owner = await prisma.user.findUnique({ where: { email } });

  if (!owner) {
    throw new Error(`No user found for email: ${email}`);
  }

  const rawToken = `blog_ai_${crypto.randomBytes(32).toString("hex")}`;
  const tokenHash = hashAiToken(rawToken);
  const tokenPrefix = rawToken.slice(0, 16);

  const client = await prisma.aiApiClient.create({
    data: {
      name,
      tokenPrefix,
      tokenHash,
      scopes,
      ownerId: owner.id,
    },
  });

  const payload = {
    token: rawToken,
    tokenPrefix,
    clientId: client.id,
    ownerId: owner.id,
    name: client.name,
    scopes: client.scopes,
  };

  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((error) => {
    console.error("Failed to create AI API token:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
