import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getUserSettings,
  upsertUserSettings,
  createMealLog,
  getMealLogsByDate,
  getMealLogsByDateRange,
  updateMealLog,
  deleteMealLog,
  getFoodLibrary,
  addFoodLibraryItem,
  updateFoodLibraryItem,
  deleteFoodLibraryItem,
  searchFoodLibrary,
  getUserTags,
  addUserTag,
  updateUserTag,
  deleteUserTag,
  getUsedTagsFromMeals,
  updateUserName,
} from "./db";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { syncRowToSheet, getServiceAccountEmail } from "./googleSheets";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── User Profile ───────────────────────────────────────────
  user: router({
    updateName: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        return updateUserName(ctx.user.id, input.name.trim());
      }),
  }),

  // ─── User Settings ──────────────────────────────────────────
  settings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getUserSettings(ctx.user.id);
      return (
        settings ?? {
          dailyCalorieTarget: 2000,
          dailyProteinTarget: 150,
          googleSheetUrl: null,
          googleSheetId: null,
          googleSheetName: null,
        }
      );
    }),

    update: protectedProcedure
      .input(
        z.object({
          dailyCalorieTarget: z.number().min(0).max(20000).optional(),
          dailyProteinTarget: z.number().min(0).max(2000).optional(),
          googleSheetUrl: z.string().nullable().optional(),
          googleSheetId: z.string().nullable().optional(),
          googleSheetName: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return upsertUserSettings({ userId: ctx.user.id, ...input });
      }),
  }),

  // ─── Meal Logs ──────────────────────────────────────────────
  meals: router({
    create: protectedProcedure
      .input(
        z.object({
          mealName: z.string().min(1).max(500),
          mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
          calories: z.number().min(0),
          protein: z.number().min(0),
          quantity: z.number().min(0).optional(),
          servingType: z.string().max(100).optional(),
          photoUrl: z.string().optional(),
          tags: z.array(z.string()).optional(),
          loggedAt: z.number(), // UTC timestamp in ms
          addToLibrary: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { addToLibrary, tags, ...mealData } = input;
        const meal = await createMealLog({
          ...mealData,
          userId: ctx.user.id,
          calories: String(mealData.calories),
          protein: String(mealData.protein),
          quantity: mealData.quantity != null ? String(mealData.quantity) : null,
          servingType: mealData.servingType ?? null,
          photoUrl: mealData.photoUrl ?? null,
          tags: tags && tags.length > 0 ? tags.join(",") : null,
        });

        // Optionally add to food library
        if (addToLibrary) {
          await addFoodLibraryItem({
            userId: ctx.user.id,
            name: mealData.mealName,
            calories: String(mealData.calories),
            protein: String(mealData.protein),
            defaultQuantity: mealData.quantity != null ? String(mealData.quantity) : null,
            defaultServingType: mealData.servingType ?? null,
          });
        }

        return meal;
      }),

    listByDate: protectedProcedure
      .input(
        z.object({
          startMs: z.number(),
          endMs: z.number(),
        })
      )
      .query(async ({ ctx, input }) => {
        return getMealLogsByDate(ctx.user.id, input.startMs, input.endMs);
      }),

    listByDateRange: protectedProcedure
      .input(
        z.object({
          startMs: z.number(),
          endMs: z.number(),
        })
      )
      .query(async ({ ctx, input }) => {
        return getMealLogsByDateRange(ctx.user.id, input.startMs, input.endMs);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          mealName: z.string().min(1).max(500).optional(),
          mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
          calories: z.number().min(0).optional(),
          protein: z.number().min(0).optional(),
          quantity: z.number().min(0).optional(),
          servingType: z.string().max(100).optional(),
          tags: z.array(z.string()).optional(),
          loggedAt: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, tags, loggedAt, ...data } = input;
        const updateData: Record<string, unknown> = {};
        if (data.mealName !== undefined) updateData.mealName = data.mealName;
        if (data.mealType !== undefined) updateData.mealType = data.mealType;
        if (data.calories !== undefined) updateData.calories = String(data.calories);
        if (data.protein !== undefined) updateData.protein = String(data.protein);
        if (data.quantity !== undefined) updateData.quantity = String(data.quantity);
        if (data.servingType !== undefined) updateData.servingType = data.servingType;
        if (tags !== undefined) updateData.tags = tags.length > 0 ? tags.join(",") : null;
        if (loggedAt !== undefined) updateData.loggedAt = loggedAt;
        return updateMealLog(id, ctx.user.id, updateData as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteMealLog(input.id, ctx.user.id);
      }),
  }),

  // ─── Food Library ───────────────────────────────────────────
  library: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getFoodLibrary(ctx.user.id);
    }),

    search: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ ctx, input }) => {
        return searchFoodLibrary(ctx.user.id, input.query);
      }),

    add: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1).max(500),
          calories: z.number().min(0),
          protein: z.number().min(0),
          defaultQuantity: z.number().min(0).optional(),
          defaultServingType: z.string().max(100).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return addFoodLibraryItem({
          userId: ctx.user.id,
          name: input.name,
          calories: String(input.calories),
          protein: String(input.protein),
          defaultQuantity: input.defaultQuantity != null ? String(input.defaultQuantity) : null,
          defaultServingType: input.defaultServingType ?? null,
        });
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).max(500).optional(),
          calories: z.number().min(0).optional(),
          protein: z.number().min(0).optional(),
          defaultQuantity: z.number().min(0).optional(),
          defaultServingType: z.string().max(100).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        const updateData: Record<string, unknown> = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.calories !== undefined) updateData.calories = String(data.calories);
        if (data.protein !== undefined) updateData.protein = String(data.protein);
        if (data.defaultQuantity !== undefined) updateData.defaultQuantity = String(data.defaultQuantity);
        if (data.defaultServingType !== undefined) updateData.defaultServingType = data.defaultServingType;
        return updateFoodLibraryItem(id, ctx.user.id, updateData as any);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteFoodLibraryItem(input.id, ctx.user.id);
      }),
  }),

  // ─── Photo Analysis ─────────────────────────────────────────
  photo: router({
    upload: protectedProcedure
      .input(
        z.object({
          base64: z.string(),
          mimeType: z.string().default("image/jpeg"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.mimeType.includes("png") ? "png" : "jpg";
        const fileKey = `meals/${ctx.user.id}/${nanoid()}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        return { url };
      }),

    analyze: protectedProcedure
      .input(
        z.object({
          imageUrl: z.string(),
          userDescription: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const userDesc = input.userDescription?.trim();

        const systemPrompt = `You are a nutrition estimation assistant. Your job is to look at a photo of a meal and return a SINGLE JSON object with the combined nutritional totals.

IMPORTANT RULES:
1. You MUST return exactly ONE meal entry that represents the ENTIRE plate/photo.
2. The "name" field should be a short, natural description of the whole dish (e.g. "Sliced beef steak with sauce and salad", "Chicken rice bowl with vegetables", "Birria tacos with consomme").
3. The "calories" field must be the TOTAL calories of EVERYTHING visible in the photo added together (main dish + sides + sauces + garnishes + drinks if visible).
4. The "protein" field must be the TOTAL protein in grams of EVERYTHING visible added together.
5. Do NOT break the meal into separate components. Do NOT list ingredients individually. There is only ONE entry.
6. The "quantity" must always be 1 and "servingType" must always be "serving".
7. The "description" should briefly describe what you see in 1-2 sentences.${userDesc ? `\n\nThe user describes this meal as: "${userDesc}". Use this to improve your name and estimation.` : ""}`;

        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: userDesc
                    ? `This meal is: ${userDesc}. Estimate the TOTAL calories and protein for the entire plate as ONE entry.`
                    : "Estimate the TOTAL calories and protein for this entire meal as ONE single entry.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: input.imageUrl,
                    detail: "high",
                  },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "single_meal_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "A short natural name for the entire meal, e.g. 'Grilled salmon with rice and salad'",
                  },
                  calories: {
                    type: "number",
                    description: "Total calories for everything in the photo combined",
                  },
                  protein: {
                    type: "number",
                    description: "Total protein in grams for everything in the photo combined",
                  },
                  quantity: {
                    type: "number",
                    description: "Always 1",
                  },
                  servingType: {
                    type: "string",
                    description: "Always 'serving'",
                  },
                  description: {
                    type: "string",
                    description: "Brief 1-2 sentence description of what is visible in the photo",
                  },
                },
                required: ["name", "calories", "protein", "quantity", "servingType", "description"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content;
        if (typeof content !== "string") {
          throw new Error("Failed to analyze image — no response from AI");
        }

        let parsed: any;
        try {
          parsed = JSON.parse(content);
        } catch {
          throw new Error("Failed to parse AI response");
        }

        // Server-side safeguard: merge if model somehow returns an array
        if (Array.isArray(parsed)) {
          return {
            name: parsed.map((i: any) => i.name).join(" with "),
            calories: parsed.reduce((sum: number, i: any) => sum + (Number(i.calories) || 0), 0),
            protein: parsed.reduce((sum: number, i: any) => sum + (Number(i.protein) || 0), 0),
            quantity: 1,
            servingType: "serving",
            description: parsed.map((i: any) => i.description || i.name).join(". "),
          };
        }

        // Safeguard: merge if model wraps items in an "items" array
        if (parsed.items && Array.isArray(parsed.items)) {
          const items = parsed.items;
          return {
            name: items.map((i: any) => i.name).join(" with "),
            calories: items.reduce((sum: number, i: any) => sum + (Number(i.calories) || 0), 0),
            protein: items.reduce((sum: number, i: any) => sum + (Number(i.protein) || 0), 0),
            quantity: 1,
            servingType: "serving",
            description: parsed.description || items.map((i: any) => i.name).join(", "),
          };
        }

        // Ensure quantity and servingType are always correct
        return {
          name: String(parsed.name || "Meal"),
          calories: Number(parsed.calories) || 0,
          protein: Number(parsed.protein) || 0,
          quantity: 1,
          servingType: "serving",
          description: String(parsed.description || ""),
        };
      }),
  }),

  // ─── Tags ───────────────────────────────────────────────────
  tags: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getUserTags(ctx.user.id);
    }),

    suggestions: protectedProcedure.query(async ({ ctx }) => {
      // Combine managed tags + tags used in meals
      const managedTags = await getUserTags(ctx.user.id);
      const usedTags = await getUsedTagsFromMeals(ctx.user.id);
      const allTags = new Set<string>();
      managedTags.forEach((t) => allTags.add(t.name.toLowerCase()));
      usedTags.forEach((t) => allTags.add(t));
      return Array.from(allTags).sort();
    }),

    add: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        return addUserTag({ userId: ctx.user.id, name: input.name.trim().toLowerCase() });
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number(), name: z.string().min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        return updateUserTag(input.id, ctx.user.id, input.name.trim().toLowerCase());
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        return deleteUserTag(input.id, ctx.user.id);
      }),
  }),

  // ─── Google Sheets Sync ─────────────────────────────────────
  sheets: router({
    serviceAccountEmail: protectedProcedure.query(() => {
      return { email: getServiceAccountEmail() };
    }),

    sync: protectedProcedure
      .input(
        z.object({
          date: z.string(), // YYYY-MM-DD
        })
      )
      .mutation(async ({ ctx, input }) => {
        const settings = await getUserSettings(ctx.user.id);
        if (!settings?.googleSheetUrl) {
          throw new Error("Google Sheets URL not configured. Please set it in Settings.");
        }

        // Parse the Google Sheet URL to extract sheet ID
        const sheetUrl = settings.googleSheetUrl;
        let sheetId = settings.googleSheetId;
        if (!sheetId) {
          const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
          if (!match) throw new Error("Invalid Google Sheets URL");
          sheetId = match[1];
        }

        // Get meals for the specified date
        const dateObj = new Date(input.date + "T00:00:00Z");
        const startMs = dateObj.getTime();
        const endMs = startMs + 24 * 60 * 60 * 1000 - 1;
        const meals = await getMealLogsByDate(ctx.user.id, startMs, endMs);

        // Format meals in the required format
        const mealTypeLabels: Record<string, string> = {
          breakfast: "Bfast",
          lunch: "Lunch",
          dinner: "Dinner",
          snack: "Snack",
        };

        const groupedMeals: Record<string, string[]> = {
          breakfast: [],
          lunch: [],
          dinner: [],
          snack: [],
        };

        let totalCalories = 0;
        let totalProtein = 0;

        for (const meal of meals) {
          const cal = Number(meal.calories);
          const prot = Number(meal.protein);
          totalCalories += cal;
          totalProtein += prot;
          const label = `${meal.mealName} - ${Math.round(cal)} cal, ${Math.round(prot)}g protein`;
          groupedMeals[meal.mealType].push(label);
        }

        // Build the meals column string
        const mealLines: string[] = [];
        for (const [type, label] of Object.entries(mealTypeLabels)) {
          const items = groupedMeals[type];
          if (items.length > 0) {
            mealLines.push(`${label}: ${items.join(" + ")}`);
          }
        }
        const mealsString = mealLines.join("\n");

        // Get day of week
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const dayName = days[dateObj.getUTCDay()];

        // Format date as D/M/YYYY
        const formattedDate = `${dateObj.getUTCDate()}/${dateObj.getUTCMonth() + 1}/${dateObj.getUTCFullYear()}`;

        const sheetName = settings.googleSheetName || "Sheet1";

        // Attempt to write directly to Google Sheets via service account
        const writeResult = await syncRowToSheet(sheetId!, sheetName, {
          date: formattedDate,
          day: dayName,
          calories: Math.round(totalCalories),
          protein: Math.round(totalProtein),
          meals: mealsString,
        });

        return {
          date: formattedDate,
          day: dayName,
          calories: Math.round(totalCalories),
          protein: Math.round(totalProtein),
          meals: mealsString,
          sheetId: sheetId!,
          sheetName,
          written: writeResult.success,
          writeAction: writeResult.action,
          writeError: writeResult.error,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
