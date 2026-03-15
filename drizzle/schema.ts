import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User settings for daily targets and Google Sheets config.
 */
export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  dailyCalorieTarget: int("dailyCalorieTarget").default(2000).notNull(),
  dailyProteinTarget: int("dailyProteinTarget").default(150).notNull(),
  googleSheetUrl: text("googleSheetUrl"),
  googleSheetId: varchar("googleSheetId", { length: 255 }),
  googleSheetName: varchar("googleSheetName", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;

/**
 * Meal logs - each entry is a single meal item logged by the user.
 */
export const mealLogs = mysqlTable("meal_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  mealName: varchar("mealName", { length: 500 }).notNull(),
  mealType: mysqlEnum("mealType", ["breakfast", "lunch", "dinner", "snack"]).notNull(),
  calories: decimal("calories", { precision: 10, scale: 1 }).notNull(),
  protein: decimal("protein", { precision: 10, scale: 1 }).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }),
  servingType: varchar("servingType", { length: 100 }),
  photoUrl: text("photoUrl"),
  tags: text("tags"), // comma-separated tags
  loggedAt: bigint("loggedAt", { mode: "number" }).notNull(), // UTC timestamp in ms
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MealLog = typeof mealLogs.$inferSelect;
export type InsertMealLog = typeof mealLogs.$inferInsert;

/**
 * Food library - user's personal collection of frequently eaten foods.
 */
export const foodLibrary = mysqlTable("food_library", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 500 }).notNull(),
  calories: decimal("calories", { precision: 10, scale: 1 }).notNull(),
  protein: decimal("protein", { precision: 10, scale: 1 }).notNull(),
  defaultQuantity: decimal("defaultQuantity", { precision: 10, scale: 2 }),
  defaultServingType: varchar("defaultServingType", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FoodLibraryItem = typeof foodLibrary.$inferSelect;
export type InsertFoodLibraryItem = typeof foodLibrary.$inferInsert;

/**
 * User tags - managed collection of tags for meal categorization.
 */
export const userTags = mysqlTable("user_tags", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UserTag = typeof userTags.$inferSelect;
export type InsertUserTag = typeof userTags.$inferInsert;
