import { useRef, useState, useCallback, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

interface SwipeToDeleteProps {
  children: ReactNode;
  onDelete: () => void;
  /** Threshold in px to trigger delete action (default 100) */
  threshold?: number;
  /** Whether swipe is disabled (e.g. on desktop) */
  disabled?: boolean;
}

export function SwipeToDelete({
  children,
  onDelete,
  threshold = 100,
  disabled = false,
}: SwipeToDeleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isTracking = useRef(false);
  const directionLocked = useRef<"horizontal" | "vertical" | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const touch = e.touches[0];
      startX.current = touch.clientX;
      startY.current = touch.clientY;
      currentX.current = 0;
      isTracking.current = true;
      directionLocked.current = null;
      setIsSwiping(false);
    },
    [disabled]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (disabled || !isTracking.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX.current;
      const dy = touch.clientY - startY.current;

      // Lock direction after 10px of movement
      if (!directionLocked.current) {
        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
          directionLocked.current =
            Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
        }
        if (directionLocked.current !== "horizontal") {
          isTracking.current = false;
          return;
        }
      }

      if (directionLocked.current !== "horizontal") return;

      // Only allow swiping left (negative direction)
      const clampedDx = Math.min(0, dx);
      // Apply resistance after threshold
      const dampened =
        Math.abs(clampedDx) > threshold
          ? -(threshold + (Math.abs(clampedDx) - threshold) * 0.3)
          : clampedDx;

      currentX.current = dampened;
      setOffsetX(dampened);
      setIsSwiping(true);

      // Prevent vertical scroll while swiping horizontally
      if (Math.abs(dx) > 5) {
        e.preventDefault();
      }
    },
    [disabled, threshold]
  );

  const handleTouchEnd = useCallback(() => {
    if (disabled || !isTracking.current) return;
    isTracking.current = false;

    if (Math.abs(currentX.current) >= threshold) {
      // Trigger delete with animation
      setIsRemoving(true);
      setOffsetX(-window.innerWidth);
      setTimeout(() => {
        onDelete();
        // Reset state after delete callback
        setOffsetX(0);
        setIsSwiping(false);
        setIsRemoving(false);
      }, 300);
    } else {
      // Snap back
      setOffsetX(0);
      setTimeout(() => setIsSwiping(false), 200);
    }
  }, [disabled, threshold, onDelete]);

  // Calculate the red background opacity based on swipe distance
  const progress = Math.min(Math.abs(offsetX) / threshold, 1);
  const showDelete = isSwiping || isRemoving;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-2xl"
      style={{ touchAction: "pan-y" }}
    >
      {/* Red delete background revealed on swipe */}
      {showDelete && (
        <div
          className="absolute inset-0 flex items-center justify-end rounded-2xl"
          style={{
            background: `oklch(${0.55 + progress * 0.05} ${0.2 + progress * 0.05} 25)`,
          }}
        >
          <div
            className="flex items-center gap-2 pr-6 text-white transition-transform"
            style={{
              opacity: progress,
              transform: `scale(${0.7 + progress * 0.3})`,
            }}
          >
            <Trash2 className="h-5 w-5" />
            <span className="text-sm font-semibold">
              {progress >= 1 ? "Release to delete" : "Delete"}
            </span>
          </div>
        </div>
      )}

      {/* Foreground card content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative z-10"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition:
            isSwiping && !isRemoving ? "none" : "transform 0.3s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
