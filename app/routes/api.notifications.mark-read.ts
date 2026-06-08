import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.notifications.mark-read";
import { getCurrentUserId } from "~/lib/session";
import { markAsRead, getNotificationByIdForUser } from "~/services/notificationService";
import { parseJsonBody } from "~/lib/validation";

const schema = z.object({
  notificationId: z.number(),
});

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, schema);
  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { notificationId } = parsed.data;

  const notification = getNotificationByIdForUser({ notificationId, userId: currentUserId });
  if (!notification) {
    throw data("Not found", { status: 404 });
  }

  markAsRead(notificationId);

  return { success: true };
}
