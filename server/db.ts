import { eq, and, between, desc, asc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  userSettings,
  InsertUserSettings,
  mealLogs,
  InsertMealLog,
  foodLibrary,
  InsertFoodLibraryItem,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers ───────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── User Settings helpers ──────────────────────────────────────

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertUserSettings(data: {
  userId: number;
  dailyCalorieTarget?: number;
  dailyProteinTarget?: number;
  googleSheetUrl?: string | null;
  googleSheetId?: string | null;
  googleSheetName?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserSettings(data.userId);
  if (existing) {
    const updateSet: Record<string, unknown> = {};
    if (data.dailyCalorieTarget !== undefined) updateSet.dailyCalorieTarget = data.dailyCalorieTarget;
    if (data.dailyProteinTarget !== undefined) updateSet.dailyProteinTarget = data.dailyProteinTarget;
    if (data.googleSheetUrl !== undefined) updateSet.googleSheetUrl = data.googleSheetUrl;
    if (data.googleSheetId !== undefined) updateSet.googleSheetId = data.googleSheetId;
    if (data.googleSheetName !== undefined) updateSet.googleSheetName = data.googleSheetName;

    await db.update(userSettings).set(updateSet).where(eq(userSettings.userId, data.userId));
    return { ...existing, ...updateSet };
  } else {
    await db.insert(userSettings).values({
      userId: data.userId,
      dailyCalorieTarget: data.dailyCalorieTarget ?? 2000,
      dailyProteinTarget: data.dailyProteinTarget ?? 150,
      googleSheetUrl: data.googleSheetUrl ?? null,
      googleSheetId: data.googleSheetId ?? null,
      googleSheetName: data.googleSheetName ?? null,
    });
    return getUserSettings(data.userId);
  }
}

// ─── Meal Log helpers ───────────────────────────────────────────

export async function createMealLog(data: InsertMealLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(mealLogs).values(data);
  const insertId = result[0].insertId;
  const rows = await db.select().from(mealLogs).where(eq(mealLogs.id, insertId)).limit(1);
  return rows[0];
}

export async function getMealLogsByDate(userId: number, startMs: number, endMs: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mealLogs)
    .where(and(eq(mealLogs.userId, userId), between(mealLogs.loggedAt, startMs, endMs)))
    .orderBy(asc(mealLogs.loggedAt));
}

export async function getMealLogsByDateRange(userId: number, startMs: number, endMs: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(mealLogs)
    .where(and(eq(mealLogs.userId, userId), between(mealLogs.loggedAt, startMs, endMs)))
    .orderBy(asc(mealLogs.loggedAt));
}

export async function updateMealLog(id: number, userId: number, data: Partial<InsertMealLog>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(mealLogs).set(data).where(and(eq(mealLogs.id, id), eq(mealLogs.userId, userId)));
  const rows = await db.select().from(mealLogs).where(eq(mealLogs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteMealLog(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(mealLogs).where(and(eq(mealLogs.id, id), eq(mealLogs.userId, userId)));
  return { success: true };
}

export async function getDailySummaries(userId: number, startMs: number, endMs: number) {
  const db = await getDb();
  if (!db) return [];
  // Return raw meal logs for the range; aggregation done in application layer
  return db
    .select()
    .from(mealLogs)
    .where(and(eq(mealLogs.userId, userId), between(mealLogs.loggedAt, startMs, endMs)))
    .orderBy(asc(mealLogs.loggedAt));
}

// ─── Food Library helpers ───────────────────────────────────────

export async function getFoodLibrary(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(foodLibrary)
    .where(eq(foodLibrary.userId, userId))
    .orderBy(desc(foodLibrary.updatedAt));
}

export async function addFoodLibraryItem(data: InsertFoodLibraryItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(foodLibrary).values(data);
  const insertId = result[0].insertId;
  const rows = await db.select().from(foodLibrary).where(eq(foodLibrary.id, insertId)).limit(1);
  return rows[0];
}

export async function updateFoodLibraryItem(
  id: number,
  userId: number,
  data: Partial<InsertFoodLibraryItem>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .update(foodLibrary)
    .set(data)
    .where(and(eq(foodLibrary.id, id), eq(foodLibrary.userId, userId)));
  const rows = await db.select().from(foodLibrary).where(eq(foodLibrary.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function deleteFoodLibraryItem(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(foodLibrary).where(and(eq(foodLibrary.id, id), eq(foodLibrary.userId, userId)));
  return { success: true };
}

export async function searchFoodLibrary(userId: number, query: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(foodLibrary)
    .where(and(eq(foodLibrary.userId, userId), sql`${foodLibrary.name} LIKE ${`%${query}%`}`))
    .orderBy(desc(foodLibrary.updatedAt));
}
