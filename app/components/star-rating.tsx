import { useState } from "react";
import { useFetcher } from "react-router";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

const SIZE_CLASSES = {
  sm: "size-3.5",
  md: "size-5",
} as const;

export function StarRating({
  rating,
  count,
  size = "md",
}: {
  rating: number;
  count: number;
  size?: keyof typeof SIZE_CLASSES;
}) {
  if (count === 0) {
    return <span className="text-xs text-muted-foreground">No ratings yet</span>;
  }

  const filled = Math.round(rating);

  return (
    <span className="flex items-center gap-1.5">
      <span className="flex items-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              SIZE_CLASSES[size],
              i < filled
                ? "fill-yellow-400 text-yellow-400"
                : "fill-transparent text-muted-foreground"
            )}
          />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">
        {rating.toFixed(1)} ({count})
      </span>
    </span>
  );
}

export function RatableStars({
  courseId,
  initialRating,
}: {
  courseId: number;
  initialRating: number | null;
}) {
  const fetcher = useFetcher<{ success: boolean; userRating: number }>();
  const [hovered, setHovered] = useState<number | null>(null);

  const pendingRating =
    fetcher.json && typeof fetcher.json === "object" && "rating" in fetcher.json
      ? Number((fetcher.json as { rating: number }).rating)
      : null;

  const optimisticRating =
    pendingRating ?? fetcher.data?.userRating ?? initialRating ?? 0;

  const displayRating = hovered ?? optimisticRating;

  function submitRating(rating: number) {
    fetcher.submit(
      { courseId, rating },
      {
        method: "post",
        action: "/api/course-review",
        encType: "application/json",
      }
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Your rating:</span>
      <span
        className="flex items-center"
        onMouseLeave={() => setHovered(null)}
      >
        {Array.from({ length: 5 }).map((_, i) => {
          const value = i + 1;
          return (
            <button
              key={i}
              type="button"
              className="p-0.5"
              onMouseEnter={() => setHovered(value)}
              onClick={() => submitRating(value)}
              aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
            >
              <Star
                className={cn(
                  "size-5 transition-colors",
                  value <= displayRating
                    ? "fill-yellow-400 text-yellow-400"
                    : "fill-transparent text-muted-foreground"
                )}
              />
            </button>
          );
        })}
      </span>
    </div>
  );
}
