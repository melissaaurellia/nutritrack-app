import { useAuth } from "@/_core/hooks/useAuth";
import { useDemo } from "@/contexts/DemoContext";
import { useLocation } from "wouter";
import { useEffect } from "react";
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Settings,
  Loader2,
  Plus,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: BookOpen, label: "Library", path: "/library" },
  // Placeholder for center + button
  { icon: TrendingUp, label: "Trends", path: "/trends" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const { isDemo } = useDemo();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isDemo && !loading && !user) {
      setLocation("/");
    }
  }, [loading, user, isDemo, setLocation]);

  // In demo mode, skip auth loading gate
  if (!isDemo && (loading || !user)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleAddMeal = () => {
    // Navigate to dashboard if not already there
    if (location !== "/dashboard") {
      setLocation("/dashboard");
    }
    // Dispatch event — Dashboard will open AddMealDialog with default type
    window.dispatchEvent(new CustomEvent("add-meal", { detail: { type: "breakfast" } }));
  };

  return (
    <div className={`min-h-screen bg-background flex flex-col ${isDemo ? "pt-9" : ""}`}>
      {/* Main content — no top header */}
      <main className="flex-1 pb-24 sm:pb-6">
        <div className="container py-4 sm:py-5">
          {children}
        </div>
      </main>

      {/* ── Bottom Navigation - Mobile ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden">
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

            {/* Center + button — elevated circle, directly opens AddMealDialog */}
            <div className="relative -mt-6">
              <button
                onClick={handleAddMeal}
                className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-lg transition-all active:scale-95"
              >
                <Plus className="h-7 w-7 text-primary-foreground" />
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
      <nav className={`hidden sm:flex fixed left-0 bottom-0 w-16 lg:w-48 bg-card/50 flex-col py-6 z-40 ${isDemo ? "top-9" : "top-0"}`}>
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
