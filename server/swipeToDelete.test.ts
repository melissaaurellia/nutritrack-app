import { describe, expect, it } from "vitest";

/**
 * Unit tests for the SwipeToDelete gesture logic.
 * We test the core swipe computation (direction locking, threshold, dampening)
 * as a pure function that mirrors the component's touch handler behavior.
 */

function computeSwipeResult({
  startX,
  startY,
  endX,
  endY,
  threshold = 100,
}: {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  threshold?: number;
}) {
  const dx = endX - startX;
  const dy = endY - startY;

  // Direction lock: if vertical movement >= horizontal, ignore
  if (Math.abs(dy) >= Math.abs(dx)) {
    return { shouldDelete: false, direction: "vertical" as const, offsetX: 0 };
  }

  // Only allow left swipe (negative dx)
  const clampedDx = Math.min(0, dx);

  // Apply dampening after threshold
  const dampened =
    Math.abs(clampedDx) > threshold
      ? -(threshold + (Math.abs(clampedDx) - threshold) * 0.3)
      : clampedDx;

  const shouldDelete = Math.abs(clampedDx) >= threshold;

  return {
    shouldDelete,
    direction: "horizontal" as const,
    offsetX: dampened,
  };
}

describe("SwipeToDelete gesture logic", () => {
  it("triggers delete when swiping left past threshold", () => {
    const result = computeSwipeResult({
      startX: 300,
      startY: 200,
      endX: 150,
      endY: 200,
    });
    expect(result.shouldDelete).toBe(true);
    expect(result.direction).toBe("horizontal");
  });

  it("does not trigger delete when swipe is below threshold", () => {
    const result = computeSwipeResult({
      startX: 300,
      startY: 200,
      endX: 250,
      endY: 200,
    });
    expect(result.shouldDelete).toBe(false);
    expect(result.direction).toBe("horizontal");
    expect(result.offsetX).toBe(-50);
  });

  it("ignores vertical swipes", () => {
    const result = computeSwipeResult({
      startX: 300,
      startY: 200,
      endX: 298,
      endY: 100,
    });
    expect(result.shouldDelete).toBe(false);
    expect(result.direction).toBe("vertical");
  });

  it("ignores right swipes (positive dx)", () => {
    const result = computeSwipeResult({
      startX: 100,
      startY: 200,
      endX: 300,
      endY: 200,
    });
    expect(result.shouldDelete).toBe(false);
    expect(result.offsetX).toBe(0);
  });

  it("applies dampening after threshold", () => {
    const result = computeSwipeResult({
      startX: 300,
      startY: 200,
      endX: 100,
      endY: 200,
      threshold: 100,
    });
    // dampened = -(100 + (200 - 100) * 0.3) = -(100 + 30) = -130
    expect(result.offsetX).toBeCloseTo(-130, 1);
    expect(result.shouldDelete).toBe(true);
  });

  it("uses custom threshold correctly", () => {
    const below = computeSwipeResult({
      startX: 300,
      startY: 200,
      endX: 260,
      endY: 200,
      threshold: 50,
    });
    expect(below.shouldDelete).toBe(false);

    const above = computeSwipeResult({
      startX: 300,
      startY: 200,
      endX: 240,
      endY: 200,
      threshold: 50,
    });
    expect(above.shouldDelete).toBe(true);
  });

  it("exactly at threshold triggers delete", () => {
    const result = computeSwipeResult({
      startX: 300,
      startY: 200,
      endX: 200,
      endY: 200,
      threshold: 100,
    });
    expect(result.shouldDelete).toBe(true);
  });

  it("diagonal swipe with more horizontal movement is treated as horizontal", () => {
    const result = computeSwipeResult({
      startX: 300,
      startY: 200,
      endX: 150,
      endY: 230,
    });
    expect(result.direction).toBe("horizontal");
    expect(result.shouldDelete).toBe(true);
  });

  it("diagonal swipe with more vertical movement is ignored", () => {
    const result = computeSwipeResult({
      startX: 300,
      startY: 200,
      endX: 270,
      endY: 50,
    });
    expect(result.direction).toBe("vertical");
    expect(result.shouldDelete).toBe(false);
  });

  it("no movement results in no delete", () => {
    const result = computeSwipeResult({
      startX: 300,
      startY: 200,
      endX: 300,
      endY: 200,
    });
    expect(result.shouldDelete).toBe(false);
    expect(result.offsetX).toBe(0);
  });
});
