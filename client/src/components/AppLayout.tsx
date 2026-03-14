import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Settings,
  LogOut,
  Loader2,
  UtensilsCrossed,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: BookOpen, label: "Library", path: "/library" },
  { icon: TrendingUp, label: "Trends", path: "/trends" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const [location, setLocation] = useLocation();

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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Minimal top header - no app title */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur">
        <div className="container flex items-center justify-end h-12">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {user.name || user.email}
            </span>
            <Button variant="ghost" size="icon" onClick={logout} title="Sign out" className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 sm:pb-6">
        <div className="container py-3 sm:py-5">
          {children}
        </div>
      </main>

      {/* Bottom navigation - mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur sm:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
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
      </nav>

      {/* Side navigation - desktop */}
      <nav className="hidden sm:flex fixed left-0 top-12 bottom-0 w-16 lg:w-48 bg-card/50 flex-col py-4 z-40">
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
