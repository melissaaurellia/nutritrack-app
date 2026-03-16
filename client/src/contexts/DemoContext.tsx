import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

/* ─── Types ──────────────────────────────────────────────── */
export interface DemoMeal {
  id: number;
  mealName: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  calories: string;
  protein: string;
  quantity: string | null;
  servingType: string | null;
  photoUrl: string | null;
  tags: string | null;
  loggedAt: number; // UTC ms
}

export interface DemoLibraryItem {
  id: number;
  name: string;
  calories: string;
  protein: string;
  defaultQuantity: string | null;
  defaultServingType: string | null;
}

export interface DemoSettings {
  dailyCalorieTarget: number;
  dailyProteinTarget: number;
  googleSheetUrl: string | null;
  googleSheetId: string | null;
  googleSheetName: string | null;
}

export interface DemoTag {
  id: number;
  name: string;
}

interface DemoContextValue {
  isDemo: boolean;
  enterDemo: () => void;
  exitDemo: () => void;

  // Meals
  meals: DemoMeal[];
  addMeal: (meal: Omit<DemoMeal, "id">) => DemoMeal;
  updateMeal: (id: number, data: Partial<DemoMeal>) => void;
  deleteMeal: (id: number) => void;
  getMealsByDate: (startMs: number, endMs: number) => DemoMeal[];
  getMealsByDateRange: (startMs: number, endMs: number) => DemoMeal[];

  // Library
  libraryItems: DemoLibraryItem[];
  addLibraryItem: (item: Omit<DemoLibraryItem, "id">) => DemoLibraryItem;
  updateLibraryItem: (id: number, data: Partial<DemoLibraryItem>) => void;
  deleteLibraryItem: (id: number) => void;

  // Settings
  settings: DemoSettings;
  updateSettings: (data: Partial<DemoSettings>) => void;

  // Tags
  tags: DemoTag[];
  addTag: (name: string) => DemoTag;
  updateTag: (id: number, name: string) => void;
  deleteTag: (id: number) => void;

  // Export all data for migration
  exportData: () => {
    meals: DemoMeal[];
    libraryItems: DemoLibraryItem[];
    settings: DemoSettings;
    tags: DemoTag[];
  };
  clearDemoData: () => void;
}

/* ─── Storage keys ───────────────────────────────────────── */
const DEMO_MODE_KEY = "nutritrack_demo_mode";
const DEMO_MEALS_KEY = "nutritrack_demo_meals";
const DEMO_LIBRARY_KEY = "nutritrack_demo_library";
const DEMO_SETTINGS_KEY = "nutritrack_demo_settings";
const DEMO_TAGS_KEY = "nutritrack_demo_tags";
const DEMO_NEXT_ID_KEY = "nutritrack_demo_next_id";

/* ─── Helpers ────────────────────────────────────────────── */
function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getNextId(): number {
  const id = loadJSON<number>(DEMO_NEXT_ID_KEY, 1);
  saveJSON(DEMO_NEXT_ID_KEY, id + 1);
  return id;
}

const DEFAULT_SETTINGS: DemoSettings = {
  dailyCalorieTarget: 2000,
  dailyProteinTarget: 150,
  googleSheetUrl: null,
  googleSheetId: null,
  googleSheetName: null,
};

/* ─── Context ────────────────────────────────────────────── */
const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(() => loadJSON<boolean>(DEMO_MODE_KEY, false));
  const [meals, setMeals] = useState<DemoMeal[]>(() => loadJSON(DEMO_MEALS_KEY, []));
  const [libraryItems, setLibraryItems] = useState<DemoLibraryItem[]>(() => loadJSON(DEMO_LIBRARY_KEY, []));
  const [settings, setSettings] = useState<DemoSettings>(() => loadJSON(DEMO_SETTINGS_KEY, DEFAULT_SETTINGS));
  const [tags, setTags] = useState<DemoTag[]>(() => loadJSON(DEMO_TAGS_KEY, []));

  // Persist to localStorage on changes
  useEffect(() => { saveJSON(DEMO_MODE_KEY, isDemo); }, [isDemo]);
  useEffect(() => { saveJSON(DEMO_MEALS_KEY, meals); }, [meals]);
  useEffect(() => { saveJSON(DEMO_LIBRARY_KEY, libraryItems); }, [libraryItems]);
  useEffect(() => { saveJSON(DEMO_SETTINGS_KEY, settings); }, [settings]);
  useEffect(() => { saveJSON(DEMO_TAGS_KEY, tags); }, [tags]);

  const enterDemo = useCallback(() => setIsDemo(true), []);
  const exitDemo = useCallback(() => setIsDemo(false), []);

  // ── Meals ──
  const addMeal = useCallback((meal: Omit<DemoMeal, "id">) => {
    const newMeal = { ...meal, id: getNextId() };
    setMeals((prev) => [...prev, newMeal]);
    return newMeal;
  }, []);

  const updateMeal = useCallback((id: number, data: Partial<DemoMeal>) => {
    setMeals((prev) => prev.map((m) => (m.id === id ? { ...m, ...data } : m)));
  }, []);

  const deleteMeal = useCallback((id: number) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const getMealsByDate = useCallback(
    (startMs: number, endMs: number) =>
      meals.filter((m) => m.loggedAt >= startMs && m.loggedAt <= endMs),
    [meals]
  );

  const getMealsByDateRange = useCallback(
    (startMs: number, endMs: number) =>
      meals.filter((m) => m.loggedAt >= startMs && m.loggedAt <= endMs),
    [meals]
  );

  // ── Library ──
  const addLibraryItem = useCallback((item: Omit<DemoLibraryItem, "id">) => {
    const newItem = { ...item, id: getNextId() };
    setLibraryItems((prev) => [...prev, newItem]);
    return newItem;
  }, []);

  const updateLibraryItem = useCallback((id: number, data: Partial<DemoLibraryItem>) => {
    setLibraryItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...data } : i)));
  }, []);

  const deleteLibraryItem = useCallback((id: number) => {
    setLibraryItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // ── Settings ──
  const updateSettingsFn = useCallback((data: Partial<DemoSettings>) => {
    setSettings((prev) => ({ ...prev, ...data }));
  }, []);

  // ── Tags ──
  const addTag = useCallback((name: string) => {
    const newTag = { id: getNextId(), name };
    setTags((prev) => [...prev, newTag]);
    return newTag;
  }, []);

  const updateTag = useCallback((id: number, name: string) => {
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
  }, []);

  const deleteTag = useCallback((id: number) => {
    setTags((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Export & Clear ──
  const exportData = useCallback(
    () => ({ meals, libraryItems, settings, tags }),
    [meals, libraryItems, settings, tags]
  );

  const clearDemoData = useCallback(() => {
    setMeals([]);
    setLibraryItems([]);
    setSettings(DEFAULT_SETTINGS);
    setTags([]);
    setIsDemo(false);
    localStorage.removeItem(DEMO_MEALS_KEY);
    localStorage.removeItem(DEMO_LIBRARY_KEY);
    localStorage.removeItem(DEMO_SETTINGS_KEY);
    localStorage.removeItem(DEMO_TAGS_KEY);
    localStorage.removeItem(DEMO_NEXT_ID_KEY);
    localStorage.removeItem(DEMO_MODE_KEY);
  }, []);

  return (
    <DemoContext.Provider
      value={{
        isDemo,
        enterDemo,
        exitDemo,
        meals,
        addMeal,
        updateMeal,
        deleteMeal,
        getMealsByDate,
        getMealsByDateRange,
        libraryItems,
        addLibraryItem,
        updateLibraryItem,
        deleteLibraryItem,
        settings,
        updateSettings: updateSettingsFn,
        tags,
        addTag,
        updateTag,
        deleteTag,
        exportData,
        clearDemoData,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used within DemoProvider");
  return ctx;
}
