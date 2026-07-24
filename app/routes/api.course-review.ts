import { data } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/api.course-review";
import { getCurrentUserId } from "~/lib/session";
import { isUserEnrolled } from "~/services/enrollmentService";
import {
  upsertReview,
  getAverageRatingForCourse,
} from "~/services/courseReviewService";
import { parseJsonBody } from "~/lib/validation";

const courseReviewSchema = z.object({
  courseId: z.number(),
  rating: z.number().int().min(1).max(5),
});

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Unauthorized", { status: 401 });
  }

  const parsed = await parseJsonBody(request, courseReviewSchema);
  if (!parsed.success) {
    throw data("Invalid parameters", { status: 400 });
  }

  const { courseId, rating } = parsed.data;

  if (!isUserEnrolled(currentUserId, courseId)) {
    throw data("You must be enrolled in this course to rate it", {
      status: 403,
    });
  }

  upsertReview(currentUserId, courseId, rating);

  return {
    success: true,
    userRating: rating,
    ...getAverageRatingForCourse(courseId),
  };
}
