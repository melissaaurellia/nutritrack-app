import { describe, expect, it, vi, beforeEach } from "vitest";
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

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("auth.me", () => {
  it("returns null for unauthenticated users", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("returns user data for authenticated users", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.name).toBe("Test User 1");
    expect(result?.email).toBe("user1@example.com");
  });
});

describe("settings", () => {
  it("returns default settings for new user", async () => {
    const { ctx } = createAuthContext(999);
    const caller = appRouter.createCaller(ctx);
    const result = await caller.settings.get();
    expect(result).toBeDefined();
    expect(result.dailyCalorieTarget).toBe(2000);
    expect(result.dailyProteinTarget).toBe(150);
  });

  it("updates and retrieves settings", async () => {
    const { ctx } = createAuthContext(998);
    const caller = appRouter.createCaller(ctx);

    await caller.settings.update({
      dailyCalorieTarget: 2500,
      dailyProteinTarget: 180,
    });

    const result = await caller.settings.get();
    expect(result.dailyCalorieTarget).toBe(2500);
    expect(result.dailyProteinTarget).toBe(180);
  });

  it("rejects invalid calorie targets", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.settings.update({ dailyCalorieTarget: -100 })
    ).rejects.toThrow();
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.settings.get()).rejects.toThrow();
  });
});

describe("meals", () => {
  it("creates a meal log", async () => {
    const { ctx } = createAuthContext(997);
    const caller = appRouter.createCaller(ctx);

    const now = Date.now();
    const meal = await caller.meals.create({
      mealName: "Chicken Breast",
      mealType: "lunch",
      calories: 300,
      protein: 45,
      quantity: 1,
      servingType: "pieces",
      loggedAt: now,
    });

    expect(meal).toBeDefined();
    expect(meal.mealName).toBe("Chicken Breast");
    expect(Number(meal.calories)).toBe(300);
    expect(Number(meal.protein)).toBe(45);
    expect(meal.mealType).toBe("lunch");
  });

  it("lists meals by date range", async () => {
    const { ctx } = createAuthContext(996);
    const caller = appRouter.createCaller(ctx);

    const now = Date.now();
    await caller.meals.create({
      mealName: "Oatmeal",
      mealType: "breakfast",
      calories: 200,
      protein: 8,
      loggedAt: now,
    });

    const meals = await caller.meals.listByDate({
      startMs: now - 1000,
      endMs: now + 1000,
    });

    expect(meals.length).toBeGreaterThanOrEqual(1);
    expect(meals.some((m) => m.mealName === "Oatmeal")).toBe(true);
  });

  it("deletes a meal", async () => {
    const { ctx } = createAuthContext(995);
    const caller = appRouter.createCaller(ctx);

    const now = Date.now();
    const meal = await caller.meals.create({
      mealName: "Toast",
      mealType: "breakfast",
      calories: 150,
      protein: 5,
      loggedAt: now,
    });

    const result = await caller.meals.delete({ id: meal.id });
    expect(result.success).toBe(true);

    const meals = await caller.meals.listByDate({
      startMs: now - 1000,
      endMs: now + 1000,
    });
    expect(meals.some((m) => m.id === meal.id)).toBe(false);
  });

  it("creates meal and adds to library when toggled", async () => {
    const { ctx } = createAuthContext(994);
    const caller = appRouter.createCaller(ctx);

    await caller.meals.create({
      mealName: "Protein Shake",
      mealType: "snack",
      calories: 100,
      protein: 25,
      loggedAt: Date.now(),
      addToLibrary: true,
    });

    const library = await caller.library.list();
    expect(library.some((item) => item.name === "Protein Shake")).toBe(true);
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.meals.create({
        mealName: "Test",
        mealType: "lunch",
        calories: 100,
        protein: 10,
        loggedAt: Date.now(),
      })
    ).rejects.toThrow();
  });

  it("validates meal type enum", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.meals.create({
        mealName: "Test",
        mealType: "brunch" as any,
        calories: 100,
        protein: 10,
        loggedAt: Date.now(),
      })
    ).rejects.toThrow();
  });

  it("creates a meal with tags", async () => {
    const { ctx } = createAuthContext(985);
    const caller = appRouter.createCaller(ctx);

    const meal = await caller.meals.create({
      mealName: "Avocado Toast",
      mealType: "breakfast",
      calories: 350,
      protein: 12,
      loggedAt: Date.now(),
      tags: ["vegan", "high-fiber"],
    });

    expect(meal).toBeDefined();
    expect(meal.tags).toBe("vegan,high-fiber");
  });

  it("updates a meal with tags", async () => {
    const { ctx } = createAuthContext(984);
    const caller = appRouter.createCaller(ctx);

    const meal = await caller.meals.create({
      mealName: "Salad",
      mealType: "lunch",
      calories: 200,
      protein: 10,
      loggedAt: Date.now(),
    });

    const updated = await caller.meals.update({
      id: meal.id,
      mealName: "Caesar Salad",
      calories: 250,
      tags: ["low-carb"],
    });

    expect(updated!.mealName).toBe("Caesar Salad");
    expect(Number(updated!.calories)).toBe(250);
    expect(updated!.tags).toBe("low-carb");
  });
});

describe("library", () => {
  it("adds and lists food library items", async () => {
    const { ctx } = createAuthContext(993);
    const caller = appRouter.createCaller(ctx);

    await caller.library.add({
      name: "Brown Rice",
      calories: 220,
      protein: 5,
      defaultQuantity: 1,
      defaultServingType: "cups",
    });

    const items = await caller.library.list();
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items.some((i) => i.name === "Brown Rice")).toBe(true);
  });

  it("updates a library item", async () => {
    const { ctx } = createAuthContext(992);
    const caller = appRouter.createCaller(ctx);

    const item = await caller.library.add({
      name: "Egg",
      calories: 70,
      protein: 6,
    });

    const updated = await caller.library.update({
      id: item!.id,
      calories: 80,
      protein: 7,
    });

    expect(Number(updated!.calories)).toBe(80);
    expect(Number(updated!.protein)).toBe(7);
  });

  it("deletes a library item", async () => {
    const { ctx } = createAuthContext(991);
    const caller = appRouter.createCaller(ctx);

    const item = await caller.library.add({
      name: "Banana",
      calories: 105,
      protein: 1,
    });

    const result = await caller.library.delete({ id: item!.id });
    expect(result.success).toBe(true);

    const items = await caller.library.list();
    expect(items.some((i) => i.id === item!.id)).toBe(false);
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.library.list()).rejects.toThrow();
  });
});

describe("sheets.sync", () => {
  it("requires Google Sheet URL to be configured", async () => {
    const { ctx } = createAuthContext(990);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.sheets.sync({ date: "2026-03-14" })
    ).rejects.toThrow(/Google Sheets URL not configured/);
  });

  it("returns formatted sync data when sheet is configured", async () => {
    const { ctx } = createAuthContext(889);
    const caller = appRouter.createCaller(ctx);

    // Configure sheet URL
    await caller.settings.update({
      googleSheetUrl: "https://docs.google.com/spreadsheets/d/abc123/edit",
      googleSheetId: "abc123",
      googleSheetName: "Sheet1",
    });

    // Add some meals
    const dateMs = new Date("2026-03-14T12:00:00Z").getTime();
    await caller.meals.create({
      mealName: "Granola + yogurt",
      mealType: "breakfast",
      calories: 550,
      protein: 15,
      loggedAt: dateMs,
    });
    await caller.meals.create({
      mealName: "Chicken rice",
      mealType: "lunch",
      calories: 600,
      protein: 40,
      loggedAt: dateMs,
    });

    const result = await caller.sheets.sync({ date: "2026-03-14" });
    expect(result.date).toBe("14/3/2026");
    expect(result.day).toBe("Saturday");
    expect(result.calories).toBe(1150);
    expect(result.protein).toBe(55);
    expect(result.meals).toContain("Bfast:");
    expect(result.meals).toContain("Lunch:");
    expect(result.meals).toContain("Granola + yogurt");
    expect(result.meals).toContain("550 cal");
    expect(result.meals).toContain("15g protein");
    expect(result.sheetId).toBe("abc123");
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.sheets.sync({ date: "2026-03-14" })
    ).rejects.toThrow();
  });
});
