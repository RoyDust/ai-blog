import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const AI_SCOPES = ["drafts:read", "drafts:write", "taxonomy:read"];
const ENV_FILES = [".env.local", ".env"];

function parseEnvValue(content, key) {
  const match = content.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!match) return undefined;

  return match[1].trim().replace(/^['"]|['"]$/g, "");
}

function findDatabaseUrl(startDir = process.cwd()) {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  let currentDir = path.resolve(startDir);

  while (true) {
    for (const filename of ENV_FILES) {
      const filePath = path.join(currentDir, filename);
      if (!fs.existsSync(filePath)) continue;

      const value = parseEnvValue(fs.readFileSync(filePath, "utf8"), "DATABASE_URL");
      if (value) return value;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return undefined;
    }

    currentDir = parentDir;
  }
}

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

  const connectionString = findDatabaseUrl();

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured");
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
  const owner = await prisma.user.findUnique({ where: { email } });

  if (!owner) {
    throw new Error(`No user found for email: ${email}`);
  }

  const maxAttempts = 5;
  let client = null;
  let rawToken = "";
  let tokenPrefix = "";

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    rawToken = `blog_ai_${crypto.randomBytes(32).toString("hex")}`;
    tokenPrefix = rawToken.slice(0, 32);
    const tokenHash = hashAiToken(rawToken);

    try {
      client = await prisma.aiApiClient.create({
        data: {
          name,
          tokenPrefix,
          tokenHash,
          scopes,
          ownerId: owner.id,
        },
      });
      break;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        continue;
      }

      throw error;
    }
  }

  if (!client) {
    throw new Error("Failed to generate a unique AI token. Please retry.");
  }

  const payload = {
    token: rawToken,
    tokenPrefix,
    clientId: client.id,
    ownerId: owner.id,
    name: client.name,
    scopes: client.scopes,
  };

  console.log(JSON.stringify(payload, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main()
  .catch((error) => {
    console.error("Failed to create AI API token:", error);
    process.exitCode = 1;
  });
