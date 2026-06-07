import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.video-tracking";
import { getCurrentUserId } from "~/lib/session";
import { logWatchEvent } from "~/services/videoTrackingService";
import { parseJsonBody } from "~/lib/validation";

const videoTrackingSchema = z.object({
  lessonId: z.number(),
  eventType: z.string(),
  positionSeconds: z.number(),
});

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, videoTrackingSchema);

  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { lessonId, eventType, positionSeconds } = parsed.data;

  logWatchEvent({ userId: currentUserId, lessonId, eventType, positionSeconds });

  return { success: true };
}
