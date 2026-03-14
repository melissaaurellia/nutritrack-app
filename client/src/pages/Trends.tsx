import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { TrendingUp, Flame, Beef } from "lucide-react";

type TimeRange = "7" | "14" | "30" | "90";

export default function Trends() {
  const [range, setRange] = useState<TimeRange>("14");
  const days = parseInt(range);

  const startMs = useMemo(() => startOfDay(subDays(new Date(), days - 1)).getTime(), [days]);
  const endMs = useMemo(() => endOfDay(new Date()).getTime(), []);

  const { data: meals = [] } = trpc.meals.listByDateRange.useQuery({ startMs, endMs });
  const { data: settings } = trpc.settings.get.useQuery();

  const calorieTarget = settings?.dailyCalorieTarget ?? 2000;
  const proteinTarget = settings?.dailyProteinTarget ?? 150;

  // Aggregate meals by day
  const chartData = useMemo(() => {
    const dayMap: Record<string, { calories: number; protein: number }> = {};

    // Initialize all days
    for (let i = 0; i < days; i++) {
      const d = subDays(new Date(), days - 1 - i);
      const key = format(d, "yyyy-MM-dd");
      dayMap[key] = { calories: 0, protein: 0 };
    }

    // Sum meals
    for (const meal of meals) {
      const d = new Date(Number(meal.loggedAt));
      const key = format(d, "yyyy-MM-dd");
      if (dayMap[key]) {
        dayMap[key].calories += Number(meal.calories);
        dayMap[key].protein += Number(meal.protein);
      }
    }

    return Object.entries(dayMap).map(([date, data]) => ({
      date,
      label: format(new Date(date), days <= 14 ? "EEE d" : "MMM d"),
      calories: Math.round(data.calories),
      protein: Math.round(data.protein),
    }));
  }, [meals, days]);

  // Stats
  const avgCalories = chartData.length
    ? Math.round(chartData.reduce((s, d) => s + d.calories, 0) / chartData.length)
    : 0;
  const avgProtein = chartData.length
    ? Math.round(chartData.reduce((s, d) => s + d.protein, 0) / chartData.length)
    : 0;
  const daysOnTarget = chartData.filter((d) => d.calories <= calorieTarget && d.calories > 0).length;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Trends
        </h1>
        <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="14">14 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <Flame className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{avgCalories}</p>
            <p className="text-[10px] text-muted-foreground">Avg Cal/day</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Beef className="h-4 w-4 text-brand-navy mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{avgProtein}g</p>
            <p className="text-[10px] text-muted-foreground">Avg Protein/day</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="h-4 w-4 text-green-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{daysOnTarget}</p>
            <p className="text-[10px] text-muted-foreground">Days on target</p>
          </CardContent>
        </Card>
      </div>

      {/* Calories chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Calories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 80)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "oklch(0.50 0.03 260)" }}
                  interval={days <= 14 ? 0 : "preserveStartEnd"}
                  angle={days > 14 ? -45 : 0}
                  textAnchor={days > 14 ? "end" : "middle"}
                  height={days > 14 ? 50 : 30}
                />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.50 0.03 260)" }} width={45} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid oklch(0.91 0.01 80)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <ReferenceLine
                  y={calorieTarget}
                  stroke="oklch(0.58 0.24 27)"
                  strokeDasharray="5 5"
                  label={{ value: "Target", fontSize: 10, fill: "oklch(0.58 0.24 27)" }}
                />
                <Line
                  type="monotone"
                  dataKey="calories"
                  stroke="oklch(0.72 0.17 55)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "oklch(0.72 0.17 55)" }}
                  activeDot={{ r: 5 }}
                  name="Calories"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Protein chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Protein</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.91 0.01 80)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "oklch(0.50 0.03 260)" }}
                  interval={days <= 14 ? 0 : "preserveStartEnd"}
                  angle={days > 14 ? -45 : 0}
                  textAnchor={days > 14 ? "end" : "middle"}
                  height={days > 14 ? 50 : 30}
                />
                <YAxis tick={{ fontSize: 10, fill: "oklch(0.50 0.03 260)" }} width={45} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid oklch(0.91 0.01 80)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <ReferenceLine
                  y={proteinTarget}
                  stroke="oklch(0.58 0.24 27)"
                  strokeDasharray="5 5"
                  label={{ value: "Target", fontSize: 10, fill: "oklch(0.58 0.24 27)" }}
                />
                <Line
                  type="monotone"
                  dataKey="protein"
                  stroke="oklch(0.30 0.06 260)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "oklch(0.30 0.06 260)" }}
                  activeDot={{ r: 5 }}
                  name="Protein (g)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
