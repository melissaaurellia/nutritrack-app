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
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, tags, ...data } = input;
        const updateData: Record<string, unknown> = {};
        if (data.mealName !== undefined) updateData.mealName = data.mealName;
        if (data.mealType !== undefined) updateData.mealType = data.mealType;
        if (data.calories !== undefined) updateData.calories = String(data.calories);
        if (data.protein !== undefined) updateData.protein = String(data.protein);
        if (data.quantity !== undefined) updateData.quantity = String(data.quantity);
        if (data.servingType !== undefined) updateData.servingType = data.servingType;
        if (tags !== undefined) updateData.tags = tags.length > 0 ? tags.join(",") : null;
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
        const descriptionHint = input.userDescription
          ? `\nThe user describes this meal as: "${input.userDescription}". Use this to improve your analysis.`
          : "";

        const result = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a nutrition analysis expert. Analyze the food in the image and estimate the TOTAL calories and protein content for the ENTIRE meal as a single combined entry. Do NOT break the meal into separate ingredients — return one item representing the whole dish/meal.${descriptionHint}

Return a JSON object with the following structure:
{
  "name": "descriptive name of the whole meal",
  "calories": total_estimated_calories_number,
  "protein": total_estimated_protein_grams_number,
  "quantity": 1,
  "servingType": "serving",
  "description": "brief description of what you see in the image and how you estimated the nutrition"
}
Be reasonable with estimates. If you cannot identify the food clearly, provide your best estimate and note uncertainty in the description.`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: input.userDescription
                    ? `Please analyze this food image. The meal is: ${input.userDescription}`
                    : "Please analyze this food image and estimate the nutritional content (calories and protein).",
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
              name: "food_analysis",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  calories: { type: "number" },
                  protein: { type: "number" },
                  quantity: { type: "number" },
                  servingType: { type: "string" },
                  description: { type: "string" },
                },
                required: ["name", "calories", "protein", "quantity", "servingType", "description"],
                additionalProperties: false,
              },
            },
          },
        });

        const content = result.choices[0]?.message?.content;
        if (typeof content === "string") {
          return JSON.parse(content);
        }
        throw new Error("Failed to analyze image");
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
