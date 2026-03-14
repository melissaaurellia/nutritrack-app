import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Flame,
  Trash2,
  Loader2,
  Sheet,
} from "lucide-react";
import { format, startOfDay, endOfDay, addDays, subDays } from "date-fns";
import AddMealDialog from "@/components/AddMealDialog";
import { toast } from "sonner";

const mealTypeConfig = {
  breakfast: { label: "Breakfast", emoji: "☀️" },
  lunch: { label: "Lunch", emoji: "\u{1F957}" },
  dinner: { label: "Dinner", emoji: "\u{1F35D}" },
  snack: { label: "Snack", emoji: "\u{1F34E}" },
} as const;

type MealType = keyof typeof mealTypeConfig;

function DonutChart({
  value,
  target,
  label,
  unit,
  color,
}: {
  value: number;
  target: number;
  label: string;
  unit: string;
  color: string;
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;
  const isOver = value > target;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-muted/40"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={isOver ? "oklch(0.58 0.24 27)" : color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-foreground">{Math.round(value)}</span>
          <span className="text-[10px] text-muted-foreground">/ {target}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{unit}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [addMealOpen, setAddMealOpen] = useState(false);
  const [addMealType, setAddMealType] = useState<MealType>("breakfast");
  const [syncing, setSyncing] = useState(false);

  const dayStart = useMemo(() => startOfDay(selectedDate).getTime(), [selectedDate]);
  const dayEnd = useMemo(() => endOfDay(selectedDate).getTime(), [selectedDate]);

  const { data: settings } = trpc.settings.get.useQuery();
  const { data: meals = [], refetch: refetchMeals } = trpc.meals.listByDate.useQuery({
    startMs: dayStart,
    endMs: dayEnd,
  });

  const deleteMeal = trpc.meals.delete.useMutation({
    onSuccess: () => {
      refetchMeals();
      toast.success("Meal deleted");
    },
  });

  const syncSheets = trpc.sheets.sync.useMutation({
    onSuccess: (data) => {
      toast.success("Sync data prepared! Copy the data below to your Google Sheet.", {
        duration: 5000,
      });
      setSyncing(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setSyncing(false);
    },
  });

  const calorieTarget = settings?.dailyCalorieTarget ?? 2000;
  const proteinTarget = settings?.dailyProteinTarget ?? 150;

  const totalCalories = meals.reduce((sum, m) => sum + Number(m.calories), 0);
  const totalProtein = meals.reduce((sum, m) => sum + Number(m.protein), 0);

  const calorieRemaining = calorieTarget - totalCalories;
  const proteinRemaining = proteinTarget - totalProtein;

  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  // Group meals by type
  const groupedMeals = useMemo(() => {
    const groups: Record<MealType, typeof meals> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const meal of meals) {
      groups[meal.mealType as MealType]?.push(meal);
    }
    return groups;
  }, [meals]);

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

      {/* Progress donuts */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-around">
            <DonutChart
              value={totalCalories}
              target={calorieTarget}
              label="Calories"
              unit="kcal"
              color="oklch(0.72 0.17 55)"
            />
            <DonutChart
              value={totalProtein}
              target={proteinTarget}
              label="Protein"
              unit="grams"
              color="oklch(0.30 0.06 260)"
            />
          </div>
          <div className="flex justify-around mt-4 text-center">
            <div>
              <p className={`text-sm font-semibold ${calorieRemaining < 0 ? "text-destructive" : "text-foreground"}`}>
                {calorieRemaining >= 0 ? `${Math.round(calorieRemaining)} left` : `${Math.round(Math.abs(calorieRemaining))} over`}
              </p>
              <p className="text-[10px] text-muted-foreground">calories</p>
            </div>
            <div>
              <p className={`text-sm font-semibold ${proteinRemaining < 0 ? "text-destructive" : "text-foreground"}`}>
                {proteinRemaining >= 0 ? `${Math.round(proteinRemaining)}g left` : `${Math.round(Math.abs(proteinRemaining))}g over`}
              </p>
              <p className="text-[10px] text-muted-foreground">protein</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meal categories with quick add */}
      <div className="grid grid-cols-4 gap-2">
        {(Object.entries(mealTypeConfig) as [MealType, (typeof mealTypeConfig)[MealType]][]).map(
          ([type, config]) => {
            const typeMeals = groupedMeals[type];
            const typeCals = typeMeals.reduce((s, m) => s + Number(m.calories), 0);
            return (
              <Card
                key={type}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleAddMeal(type)}
              >
                <CardContent className="p-3 text-center">
                  <span className="text-2xl block">{config.emoji}</span>
                  <p className="text-[10px] font-medium text-foreground mt-1">{config.label}</p>
                  {typeCals > 0 && (
                    <p className="text-[10px] text-muted-foreground">{Math.round(typeCals)} cal</p>
                  )}
                  <div className="mt-1.5 h-7 w-7 rounded-full bg-primary flex items-center justify-center mx-auto">
                    <Plus className="h-4 w-4 text-primary-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          }
        )}
      </div>

      {/* Intake log */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-foreground">Intake Log</h3>
          {settings?.googleSheetUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncing || meals.length === 0}
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Sheet className="h-3.5 w-3.5 mr-1" />
              )}
              Sync to Sheets
            </Button>
          )}
        </div>

        {/* Sync result display */}
        {syncSheets.data && (
          <Card className="mb-3 border-green-200 bg-green-50">
            <CardContent className="p-3">
              <p className="text-xs font-semibold text-green-800 mb-2">
                Copy this data to your Google Sheet:
              </p>
              <div className="bg-white rounded p-2 text-xs font-mono space-y-1 border">
                <p><span className="text-muted-foreground">Date:</span> {syncSheets.data.date}</p>
                <p><span className="text-muted-foreground">Day:</span> {syncSheets.data.day}</p>
                <p><span className="text-muted-foreground">Calories:</span> {syncSheets.data.calories}</p>
                <p><span className="text-muted-foreground">Protein:</span> {syncSheets.data.protein}</p>
                <p className="whitespace-pre-wrap"><span className="text-muted-foreground">Meals:</span>{"\n"}{syncSheets.data.meals}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 text-xs"
                onClick={() => {
                  const text = `${syncSheets.data!.date}\t${syncSheets.data!.day}\t\t\t\t${syncSheets.data!.calories}\t${syncSheets.data!.protein}\t\t\t${syncSheets.data!.meals}`;
                  navigator.clipboard.writeText(text);
                  toast.success("Copied to clipboard! Paste into your Google Sheet.");
                }}
              >
                Copy as Tab-Separated Row
              </Button>
            </CardContent>
          </Card>
        )}

        {(Object.entries(mealTypeConfig) as [MealType, (typeof mealTypeConfig)[MealType]][]).map(
          ([type, config]) => {
            const typeMeals = groupedMeals[type];
            if (typeMeals.length === 0) return null;
            const typeCals = typeMeals.reduce((s, m) => s + Number(m.calories), 0);
            return (
              <Card key={type} className="mb-3">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <span>{config.emoji}</span> {config.label}
                    </CardTitle>
                    <div className="flex items-center gap-1 text-primary">
                      <Flame className="h-3.5 w-3.5" />
                      <span className="text-sm font-semibold">{Math.round(typeCals)} Cal</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="divide-y divide-border">
                    {typeMeals.map((meal) => (
                      <div key={meal.id} className="flex items-center justify-between py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {meal.mealName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {meal.quantity && meal.servingType
                              ? `${Number(meal.quantity)} ${meal.servingType}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">
                              {Math.round(Number(meal.calories))} Cal
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {Math.round(Number(meal.protein))}g protein
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMeal.mutate({ id: meal.id });
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          }
        )}
        {meals.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-sm">No meals logged yet today.</p>
              <p className="text-muted-foreground text-xs mt-1">
                Tap a meal category above to start logging.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Add Meal Dialog */}
      <AddMealDialog
        open={addMealOpen}
        onOpenChange={setAddMealOpen}
        mealType={addMealType}
        loggedAt={selectedDate.getTime()}
        onSuccess={() => {
          refetchMeals();
          setAddMealOpen(false);
        }}
      />
    </div>
  );
}
