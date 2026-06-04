import { useState } from "react";
import { useFetcher } from "react-router";
import { Star } from "lucide-react";
import { cn } from "~/lib/utils";

interface StarDisplayProps {
  average: number;
  count: number;
  className?: string;
}

export function StarDisplay({ average, count, className }: StarDisplayProps) {
  if (count === 0) return null;

  return (
    <span className={cn("flex items-center gap-1", className)}>
      <Star className="size-4 fill-amber-400 text-amber-400" />
      <span className="font-medium">{average.toFixed(1)}</span>
      <span className="text-muted-foreground">({count})</span>
    </span>
  );
}

interface RatingInputProps {
  courseId: number;
  currentRating: number | null;
}

export function RatingInput({ courseId, currentRating }: RatingInputProps) {
  const fetcher = useFetcher();
  const [hovered, setHovered] = useState<number | null>(null);

  const pendingRating =
    fetcher.formData ? Number(fetcher.formData.get("rating")) : null;
  const displayRating = pendingRating ?? currentRating;
  const activeRating = hovered ?? displayRating;

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">Your Rating</p>
      <fetcher.Form method="post">
        <input type="hidden" name="_action" value="rate" />
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="submit"
              name="rating"
              value={star}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(null)}
              className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
            >
              <Star
                className={cn(
                  "size-6 transition-colors",
                  activeRating !== null && star <= activeRating
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground"
                )}
              />
            </button>
          ))}
        </div>
        {displayRating && (
          <p className="mt-1 text-xs text-muted-foreground">
            You rated this {displayRating} star{displayRating !== 1 ? "s" : ""}
          </p>
        )}
      </fetcher.Form>
    </div>
  );
}
