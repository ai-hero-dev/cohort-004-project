import { useState } from "react";
import { useFetcher } from "react-router";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

export function StarRatingDisplay({
  average,
  count,
  className,
}: {
  average: number | null;
  count: number;
  className?: string;
}) {
  if (count === 0) return null;

  const rounded = Math.round(average ?? 0);

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              i <= rounded
                ? "fill-yellow-400 text-yellow-400"
                : "fill-muted text-muted-foreground"
            )}
          />
        ))}
      </div>
      <span className="text-xs font-medium">{(average ?? 0).toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">({count})</span>
    </div>
  );
}

export function StarRatingInput({
  currentRating,
}: {
  currentRating: number | null;
}) {
  const fetcher = useFetcher();
  const [hovered, setHovered] = useState<number | null>(null);

  const pendingRating = fetcher.formData
    ? Number(fetcher.formData.get("rating"))
    : null;
  const displayRating = hovered ?? pendingRating ?? currentRating ?? 0;

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        {currentRating ? "Your rating" : "Rate this course"}
      </p>
      <fetcher.Form method="post" className="flex items-center gap-0.5">
        <input type="hidden" name="intent" value="rate-course" />
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="submit"
            name="rating"
            value={String(star)}
            className="p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(null)}
            aria-label={`Rate ${star} out of 5`}
          >
            <Star
              className={cn(
                "size-5 transition-colors",
                displayRating >= star
                  ? "fill-yellow-400 text-yellow-400"
                  : "fill-muted text-muted-foreground"
              )}
            />
          </button>
        ))}
      </fetcher.Form>
    </div>
  );
}
