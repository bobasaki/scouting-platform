import {
  clientSummarySchema,
  updateClientRequestSchema,
} from "@scouting-platform/contracts";
import { deleteClient, updateClient } from "@scouting-platform/core";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  requireAuthenticatedSession,
  toRouteErrorResponse,
} from "../../../../lib/api";

const paramsSchema = z.object({
  id: z.uuid(),
});

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireAuthenticatedSession();

  if (!session.ok) {
    return session.response;
  }

  try {
    const params = paramsSchema.safeParse(await context.params);

    if (!params.success) {
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }

    const body = updateClientRequestSchema.safeParse(await request.json());

    if (!body.success) {
      return NextResponse.json(
        {
          error: "Invalid request payload",
          details: body.error.flatten(),
        },
        { status: 400 },
      );
    }

    const client = await updateClient({
      userId: session.userId,
      clientId: params.data.id,
      ...body.data,
    });

    return NextResponse.json(clientSummarySchema.parse(client));
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireAuthenticatedSession();

  if (!session.ok) {
    return session.response;
  }

  try {
    const params = paramsSchema.safeParse(await context.params);

    if (!params.success) {
      return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
    }

    await deleteClient({
      userId: session.userId,
      clientId: params.data.id,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}
