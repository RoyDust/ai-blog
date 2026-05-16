import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { requireAdminSession } from "@/lib/api-auth";
import { isPrismaConflictError, NotFoundError, ValidationError, toErrorResponse } from "@/lib/api-errors";
import { revalidatePublicContent } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TITLE_LENGTH = 120;
const MAX_SLUG_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 600;
const MAX_COVER_IMAGE_LENGTH = 500;

function optionalString(value: unknown, fieldName: string) {
  if (value == null) return undefined;
  if (typeof value !== "string") {
    throw new ValidationError(`Invalid ${fieldName}`);
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalNullableString(value: unknown, fieldName: string) {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new ValidationError(`Invalid ${fieldName}`);
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function readString(value: unknown, fieldName: string) {
  const trimmed = optionalString(value, fieldName);
  if (!trimmed) {
    throw new ValidationError(`Invalid ${fieldName}`);
  }
  return trimmed;
}

function readOrder(value: unknown) {
  if (value == null || value === "") return 0;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new ValidationError("Invalid order");
  }
  return number;
}

function assertLength(value: string | undefined | null, fieldName: string, maxLength: number) {
  if (value && value.length > maxLength) {
    throw new ValidationError(`${fieldName} is too long`);
  }
}

function parseSeriesInput(payload: unknown) {
  const data = (payload ?? {}) as {
    id?: unknown;
    title?: unknown;
    slug?: unknown;
    description?: unknown;
    coverImage?: unknown;
    order?: unknown;
  };

  const id = optionalString(data.id, "id");
  const title = readString(data.title, "title");
  const slug = readString(data.slug, "slug");
  const description = optionalNullableString(data.description, "description");
  const coverImage = optionalNullableString(data.coverImage, "coverImage");
  const order = readOrder(data.order);

  assertLength(title, "title", MAX_TITLE_LENGTH);
  assertLength(slug, "slug", MAX_SLUG_LENGTH);
  assertLength(description, "description", MAX_DESCRIPTION_LENGTH);
  assertLength(coverImage, "coverImage", MAX_COVER_IMAGE_LENGTH);

  if (!SLUG_PATTERN.test(slug)) {
    throw new ValidationError("Invalid slug");
  }

  return { id, title, slug, description, coverImage, order };
}

function parseSeriesId(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("id")?.trim() || "";
}

async function GETHandler() {
  try {
    await requireAdminSession();

    const series = await prisma.series.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: {
            posts: { where: { deletedAt: null } },
          },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ success: true, data: series });
  } catch (error) {
    return toErrorResponse(error);
  }
}

async function POSTHandler(request: Request) {
  try {
    await requireAdminSession();
    const { title, slug, description, coverImage, order } = parseSeriesInput(await request.json());
    const series = await prisma.series.create({
      data: { title, slug, description, coverImage, order },
    });

    revalidatePublicContent({ seriesSlug: series.slug });

    return NextResponse.json({ success: true, data: series });
  } catch (error) {
    if (isPrismaConflictError(error)) {
      return NextResponse.json({ error: "Series slug already exists" }, { status: 409 });
    }
    return toErrorResponse(error);
  }
}

async function PATCHHandler(request: Request) {
  try {
    await requireAdminSession();
    const { id, title, slug, description, coverImage, order } = parseSeriesInput(await request.json());

    if (!id) {
      return NextResponse.json({ error: "Id is required" }, { status: 400 });
    }

    const existing = await prisma.series.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true },
    });

    if (!existing) {
      throw new NotFoundError("Series not found");
    }

    const series = await prisma.series.update({
      where: { id },
      data: { title, slug, description, coverImage, order },
    });

    revalidatePublicContent({
      seriesSlug: series.slug,
      previousSeriesSlug: existing.slug,
    });

    return NextResponse.json({ success: true, data: series });
  } catch (error) {
    if (isPrismaConflictError(error)) {
      return NextResponse.json({ error: "Series slug already exists" }, { status: 409 });
    }
    return toErrorResponse(error, "Failed to update series");
  }
}

async function DELETEHandler(request: Request) {
  try {
    await requireAdminSession();

    const id = parseSeriesId(request);
    if (!id) {
      return NextResponse.json({ error: "Series ID is required" }, { status: 400 });
    }

    const series = await prisma.series.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, slug: true },
    });

    if (!series) {
      throw new NotFoundError("Series not found");
    }

    await prisma.series.update({
      where: { id: series.id },
      data: { deletedAt: new Date() },
    });

    revalidatePublicContent({ previousSeriesSlug: series.slug });

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete series");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "admin",
  operation: "admin.series.read",
  route: "/api/admin/series",
});
export const POST = withApiOperationLogging(POSTHandler, {
  scope: "admin",
  operation: "admin.series.create",
  route: "/api/admin/series",
});
export const PATCH = withApiOperationLogging(PATCHHandler, {
  scope: "admin",
  operation: "admin.series.update",
  route: "/api/admin/series",
});
export const DELETE = withApiOperationLogging(DELETEHandler, {
  scope: "admin",
  operation: "admin.series.delete",
  route: "/api/admin/series",
});
