import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Sheet,
  Coffee,
  Sun,
  Moon,
  Apple,
} from "lucide-react";
import { format, startOfDay, endOfDay, addDays, subDays } from "date-fns";
import AddMealDialog from "@/components/AddMealDialog";
import EditMealDialog from "@/components/EditMealDialog";
import { toast } from "sonner";

// Colors matching the donut charts
const CAL_COLOR = "oklch(0.72 0.17 55)"; // warm orange
const PROT_COLOR = "oklch(0.30 0.06 260)"; // navy

const mealTypeConfig = {
  breakfast: { label: "Breakfast", shortLabel: "BFAST", emoji: "\u2600\ufe0f", Icon: Coffee, iconBg: "bg-amber-100 text-amber-600" },
  lunch: { label: "Lunch", shortLabel: "LUNCH", emoji: "\u{1F957}", Icon: Sun, iconBg: "bg-green-100 text-green-600" },
  dinner: { label: "Dinner", shortLabel: "DINNER", emoji: "\u{1F35D}", Icon: Moon, iconBg: "bg-indigo-100 text-indigo-600" },
  snack: { label: "Snack", shortLabel: "SNACK", emoji: "\u{1F34E}", Icon: Apple, iconBg: "bg-red-100 text-red-600" },
} as const;

type MealType = keyof typeof mealTypeConfig;

/* ─── Donut Chart ──────────────────────────────────────────── */
function DonutChart({
  value,
  target,
  color,
  size = 80,
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
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="7" />
        <circle
          cx="40" cy="40" r={radius} fill="none"
          stroke={color}
          strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-bold text-foreground">{Math.round(value)}</span>
      </div>
    </div>
  );
}

/* ─── Macro Card ───────────────────────────────────────────── */
function MacroCard({
  label,
  value,
  target,
  unit,
  color,
  isGood,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
  isGood: boolean;
}) {
  const remaining = target - value;
  return (
    <Card className={`flex-1 transition-all ${isGood ? "ring-2 ring-green-400/60 bg-green-50/40" : ""}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <DonutChart value={value} target={target} color={isGood ? "oklch(0.60 0.19 145)" : color} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {Math.round(value)} <span className="text-xs font-normal text-muted-foreground">/ {target} {unit}</span>
          </p>
          {isGood ? (
            <p className="text-xs font-semibold text-green-600 mt-0.5">On track!</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              {remaining >= 0 ? `${Math.round(remaining)} ${unit} left` : `${Math.round(Math.abs(remaining))} ${unit} over`}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Meal Icon ────────────────────────────────────────────── */
function MealIcon({ meal }: { meal: any }) {
  if (meal.photoUrl) {
    return (
      <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-border">
        <img src={meal.photoUrl} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  const config = mealTypeConfig[meal.mealType as MealType];
  const IconComp = config?.Icon ?? Coffee;
  const iconBg = config?.iconBg ?? "bg-muted text-muted-foreground";
  return (
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
      <IconComp className="h-5 w-5" />
    </div>
  );
}

/* ─── Main Dashboard ───────────────────────────────────────── */
export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [addMealType, setAddMealType] = useState<MealType>("breakfast");
  const [editMeal, setEditMeal] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

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

  const syncSheets = trpc.sheets.sync.useMutation({
    onSuccess: () => { toast.success("Sync data prepared!"); setSyncing(false); },
    onError: (err) => { toast.error(err.message); setSyncing(false); },
  });

  const calorieTarget = settings?.dailyCalorieTarget ?? 2000;
  const proteinTarget = settings?.dailyProteinTarget ?? 150;
  const totalCalories = meals.reduce((sum, m) => sum + Number(m.calories), 0);
  const totalProtein = meals.reduce((sum, m) => sum + Number(m.protein), 0);

  const calOnTrack = totalCalories <= calorieTarget && totalCalories > 0;
  const protOnTrack = totalProtein >= proteinTarget;

  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  // Sort meals: newest first
  const sortedMeals = useMemo(
    () => [...meals].sort((a, b) => Number(b.loggedAt) - Number(a.loggedAt)),
    [meals]
  );

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

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Date navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d) => subDays(d, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">
            {isToday ? "Today" : format(selectedDate, "EEEE")}
          </h2>
          <p className="text-xs text-muted-foreground">{format(selectedDate, "MMMM d, yyyy")}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSelectedDate((d) => addDays(d, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* ── Separate Calorie & Protein Cards ── */}
      <div className="flex gap-3">
        <MacroCard
          label="Calories"
          value={totalCalories}
          target={calorieTarget}
          unit="kcal"
          color={CAL_COLOR}
          isGood={calOnTrack}
        />
        <MacroCard
          label="Protein"
          value={totalProtein}
          target={proteinTarget}
          unit="g"
          color={PROT_COLOR}
          isGood={protOnTrack}
        />
      </div>

      {/* ── 2×2 Meal Category Grid ── */}
      <div className="grid grid-cols-2 gap-2">
        {(Object.entries(mealTypeConfig) as [MealType, (typeof mealTypeConfig)[MealType]][]).map(
          ([type, config]) => (
            <Card
              key={type}
              className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
              onClick={() => handleAddMeal(type)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <span className="text-2xl">{config.emoji}</span>
                <span className="text-sm font-semibold text-foreground flex-1">{config.label}</span>
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <Plus className="h-4 w-4 text-primary-foreground" />
                </div>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* ── Intake Log ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-foreground">Intake Log</h3>
          {settings?.googleSheetUrl && (
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing || meals.length === 0}>
              {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sheet className="h-3.5 w-3.5 mr-1" />}
              Sync
            </Button>
          )}
        </div>

        {/* Sync result */}
        {syncSheets.data && (
          <Card className="mb-3 border-green-200 bg-green-50">
            <CardContent className="p-3">
              <p className="text-xs font-semibold text-green-800 mb-2">Copy this to your Google Sheet:</p>
              <div className="bg-white rounded p-2 text-xs font-mono space-y-0.5 border">
                <p><span className="text-muted-foreground">Date:</span> {syncSheets.data.date}</p>
                <p><span className="text-muted-foreground">Day:</span> {syncSheets.data.day}</p>
                <p><span className="text-muted-foreground">Calories:</span> {syncSheets.data.calories}</p>
                <p><span className="text-muted-foreground">Protein:</span> {syncSheets.data.protein}</p>
                <p className="whitespace-pre-wrap"><span className="text-muted-foreground">Meals:</span>{"\n"}{syncSheets.data.meals}</p>
              </div>
              <Button
                size="sm" variant="outline" className="mt-2 text-xs"
                onClick={() => {
                  const text = `${syncSheets.data!.date}\t${syncSheets.data!.day}\t\t\t\t${syncSheets.data!.calories}\t${syncSheets.data!.protein}\t\t\t${syncSheets.data!.meals}`;
                  navigator.clipboard.writeText(text);
                  toast.success("Copied to clipboard!");
                }}
              >
                Copy as Tab-Separated Row
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Meal cards */}
        <div className="space-y-2">
          {sortedMeals.map((meal) => {
            const config = mealTypeConfig[meal.mealType as MealType];
            const tags = meal.tags ? (meal.tags as string).split(",").filter(Boolean) : [];
            const logTime = format(new Date(Number(meal.loggedAt)), "HH:mm");

            return (
              <Card key={meal.id} className="overflow-hidden">
                <CardContent className="p-3 flex items-start gap-3">
                  {/* Photo or icon */}
                  <MealIcon meal={meal} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{meal.mealName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {config?.shortLabel}
                      </span>
                      <span className="text-[10px] text-muted-foreground">&bull;</span>
                      <span className="text-[10px] font-semibold" style={{ color: CAL_COLOR }}>
                        {Math.round(Number(meal.calories))} KCAL
                      </span>
                      <span className="text-[10px] text-muted-foreground">&bull;</span>
                      <span className="text-[10px] font-semibold" style={{ color: PROT_COLOR }}>
                        {Math.round(Number(meal.protein))}G PROTEIN
                      </span>
                      <span className="text-[10px] text-muted-foreground">&bull;</span>
                      <span className="text-[10px] text-muted-foreground">{logTime}</span>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-block text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5 uppercase tracking-wider"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setEditMeal(meal)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMeal.mutate({ id: meal.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {meals.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground text-sm">No meals logged yet.</p>
              <p className="text-muted-foreground text-xs mt-1">Tap a meal category above to start.</p>
            </CardContent>
          </Card>
        )}
      </div>

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
