import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a price in cents to a display string.
 * 0 or null/undefined → "Free", otherwise "$X.XX".
 */
export function formatPrice(cents: number | null | undefined): string {
  if (!cents) return "Free";
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDuration(opts: {
  minutes: number;
  showHours: boolean;
  showSeconds: boolean;
  padZeros: boolean;
}): string {
  if (opts.minutes <= 0) return opts.padZeros ? "00m" : "0m";

  if (opts.showHours && opts.minutes >= 60) {
    const h = Math.floor(opts.minutes / 60);
    const m = opts.minutes % 60;
    const hStr = opts.padZeros ? String(h).padStart(2, "0") : String(h);
    const mStr = opts.padZeros ? String(m).padStart(2, "0") : String(m);
    if (opts.showSeconds) {
      return `${hStr}h ${mStr}m 00s`;
    }
    return m > 0 ? `${hStr}h ${mStr}m` : `${hStr}h`;
  }

  const mStr = opts.padZeros ? String(opts.minutes).padStart(2, "0") : String(opts.minutes);
  if (opts.showSeconds) {
    return `${mStr}m 00s`;
  }
  return `${mStr}m`;
}
