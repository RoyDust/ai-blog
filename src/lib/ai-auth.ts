import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { ForbiddenError, UnauthorizedError } from "@/lib/api-errors";

export const AI_SCOPES = ["drafts:read", "drafts:write", "taxonomy:read"] as const;
export type AiScope = (typeof AI_SCOPES)[number];

export type AiClientSession = {
  id: string;
  ownerId: string;
  name: string;
  scopes: AiScope[];
};

export function hashAiToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeAiScopes(scopes: unknown): AiScope[] | null {
  if (!Array.isArray(scopes)) {
    return null;
  }

  const normalized: AiScope[] = [];

  for (const scope of scopes) {
    if (typeof scope !== "string") {
      return null;
    }

    if (!AI_SCOPES.includes(scope as AiScope)) {
      return null;
    }

    normalized.push(scope as AiScope);
  }

  return normalized;
}

function parseBearerToken(request: Request) {
  const header = request.headers.get("authorization");

  if (!header) {
    throw new UnauthorizedError();
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    throw new UnauthorizedError();
  }

  return token;
}

export async function requireAiClient(request: Request, requiredScope: AiScope): Promise<AiClientSession> {
  const token = parseBearerToken(request);
  const tokenHash = hashAiToken(token);

  const client = await prisma.aiApiClient.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
    },
    select: {
      id: true,
      ownerId: true,
      name: true,
      scopes: true,
    },
  });

  if (!client) {
    throw new UnauthorizedError();
  }

  const scopes = normalizeAiScopes(client.scopes);

  if (!scopes) {
    throw new ForbiddenError("Invalid AI scopes");
  }

  if (!scopes.includes(requiredScope)) {
    throw new ForbiddenError(`Missing AI scope: ${requiredScope}`);
  }

  await prisma.aiApiClient.update({
    where: { id: client.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    ...client,
    scopes,
  };
}
