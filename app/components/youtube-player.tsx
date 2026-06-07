import { useEffect, useRef, useCallback, useState } from "react";

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

type YouTubePlayerProps = {
  videoUrl: string;
  lessonId: number;
  title: string;
  startPosition: number;
  durationMinutes: number | null;
  watchProgress: number;
  trackingEnabled: boolean;
  autoplay?: boolean;
  onToggleAutoplay?: () => void;
};

function extractVideoId(url: string): string | null {
  if (url.includes("youtube.com/embed/")) {
    const match = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }
  const watchMatch = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
  if (shortMatch) return shortMatch[1];
  return null;
}

let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise<void>((resolve) => {
    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    if (existingScript) {
      // Script exists but YT not ready yet — wait for the callback
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      return;
    }

    window.onYouTubeIframeAPIReady = () => resolve();
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });

  return apiLoadPromise;
}

export function YouTubePlayer({
  videoUrl,
  lessonId,
  title: _title,
  startPosition,
  durationMinutes,
  watchProgress: initialProgress,
  trackingEnabled,
  autoplay = false,
  onToggleAutoplay,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const trackingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [progress, setProgress] = useState(initialProgress);
  const [_videoDuration, setVideoDuration] = useState(
    durationMinutes ? durationMinutes * 60 : 0
  );

  const videoId = extractVideoId(videoUrl);

  const sendTrackingEvent = useCallback(
    (eventType: string, positionSeconds: number) => {
      if (!trackingEnabled) return;
      fetch("/api/video-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, eventType, positionSeconds }),
      }).catch(() => {
        // Silently fail — tracking is best-effort
      });
    },
    [lessonId, trackingEnabled]
  );

  const updateProgress = useCallback(() => {
    const player = playerRef.current;
    if (!player || typeof player.getCurrentTime !== "function") return;

    const currentTime = player.getCurrentTime();
    const duration = player.getDuration();
    if (duration > 0) {
      setVideoDuration(duration);
      const pct = Math.min(Math.round((currentTime / duration) * 100), 100);
      setProgress((prev) => Math.max(prev, pct));
    }
  }, []);

  const startTracking = useCallback(() => {
    if (trackingIntervalRef.current) return;
    trackingIntervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== "function") return;
      const pos = player.getCurrentTime();
      sendTrackingEvent("progress", pos);
      updateProgress();
    }, 10_000);
  }, [sendTrackingEvent, updateProgress]);

  const stopTracking = useCallback(() => {
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!videoId || !containerRef.current) return;

    let player: YT.Player | null = null;
    let destroyed = false;

    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current) return;

      player = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          start: Math.floor(startPosition),
          enablejsapi: 1,
          rel: 0,
          modestbranding: 1,
          ...(autoplay ? { autoplay: 1 } : {}),
        },
        events: {
          onReady: () => {
            playerRef.current = player;
            if (player && typeof player.getDuration === "function") {
              const d = player.getDuration();
              if (d > 0) setVideoDuration(d);
            }
            if (autoplay && player && typeof player.playVideo === "function") {
              try { player.playVideo(); } catch { /* silently fail */ }
            }
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            const p = event.target;
            const pos =
              typeof p.getCurrentTime === "function" ? p.getCurrentTime() : 0;

            switch (event.data) {
              case window.YT.PlayerState.PLAYING:
                sendTrackingEvent("play", pos);
                startTracking();
                updateProgress();
                break;
              case window.YT.PlayerState.PAUSED:
                sendTrackingEvent("pause", pos);
                stopTracking();
                updateProgress();
                break;
              case window.YT.PlayerState.ENDED:
                sendTrackingEvent("ended", pos);
                stopTracking();
                setProgress(100);
                break;
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      stopTracking();
      if (player && typeof player.destroy === "function") {
        player.destroy();
      }
      playerRef.current = null;
    };
  }, [videoId, startPosition, autoplay, sendTrackingEvent, startTracking, stopTracking, updateProgress]);

  if (!videoId) {
    return (
      <div className="mb-8 flex aspect-video items-center justify-center rounded-lg bg-muted">
        <p className="text-muted-foreground">Invalid or unsupported video URL</p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="aspect-video overflow-hidden rounded-lg">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {trackingEnabled && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Watch progress</span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      {onToggleAutoplay && (
        <div className="mt-2 flex items-center justify-end">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            Autoplay
            <button
              type="button"
              role="switch"
              aria-checked={autoplay}
              className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors ${
                autoplay
                  ? "border-primary bg-primary"
                  : "border-input bg-muted"
              }`}
              onClick={onToggleAutoplay}
            >
              <span
                className={`inline-block size-3.5 transform rounded-full bg-background shadow-sm transition-transform ${
                  autoplay ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </label>
        </div>
      )}
    </div>
  );
}
