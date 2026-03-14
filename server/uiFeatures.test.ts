import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];

  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("meals.update with loggedAt (date editing)", () => {
  it("updates the loggedAt timestamp of a meal", async () => {
    const uid = 70000 + Math.floor(Math.random() * 10000);
    const { ctx } = createAuthContext(uid);
    const caller = appRouter.createCaller(ctx);

    const originalDate = new Date("2026-03-14T12:00:00Z").getTime();
    const meal = await caller.meals.create({
      mealName: "Steak Dinner",
      mealType: "dinner",
      calories: 500,
      protein: 40,
      loggedAt: originalDate,
    });

    // Change date to March 13
    const newDate = new Date("2026-03-13T19:00:00Z").getTime();
    const updated = await caller.meals.update({
      id: meal.id,
      loggedAt: newDate,
    });

    expect(updated).toBeDefined();
    expect(Number(updated!.loggedAt)).toBe(newDate);
  });

  it("updates loggedAt along with other fields", async () => {
    const uid = 70100 + Math.floor(Math.random() * 10000);
    const { ctx } = createAuthContext(uid);
    const caller = appRouter.createCaller(ctx);

    const originalDate = new Date("2026-03-14T08:00:00Z").getTime();
    const meal = await caller.meals.create({
      mealName: "Morning Oats",
      mealType: "breakfast",
      calories: 300,
      protein: 10,
      loggedAt: originalDate,
    });

    const newDate = new Date("2026-03-12T07:30:00Z").getTime();
    const updated = await caller.meals.update({
      id: meal.id,
      mealName: "Overnight Oats",
      calories: 350,
      loggedAt: newDate,
    });

    expect(updated).toBeDefined();
    expect(updated!.mealName).toBe("Overnight Oats");
    expect(Number(updated!.calories)).toBe(350);
    expect(Number(updated!.loggedAt)).toBe(newDate);
  });

  it("meal appears in new date range after loggedAt update", async () => {
    const uid = 70200 + Math.floor(Math.random() * 10000);
    const { ctx } = createAuthContext(uid);
    const caller = appRouter.createCaller(ctx);

    // Create meal on March 14
    const march14 = new Date("2026-03-14T12:00:00Z").getTime();
    const meal = await caller.meals.create({
      mealName: "Moved Meal",
      mealType: "lunch",
      calories: 400,
      protein: 20,
      loggedAt: march14,
    });

    // Move to March 13
    const march13Noon = new Date("2026-03-13T12:00:00Z").getTime();
    await caller.meals.update({
      id: meal.id,
      loggedAt: march13Noon,
    });

    // Should NOT appear in March 14 range
    const march14Start = new Date("2026-03-14T00:00:00Z").getTime();
    const march14End = new Date("2026-03-14T23:59:59Z").getTime();
    const march14Meals = await caller.meals.listByDate({
      startMs: march14Start,
      endMs: march14End,
    });
    expect(march14Meals.some((m) => m.id === meal.id)).toBe(false);

    // Should appear in March 13 range
    const march13Start = new Date("2026-03-13T00:00:00Z").getTime();
    const march13End = new Date("2026-03-13T23:59:59Z").getTime();
    const march13Meals = await caller.meals.listByDate({
      startMs: march13Start,
      endMs: march13End,
    });
    expect(march13Meals.some((m) => m.id === meal.id)).toBe(true);
  });
});

describe("tags.suggestions includes tags from meals", () => {
  it("returns tags that exist only in meal entries", async () => {
    const uid = 70300 + Math.floor(Math.random() * 10000);
    const { ctx } = createAuthContext(uid);
    const caller = appRouter.createCaller(ctx);

    // Create a meal with a tag that is NOT in managed tags
    await caller.meals.create({
      mealName: "Yolo Burger",
      mealType: "dinner",
      calories: 800,
      protein: 35,
      loggedAt: Date.now(),
      tags: ["yolofoods"],
    });

    // Check suggestions includes the meal tag
    const suggestions = await caller.tags.suggestions();
    expect(suggestions).toContain("yolofoods");
  });

  it("combines managed tags and meal tags without duplicates", async () => {
    const uid = 70400 + Math.floor(Math.random() * 10000);
    const { ctx } = createAuthContext(uid);
    const caller = appRouter.createCaller(ctx);

    // Add a managed tag
    await caller.tags.add({ name: "healthy" });

    // Create a meal with both the managed tag and an unmanaged tag
    await caller.meals.create({
      mealName: "Green Smoothie",
      mealType: "breakfast",
      calories: 200,
      protein: 5,
      loggedAt: Date.now(),
      tags: ["healthy", "organic"],
    });

    const suggestions = await caller.tags.suggestions();
    expect(suggestions).toContain("healthy");
    expect(suggestions).toContain("organic");

    // "healthy" should appear only once
    const healthyCount = suggestions.filter((t) => t === "healthy").length;
    expect(healthyCount).toBe(1);
  });

  it("managed tags list only returns explicitly added tags", async () => {
    const uid = 70500 + Math.floor(Math.random() * 10000);
    const { ctx } = createAuthContext(uid);
    const caller = appRouter.createCaller(ctx);

    // Create a meal with a tag
    await caller.meals.create({
      mealName: "Pizza",
      mealType: "dinner",
      calories: 600,
      protein: 25,
      loggedAt: Date.now(),
      tags: ["cheatday"],
    });

    // The managed tags list should NOT include "cheatday" since it wasn't explicitly added
    const managedTags = await caller.tags.list();
    expect(managedTags.some((t) => t.name === "cheatday")).toBe(false);

    // But suggestions should include it
    const suggestions = await caller.tags.suggestions();
    expect(suggestions).toContain("cheatday");
  });
});
