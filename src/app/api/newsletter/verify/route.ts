import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NotFoundError, toErrorResponse, ValidationError } from "@/lib/api-errors";
import { verify } from "@/lib/newsletter";

async function GETHandler(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token")?.trim();
    if (!token) {
      throw new ValidationError("Token is required");
    }

    const subscriber = await verify(token);
    if (!subscriber) {
      throw new NotFoundError("Newsletter verification token not found");
    }

    return NextResponse.json({
      success: true,
      data: {
        email: subscriber.email,
        status: subscriber.status,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Newsletter verification failed");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "public",
  operation: "public.newsletter.verify",
  route: "/api/newsletter/verify",
});
