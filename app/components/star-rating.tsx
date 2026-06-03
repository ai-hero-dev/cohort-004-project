import { useState } from "react";
import { useFetcher } from "react-router";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

function StarIcon({
  fill,
  size = "sm",
}: {
  fill: "full" | "half" | "empty";
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "size-5" : "size-4";

  if (fill === "half") {
    return (
      <div className={cn("relative shrink-0", sizeClass)}>
        <Star className={cn(sizeClass, "text-muted-foreground/40")} />
        <div className="absolute inset-0 w-1/2 overflow-hidden">
          <Star className={cn(sizeClass, "fill-yellow-400 text-yellow-400")} />
        </div>
      </div>
    );
  }

  return (
    <Star
      className={cn(
        sizeClass,
        "shrink-0",
        fill === "full"
          ? "fill-yellow-400 text-yellow-400"
          : "text-muted-foreground/40"
      )}
    />
  );
}

export function StarDisplay({
  averageRating,
  count,
  size = "sm",
  showCount = true,
}: {
  averageRating: number | null;
  count: number;
  size?: "sm" | "md";
  showCount?: boolean;
}) {
  if (averageRating === null || count === 0) return null;

  // Round to nearest 0.5
  const rounded = Math.round(averageRating * 2) / 2;

  return (
    <span className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const full = star <= Math.floor(rounded);
        const half = !full && star === Math.ceil(rounded) && rounded % 1 !== 0;
        return (
          <StarIcon
            key={star}
            fill={full ? "full" : half ? "half" : "empty"}
            size={size}
          />
        );
      })}
      {showCount && (
        <span className="ml-0.5 text-xs text-muted-foreground">
          {averageRating.toFixed(1)}
          {count > 0 && ` (${count})`}
        </span>
      )}
    </span>
  );
}

export function StarInput({
  courseId,
  currentRating,
}: {
  courseId: number;
  currentRating: number | null;
}) {
  const fetcher = useFetcher();
  const [hovered, setHovered] = useState<number | null>(null);

  // Optimistically reflect a just-submitted rating
  const submittedRating =
    fetcher.formData ? Number(fetcher.formData.get("rating")) : null;
  const activeRating = submittedRating ?? currentRating;

  const displayRating = hovered ?? activeRating;

  function submit(rating: number) {
    fetcher.submit(
      { intent: "rate", courseId: String(courseId), rating: String(rating) },
      { method: "post" }
    );
  }

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">
        {activeRating ? "Your rating" : "Rate this course"}
      </p>
      <div
        className="flex gap-1"
        onMouseLeave={() => setHovered(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => submit(star)}
            onMouseEnter={() => setHovered(star)}
            aria-label={`Rate ${star} out of 5`}
          >
            <Star
              className={cn(
                "size-6 transition-colors",
                displayRating !== null && star <= displayRating
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/40"
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
