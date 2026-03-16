import { trpc } from "@/lib/trpc";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SwipeToDelete } from "@/components/SwipeToDelete";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Sheet,
  Coffee,
  Sun,
  Moon,
  Apple,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Copy,
  Zap,
} from "lucide-react";
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
  isToday as isDateToday,
} from "date-fns";
import AddMealDialog from "@/components/AddMealDialog";
import EditMealDialog from "@/components/EditMealDialog";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

/* ─── Constants ───────────────────────────────────────────── */
const CAL_COLOR = "oklch(0.72 0.17 55)";
const PROT_COLOR = "oklch(0.55 0.12 260)";
const GREEN = "oklch(0.55 0.18 145)";
const RED = "oklch(0.55 0.22 27)";

const mealTypeConfig = {
  breakfast: { label: "Breakfast", shortLabel: "BFAST", emoji: "☀️", Icon: Coffee, iconBg: "bg-amber-50 text-amber-600", pastelBg: "bg-gradient-to-br from-amber-50 to-orange-50", borderAccent: "border-l-4 border-l-amber-400" },
  lunch: { label: "Lunch", shortLabel: "LUNCH", emoji: "🥗", Icon: Sun, iconBg: "bg-green-50 text-green-600", pastelBg: "bg-gradient-to-br from-green-50 to-emerald-50", borderAccent: "border-l-4 border-l-green-400" },
  dinner: { label: "Dinner", shortLabel: "DINNER", emoji: "🍝", Icon: Moon, iconBg: "bg-indigo-50 text-indigo-600", pastelBg: "bg-gradient-to-br from-indigo-50 to-violet-50", borderAccent: "border-l-4 border-l-indigo-400" },
  snack: { label: "Snack", shortLabel: "SNACK", emoji: "🍎", Icon: Apple, iconBg: "bg-rose-50 text-rose-500", pastelBg: "bg-gradient-to-br from-rose-50 to-pink-50", borderAccent: "border-l-4 border-l-rose-400" },
} as const;

type MealType = keyof typeof mealTypeConfig;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ─── Weekly Day Selector ─────────────────────────────────── */
function WeekDaySelector({
  selectedDate,
  onSelectDate,
}: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
}) {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";

  return (
    <div className="space-y-3">
      <div>
        <GreetingHeader greeting={greeting} />
        <p className="text-xs text-muted-foreground mt-0.5">
          {format(selectedDate, "EEEE, d MMMM yyyy")}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setWeekStart((w) => subWeeks(w, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1 grid grid-cols-7 gap-1">
          {weekDays.map((day, i) => {
            const isSelected = isSameDay(day, selectedDate);
            const isToday = isDateToday(day);

            return (
              <button
                key={i}
                onClick={() => onSelectDate(day)}
                className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-all"
              >
                <span
                  className={`text-[10px] font-medium ${
                    isSelected
                      ? "text-foreground font-bold"
                      : "text-muted-foreground"
                  }`}
                >
                  {DAY_LABELS[i]}
                </span>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isToday
                      ? "bg-primary/15 text-primary"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  {format(day, "d")}
                </div>
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => setWeekStart((w) => addWeeks(w, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Greeting Header ─────────────────────────────────────── */
function GreetingHeader({ greeting }: { greeting: string }) {
  const { user } = useAuth();
  const name = user?.name?.split(" ")[0] ?? "";
  return (
    <h2 className="text-lg font-bold text-foreground">
      {greeting}{name ? `, ${name}` : ""}
    </h2>
  );
}

/* ─── Donut Chart ─────────────────────────────────────────── */
function DonutChart({
  value,
  target,
  color,
  size = 72,
}: {
  value: number;
  target: number;
  color: string;
  size?: number;
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          stroke={color}
          strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground">{Math.round(value)}</span>
      </div>
    </div>
  );
}

/* ─── Macro Card — donut above text, on-track/off-track ──── */
function MacroCard({
  label,
  value,
  target,
  unit,
  color,
  isOnTrack,
  type,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
  isOnTrack: boolean;
  type: "calories" | "protein";
}) {
  const diff = Math.round(Math.abs(value - target));
  const isOver = value > target;
  const donutColor = isOnTrack ? GREEN : color;

  let statusText: string;
  let statusColor: string;
  let StatusIcon: typeof ArrowUp;

  if (type === "calories") {
    if (value === 0) {
      statusText = `${target} ${unit} remaining`;
      statusColor = "text-muted-foreground";
      StatusIcon = ArrowDown;
    } else if (isOnTrack) {
      statusText = `${Math.round(target - value)} ${unit} remaining`;
      statusColor = "text-green-600";
      StatusIcon = CheckCircle2;
    } else {
      statusText = `${diff} ${unit} over`;
      statusColor = "text-red-500";
      StatusIcon = ArrowUp;
    }
  } else {
    if (value === 0) {
      statusText = `${target}${unit} remaining`;
      statusColor = "text-muted-foreground";
      StatusIcon = ArrowDown;
    } else if (isOnTrack) {
      statusText = isOver ? `${diff}${unit} over target` : "Goal met!";
      statusColor = "text-green-600";
      StatusIcon = CheckCircle2;
    } else {
      statusText = `${diff}${unit} short`;
      statusColor = "text-red-500";
      StatusIcon = ArrowDown;
    }
  }

  return (
    <div className="flex-1 min-w-0 rounded-2xl bg-card p-4 flex flex-col items-center gap-2">
      <DonutChart value={value} target={target} color={donutColor} size={72} />
      <div className="text-center w-full">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-foreground mt-0.5">
          {Math.round(value)} <span className="text-[10px] font-normal text-muted-foreground">/ {target} {unit}</span>
        </p>
        <div className={`flex items-center justify-center gap-1 mt-1 ${statusColor}`}>
          <StatusIcon className="h-3 w-3 shrink-0" />
          <span className="text-[10px] font-semibold">{statusText}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Meal Card — minimalist with curved photo ──────────── */
function MealCard({
  meal,
  onEdit,
  onDelete,
}: {
  meal: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const config = mealTypeConfig[meal.mealType as MealType];
  const tags = meal.tags ? (meal.tags as string).split(",").filter(Boolean) : [];
  const logTime = format(new Date(Number(meal.loggedAt)), "HH:mm");
  const IconComp = config?.Icon ?? Coffee;
  const iconBg = config?.iconBg ?? "bg-muted text-muted-foreground";

  return (
    <div className="rounded-2xl bg-card p-3 flex items-center gap-3 group transition-all hover:shadow-sm">
      {/* Photo or Icon — curved rectangle */}
      <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-muted/30 flex items-center justify-center">
        {meal.photoUrl ? (
          <img
            src={meal.photoUrl}
            alt={meal.mealName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${iconBg}`}>
            <IconComp className="h-6 w-6" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{meal.mealName}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {config?.shortLabel ?? "MEAL"} &bull; {logTime}
        </p>

        {/* Macros */}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs font-bold" style={{ color: CAL_COLOR }}>
            {Math.round(Number(meal.calories))} kcal
          </span>
          <span className="text-xs font-bold" style={{ color: PROT_COLOR }}>
            {Math.round(Number(meal.protein))}g pro
          </span>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-block text-[9px] font-medium bg-primary/10 text-primary rounded-full px-2 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-0.5 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Quick Add Suggestions ──────────────────────────────── */
function QuickAddSuggestions({
  onQuickLog,
  onAddNew,
}: {
  onQuickLog: (suggestion: any) => void;
  onAddNew: () => void;
}) {
  const [currentHour] = useState(() => new Date().getHours());
  const { data: suggestions = [], isLoading } = trpc.meals.suggestions.useQuery({ currentHour });

  const getMealEmoji = (mealType: string) => {
    const map: Record<string, string> = { breakfast: "☀️", lunch: "🥗", dinner: "🍝", snack: "🍎" };
    return map[mealType] || "🍽️";
  };

  const getPastelBg = (mealType: string) => {
    const map: Record<string, string> = {
      breakfast: "bg-gradient-to-br from-amber-50 to-orange-50",
      lunch: "bg-gradient-to-br from-green-50 to-emerald-50",
      dinner: "bg-gradient-to-br from-indigo-50 to-violet-50",
      snack: "bg-gradient-to-br from-rose-50 to-pink-50",
    };
    return map[mealType] || "bg-gradient-to-br from-gray-50 to-slate-50";
  };

  if (isLoading) {
    return (
      <div>
        <h3 className="text-base font-bold text-foreground mb-2">Quick Add</h3>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl h-[72px] bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // If no suggestions yet, show a prompt to log meals
  if (suggestions.length === 0) {
    return (
      <div>
        <h3 className="text-base font-bold text-foreground mb-2">Quick Add</h3>
        <button
          onClick={onAddNew}
          className="w-full rounded-2xl px-4 py-4 bg-gradient-to-br from-primary/5 to-primary/10 border border-dashed border-primary/20 flex items-center justify-center gap-2 transition-all hover:shadow-md active:scale-[0.98]"
        >
          <Plus className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">Log your first meal to get smart suggestions</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-amber-500" />
          Quick Add
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {suggestions.map((s, i) => (
          <button
            key={i}
            className={`rounded-2xl px-3 py-3 flex items-start gap-2.5 transition-all hover:shadow-md active:scale-[0.98] text-left ${getPastelBg(s.mealType)}`}
            onClick={() => onQuickLog(s)}
          >
            {s.photoUrl ? (
              <img
                src={s.photoUrl}
                alt=""
                className="h-10 w-10 rounded-lg object-cover shrink-0"
              />
            ) : (
              <span className="text-lg shrink-0 mt-0.5">{getMealEmoji(s.mealType)}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground leading-tight line-clamp-2">{s.mealName}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                {Math.round(Number(s.calories))} kcal · {Math.round(Number(s.protein))}g pro
              </p>
              {s.frequency > 1 && (
                <p className="text-[9px] text-muted-foreground/70 mt-0.5">
                  Logged {s.frequency}x
                </p>
              )}
            </div>
            <div className="h-6 w-6 rounded-full bg-white/70 flex items-center justify-center shrink-0 mt-0.5">
              <Plus className="h-3 w-3 text-foreground/60" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Dashboard ──────────────────────────────────────── */
export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [addMealType, setAddMealType] = useState<MealType>("breakfast");
  const [editMeal, setEditMeal] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const dayStart = useMemo(() => startOfDay(selectedDate).getTime(), [selectedDate]);
  const dayEnd = useMemo(() => endOfDay(selectedDate).getTime(), [selectedDate]);

  const { data: settings } = trpc.settings.get.useQuery();
  const { data: meals = [], refetch: refetchMeals } = trpc.meals.listByDate.useQuery({
    startMs: dayStart,
    endMs: dayEnd,
  });

  const deleteMeal = trpc.meals.delete.useMutation({
    onSuccess: () => { refetchMeals(); toast.success("Meal deleted"); },
  });

  const quickLogMeal = trpc.meals.create.useMutation({
    onSuccess: () => { refetchMeals(); toast.success("Meal logged!"); },
    onError: (err) => { toast.error(err.message); },
  });

  const syncSheets = trpc.sheets.sync.useMutation({
    onSuccess: (data) => {
      if (data.written) {
        toast.success("Synced to Google Sheets!");
      } else {
        toast.success("Sync data prepared! Copy it to your sheet.");
      }
      setSyncing(false);
    },
    onError: (err) => { toast.error(err.message); setSyncing(false); },
  });

  const calorieTarget = settings?.dailyCalorieTarget ?? 2000;
  const proteinTarget = settings?.dailyProteinTarget ?? 150;
  const totalCalories = meals.reduce((sum, m) => sum + Number(m.calories), 0);
  const totalProtein = meals.reduce((sum, m) => sum + Number(m.protein), 0);

  const calOnTrack = totalCalories <= calorieTarget;
  const protOnTrack = totalProtein >= proteinTarget;

  const sortedMeals = useMemo(
    () => [...meals].sort((a, b) => Number(b.loggedAt) - Number(a.loggedAt)),
    [meals]
  );

  // Listen for add-meal events from the bottom nav + button
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.type) {
        setAddMealType(detail.type);
        setAddMealOpen(true);
      }
    };
    window.addEventListener("add-meal", handler);
    return () => window.removeEventListener("add-meal", handler);
  }, []);

  const handleAddMeal = (type: MealType) => {
    setAddMealType(type);
    setAddMealOpen(true);
  };

  const handleSync = () => {
    if (!settings?.googleSheetUrl) {
      toast.error("Please configure your Google Sheets URL in Settings first.");
      return;
    }
    setSyncing(true);
    syncSheets.mutate({ date: format(selectedDate, "yyyy-MM-dd") });
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMeal.mutate({ id: deleteTarget.id });
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* ── Weekly Day Selector ── */}
      <WeekDaySelector selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {/* ── Calorie & Protein Cards — donut above text ── */}
      <div className="grid grid-cols-2 gap-3">
        <MacroCard
          label="Calories"
          value={totalCalories}
          target={calorieTarget}
          unit="kcal"
          color={CAL_COLOR}
          isOnTrack={calOnTrack}
          type="calories"
        />
        <MacroCard
          label="Protein"
          value={totalProtein}
          target={proteinTarget}
          unit="g"
          color={PROT_COLOR}
          isOnTrack={protOnTrack}
          type="protein"
        />
      </div>

      {/* ── Quick Add — Smart Suggestions ── */}
      <QuickAddSuggestions
        onQuickLog={(suggestion) => {
          quickLogMeal.mutate({
            mealName: suggestion.mealName,
            mealType: suggestion.mealType as MealType,
            calories: Number(suggestion.calories),
            protein: Number(suggestion.protein),
            quantity: suggestion.quantity ? Number(suggestion.quantity) : undefined,
            servingType: suggestion.servingType ?? undefined,
            loggedAt: selectedDate.getTime() || Date.now(),
          });
        }}
        onAddNew={() => handleAddMeal("breakfast")}
      />

      {/* ── Intake Log ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-foreground">Intake Log</h3>
          {settings?.googleSheetUrl && (
            <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing || meals.length === 0} className="text-muted-foreground">
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sheet className="h-3.5 w-3.5 mr-1" />}
              Sync
            </Button>
          )}
        </div>

        {/* Sync result (fallback when API write fails) */}
        {syncSheets.data && !syncSheets.data.written && (
          <div className="mb-3 rounded-2xl bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-800 mb-2">Could not write to sheet directly. Copy this data manually:</p>
            <div className="bg-white rounded-lg p-2 text-xs font-mono space-y-0.5 overflow-x-auto">
              <p><span className="text-muted-foreground">Date:</span> {syncSheets.data.date}</p>
              <p><span className="text-muted-foreground">Day:</span> {syncSheets.data.day}</p>
              <p><span className="text-muted-foreground">Calories:</span> {syncSheets.data.calories}</p>
              <p><span className="text-muted-foreground">Protein:</span> {syncSheets.data.protein}</p>
              <p className="whitespace-pre-wrap break-words"><span className="text-muted-foreground">Meals:</span>{"\n"}{syncSheets.data.meals}</p>
            </div>
            <Button
              size="sm" variant="ghost" className="mt-2 text-xs"
              onClick={() => {
                const text = `${syncSheets.data!.date}\t${syncSheets.data!.day}\t\t\t\t${syncSheets.data!.calories}\t${syncSheets.data!.protein}\t\t\t${syncSheets.data!.meals}`;
                navigator.clipboard.writeText(text);
                toast.success("Copied to clipboard!");
              }}
            >
              <Copy className="h-3 w-3 mr-1" /> Copy as Tab-Separated Row
            </Button>
          </div>
        )}

        {/* Success message when written to sheet */}
        {syncSheets.data?.written && (
          <div className="mb-3 rounded-2xl bg-green-50 p-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-xs font-semibold text-green-800">
              Data synced to Google Sheets!
            </p>
          </div>
        )}

        {/* Meal cards — minimalist with curved photos */}
        <div className="space-y-2">
          {sortedMeals.map((meal) => (
            <SwipeToDelete
              key={meal.id}
              onDelete={() => deleteMeal.mutate({ id: meal.id })}
            >
              <MealCard
                meal={meal}
                onEdit={() => setEditMeal(meal)}
                onDelete={() => setDeleteTarget({ id: meal.id, name: meal.mealName })}
              />
            </SwipeToDelete>
          ))}
        </div>

        {meals.length === 0 && (
          <div className="rounded-2xl bg-card py-10 text-center">
            <p className="text-muted-foreground text-sm">No meals logged yet.</p>
            <p className="text-muted-foreground text-xs mt-1">Tap the + button or a meal category to start.</p>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete meal?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget?.name}</span>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialogs */}
      <AddMealDialog
        open={addMealOpen}
        onOpenChange={setAddMealOpen}
        mealType={addMealType}
        loggedAt={selectedDate.getTime()}
        onSuccess={() => { refetchMeals(); setAddMealOpen(false); }}
      />
      {editMeal && (
        <EditMealDialog
          open={!!editMeal}
          onOpenChange={(v) => { if (!v) setEditMeal(null); }}
          meal={editMeal}
          onSuccess={() => { refetchMeals(); setEditMeal(null); }}
        />
      )}
    </div>
  );
}
