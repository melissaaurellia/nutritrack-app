import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Settings,
  Loader2,
  UtensilsCrossed,
  Plus,
  X,
  Coffee,
  Sun,
  Moon,
  Apple,
} from "lucide-react";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: BookOpen, label: "Library", path: "/library" },
  // Placeholder for center + button
  { icon: TrendingUp, label: "Trends", path: "/trends" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const mealTypes: { type: MealType; label: string; emoji: string; Icon: typeof Coffee; color: string; bg: string }[] = [
  { type: "breakfast", label: "Breakfast", emoji: "☀️", Icon: Coffee, color: "text-amber-600", bg: "bg-amber-50" },
  { type: "lunch", label: "Lunch", emoji: "🥗", Icon: Sun, color: "text-green-600", bg: "bg-green-50" },
  { type: "dinner", label: "Dinner", emoji: "🍝", Icon: Moon, color: "text-indigo-600", bg: "bg-indigo-50" },
  { type: "snack", label: "Snack", emoji: "🍎", Icon: Apple, color: "text-red-500", bg: "bg-red-50" },
];

interface AppLayoutProps {
  children: React.ReactNode;
  onAddMeal?: (type: MealType) => void;
}

export default function AppLayout({ children, onAddMeal }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const [showMealPopup, setShowMealPopup] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-6 p-8 max-w-sm w-full text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <UtensilsCrossed className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Welcome</h1>
            <p className="text-muted-foreground text-sm">
              Sign in to start tracking your nutrition goals
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full"
          >
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  const handleMealSelect = (type: MealType) => {
    setShowMealPopup(false);
    if (onAddMeal) {
      onAddMeal(type);
    } else {
      // Navigate to dashboard with meal type in state
      if (location !== "/dashboard") {
        setLocation("/dashboard");
      }
      // Dispatch custom event for Dashboard to pick up
      window.dispatchEvent(new CustomEvent("add-meal", { detail: { type } }));
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content — no top header */}
      <main className="flex-1 pb-24 sm:pb-6">
        <div className="container py-4 sm:py-5">
          {children}
        </div>
      </main>

      {/* ── Bottom Navigation - Mobile ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden">
        {/* Bottom sheet overlay */}
        {showMealPopup && (
          <div
            className="fixed inset-0 bg-black/30 z-40 transition-opacity"
            onClick={() => setShowMealPopup(false)}
          />
        )}

        {/* Bottom sheet — slides up from bottom */}
        <div
          className={`fixed left-0 right-0 z-50 transition-transform duration-300 ease-out ${
            showMealPopup ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ bottom: "64px" }}
        >
          <div className="bg-card rounded-t-3xl shadow-2xl px-5 pt-4 pb-6">
            {/* Drag handle */}
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-foreground">Add Meal</h3>
              <button
                onClick={() => setShowMealPopup(false)}
                className="h-7 w-7 rounded-full bg-muted flex items-center justify-center"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {mealTypes.map((mt) => (
                <button
                  key={mt.type}
                  onClick={() => handleMealSelect(mt.type)}
                  className={`${mt.bg} rounded-2xl p-3 flex flex-col items-center gap-2 transition-all active:scale-95 hover:shadow-sm`}
                >
                  <span className="text-2xl">{mt.emoji}</span>
                  <span className={`text-[11px] font-semibold ${mt.color}`}>{mt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Nav bar */}
        <div className="bg-card/95 backdrop-blur border-t border-border/40">
          <div className="flex items-center justify-around h-16 px-2 relative">
            {/* Left nav items */}
            {navItems.slice(0, 2).map((item) => {
              const isActive = location === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}

            {/* Center + button — elevated circle */}
            <div className="relative -mt-6">
              <button
                onClick={() => setShowMealPopup(!showMealPopup)}
                className={`h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 ${
                  showMealPopup
                    ? "bg-muted-foreground rotate-45"
                    : "bg-primary"
                }`}
              >
                <Plus className={`h-7 w-7 ${showMealPopup ? "text-white" : "text-primary-foreground"}`} />
              </button>
            </div>

            {/* Right nav items */}
            {navItems.slice(2).map((item) => {
              const isActive = location === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => setLocation(item.path)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ── Side Navigation - Desktop ── */}
      <nav className="hidden sm:flex fixed left-0 top-0 bottom-0 w-16 lg:w-48 bg-card/50 flex-col py-6 z-40">
        <div className="flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="hidden lg:block text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop content offset for sidebar */}
      <style>{`
        @media (min-width: 640px) {
          main { margin-left: 4rem; }
        }
        @media (min-width: 1024px) {
          main { margin-left: 12rem; }
        }
      `}</style>
    </div>
  );
}
