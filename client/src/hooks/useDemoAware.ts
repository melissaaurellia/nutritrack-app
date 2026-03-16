/**
 * useDemoAware hooks — provide a unified interface for data access
 * that works with both tRPC (authenticated) and demo (localStorage) modes.
 */
import { useMemo, useCallback } from "react";
import { useDemo, type DemoMeal, type DemoLibraryItem } from "@/contexts/DemoContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

/* ─── Settings ──────────────────────────────────────────── */
export function useDemoAwareSettings() {
  const { isDemo, settings: demoSettings, updateSettings: updateDemoSettings } = useDemo();
  const trpcSettings = trpc.settings.get.useQuery(undefined, { enabled: !isDemo });
  const trpcUpdate = trpc.settings.update.useMutation({
    onSuccess: () => {
      trpcSettings.refetch();
      toast.success("Settings saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const settings = isDemo
    ? demoSettings
    : trpcSettings.data ?? { dailyCalorieTarget: 2000, dailyProteinTarget: 150, googleSheetUrl: null, googleSheetId: null, googleSheetName: null };

  const updateSettings = useCallback(
    (data: Partial<typeof settings>) => {
      if (isDemo) {
        updateDemoSettings(data);
        toast.success("Settings saved");
      } else {
        trpcUpdate.mutate(data as any);
      }
    },
    [isDemo, updateDemoSettings, trpcUpdate]
  );

  return {
    settings,
    isLoading: !isDemo && trpcSettings.isLoading,
    updateSettings,
    isPending: !isDemo && trpcUpdate.isPending,
    refetch: isDemo ? () => {} : trpcSettings.refetch,
  };
}

/* ─── Meals ─────────────────────────────────────────────── */
export function useDemoAwareMeals(startMs: number, endMs: number) {
  const { isDemo, getMealsByDate, addMeal, updateMeal, deleteMeal } = useDemo();
  const trpcMeals = trpc.meals.listByDate.useQuery({ startMs, endMs }, { enabled: !isDemo });
  const trpcDelete = trpc.meals.delete.useMutation({
    onSuccess: () => { trpcMeals.refetch(); toast.success("Meal deleted"); },
  });
  const trpcCreate = trpc.meals.create.useMutation({
    onSuccess: () => { trpcMeals.refetch(); toast.success("Meal logged!"); },
    onError: (err) => toast.error(err.message),
  });

  const meals = isDemo ? getMealsByDate(startMs, endMs) : (trpcMeals.data ?? []);

  const createMeal = useCallback(
    (data: any) => {
      if (isDemo) {
        addMeal({
          mealName: data.mealName,
          mealType: data.mealType,
          calories: String(data.calories),
          protein: String(data.protein),
          quantity: data.quantity != null ? String(data.quantity) : null,
          servingType: data.servingType ?? null,
          photoUrl: data.photoUrl ?? null,
          tags: data.tags ? data.tags.join(",") : null,
          loggedAt: data.loggedAt ?? Date.now(),
        });
        toast.success("Meal logged!");
      } else {
        trpcCreate.mutate(data);
      }
    },
    [isDemo, addMeal, trpcCreate]
  );

  const removeMeal = useCallback(
    (id: number) => {
      if (isDemo) {
        deleteMeal(id);
        toast.success("Meal deleted");
      } else {
        trpcDelete.mutate({ id });
      }
    },
    [isDemo, deleteMeal, trpcDelete]
  );

  const editMeal = useCallback(
    (id: number, data: any) => {
      if (isDemo) {
        updateMeal(id, {
          mealName: data.mealName,
          mealType: data.mealType,
          calories: String(data.calories),
          protein: String(data.protein),
          quantity: data.quantity != null ? String(data.quantity) : null,
          servingType: data.servingType ?? null,
          tags: data.tags ? (Array.isArray(data.tags) ? data.tags.join(",") : data.tags) : null,
          loggedAt: data.loggedAt,
        });
        toast.success("Meal updated");
      }
      // For non-demo, EditMealDialog handles its own mutation
    },
    [isDemo, updateMeal]
  );

  return {
    meals,
    isLoading: !isDemo && trpcMeals.isLoading,
    createMeal,
    removeMeal,
    editMeal,
    refetch: isDemo ? () => {} : trpcMeals.refetch,
  };
}

/* ─── Meals by date range (for Trends) ──────────────────── */
export function useDemoAwareMealsByRange(startMs: number, endMs: number) {
  const { isDemo, getMealsByDateRange } = useDemo();
  const trpcMeals = trpc.meals.listByDateRange.useQuery({ startMs, endMs }, { enabled: !isDemo });

  const meals = isDemo ? getMealsByDateRange(startMs, endMs) : (trpcMeals.data ?? []);

  return { meals, isLoading: !isDemo && trpcMeals.isLoading };
}

/* ─── Library ───────────────────────────────────────────── */
export function useDemoAwareLibrary() {
  const { isDemo, libraryItems, addLibraryItem, updateLibraryItem, deleteLibraryItem } = useDemo();
  const trpcLibrary = trpc.library.list.useQuery(undefined, { enabled: !isDemo });
  const trpcAdd = trpc.library.add.useMutation({
    onSuccess: () => { trpcLibrary.refetch(); toast.success("Added to library"); },
    onError: (err) => toast.error(err.message),
  });
  const trpcUpdate = trpc.library.update.useMutation({
    onSuccess: () => { trpcLibrary.refetch(); toast.success("Item updated"); },
    onError: (err) => toast.error(err.message),
  });
  const trpcDeleteMut = trpc.library.delete.useMutation({
    onSuccess: () => { trpcLibrary.refetch(); toast.success("Item deleted"); },
    onError: (err) => toast.error(err.message),
  });

  const items = isDemo ? libraryItems : (trpcLibrary.data ?? []);

  const addItem = useCallback(
    (data: any) => {
      if (isDemo) {
        addLibraryItem({
          name: data.name,
          calories: String(data.calories),
          protein: String(data.protein),
          defaultQuantity: data.defaultQuantity != null ? String(data.defaultQuantity) : null,
          defaultServingType: data.defaultServingType ?? null,
        });
        toast.success("Added to library");
      } else {
        trpcAdd.mutate(data);
      }
    },
    [isDemo, addLibraryItem, trpcAdd]
  );

  const updateItem = useCallback(
    (id: number, data: any) => {
      if (isDemo) {
        updateLibraryItem(id, {
          name: data.name,
          calories: String(data.calories),
          protein: String(data.protein),
          defaultQuantity: data.defaultQuantity != null ? String(data.defaultQuantity) : null,
          defaultServingType: data.defaultServingType ?? null,
        });
        toast.success("Item updated");
      } else {
        trpcUpdate.mutate({ id, ...data });
      }
    },
    [isDemo, updateLibraryItem, trpcUpdate]
  );

  const removeItem = useCallback(
    (id: number) => {
      if (isDemo) {
        deleteLibraryItem(id);
        toast.success("Item deleted");
      } else {
        trpcDeleteMut.mutate({ id });
      }
    },
    [isDemo, deleteLibraryItem, trpcDeleteMut]
  );

  return {
    items,
    isLoading: !isDemo && trpcLibrary.isLoading,
    addItem,
    updateItem,
    removeItem,
    refetch: isDemo ? () => {} : trpcLibrary.refetch,
    addPending: !isDemo && trpcAdd.isPending,
    updatePending: !isDemo && trpcUpdate.isPending,
    deletePending: !isDemo && trpcDeleteMut.isPending,
  };
}

/* ─── Tags ──────────────────────────────────────────────── */
export function useDemoAwareTags() {
  const { isDemo, tags, addTag, updateTag, deleteTag } = useDemo();
  const trpcTags = trpc.tags.list.useQuery(undefined, { enabled: !isDemo });
  const trpcSuggestions = trpc.tags.suggestions.useQuery(undefined, { enabled: !isDemo });
  const utils = trpc.useUtils();

  const trpcAdd = trpc.tags.add.useMutation({
    onSuccess: () => { trpcTags.refetch(); utils.tags.suggestions.invalidate(); toast.success("Tag added"); },
    onError: (err) => toast.error(err.message),
  });
  const trpcUpdate = trpc.tags.update.useMutation({
    onSuccess: () => { trpcTags.refetch(); utils.tags.suggestions.invalidate(); toast.success("Tag updated"); },
    onError: (err) => toast.error(err.message),
  });
  const trpcDelete = trpc.tags.delete.useMutation({
    onSuccess: () => { trpcTags.refetch(); utils.tags.suggestions.invalidate(); toast.success("Tag deleted"); },
    onError: (err) => toast.error(err.message),
  });

  const tagList = isDemo ? tags : (trpcTags.data ?? []);
  const suggestions = isDemo ? [] : (trpcSuggestions.data ?? []);

  const addTagFn = useCallback(
    (name: string) => {
      if (isDemo) {
        addTag(name);
        toast.success("Tag added");
      } else {
        trpcAdd.mutate({ name });
      }
    },
    [isDemo, addTag, trpcAdd]
  );

  const updateTagFn = useCallback(
    (id: number, name: string) => {
      if (isDemo) {
        updateTag(id, name);
        toast.success("Tag updated");
      } else {
        trpcUpdate.mutate({ id, name });
      }
    },
    [isDemo, updateTag, trpcUpdate]
  );

  const deleteTagFn = useCallback(
    (id: number) => {
      if (isDemo) {
        deleteTag(id);
        toast.success("Tag deleted");
      } else {
        trpcDelete.mutate({ id });
      }
    },
    [isDemo, deleteTag, trpcDelete]
  );

  return {
    tags: tagList,
    suggestions,
    addTag: addTagFn,
    updateTag: updateTagFn,
    deleteTag: deleteTagFn,
    addPending: !isDemo && trpcAdd.isPending,
    updatePending: !isDemo && trpcUpdate.isPending,
    deletePending: !isDemo && trpcDelete.isPending,
    refetch: isDemo ? () => {} : trpcTags.refetch,
  };
}
