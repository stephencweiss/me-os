import type { WebhookEvent } from "@clerk/nextjs/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import {
  bootstrapAppUserFromClerk,
  deleteAppUserByClerkId,
  displayNameFromClerkWebhookUser,
  primaryEmailFromClerkWebhookUser,
} from "@/lib/app-user-bootstrap";

export const dynamic = "force-dynamic";

function isUserEvent(evt: WebhookEvent): evt is Extract<WebhookEvent, { type: `user.${string}` }> {
  return evt.type.startsWith("user.");
}

export async function POST(req: NextRequest) {
  let evt: WebhookEvent;
  try {
    evt = await verifyWebhook(req);
  } catch (e) {
    console.error("[clerk webhook] verify failed", e);
    return new Response("Invalid webhook", { status: 400 });
  }

  if (!isUserEvent(evt)) {
    return new Response("ok", { status: 200 });
  }

  try {
    if (evt.type === "user.deleted") {
      const id = evt.data.id;
      if (id) await deleteAppUserByClerkId(id);
      return new Response("ok", { status: 200 });
    }

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const id = evt.data.id;
      if (!id) {
        return new Response("ok", { status: 200 });
      }
      const email = primaryEmailFromClerkWebhookUser(evt.data);
      const displayName = displayNameFromClerkWebhookUser(evt.data);
      await bootstrapAppUserFromClerk({
        clerkUserId: id,
        email,
        displayName,
      });
    }
  } catch (e) {
    console.error("[clerk webhook] handler error", evt.type, e);
    return new Response("Handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
