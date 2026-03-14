import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { UtensilsCrossed, Camera, BookOpen, TrendingUp, Target } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [loading, isAuthenticated, setLocation]);

  if (loading) return null;

  const features = [
    { icon: Target, title: "Set Daily Targets", desc: "Configure calorie and protein goals" },
    { icon: Camera, title: "AI Photo Analysis", desc: "Snap a photo to estimate nutrition" },
    { icon: BookOpen, title: "Food Library", desc: "Build your personal food database" },
    { icon: TrendingUp, title: "Track Progress", desc: "View trends over time" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-lg mx-auto py-16 px-4 flex flex-col items-center text-center">
        <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-6">
          <UtensilsCrossed className="h-10 w-10 text-primary" />
        </div>

        <h1 className="text-3xl font-extrabold text-foreground mb-2">NutriTrack</h1>
        <p className="text-muted-foreground mb-10 max-w-xs">
          Track your daily calorie and protein intake to stay on top of your nutrition goals.
        </p>

        <div className="grid grid-cols-2 gap-3 w-full mb-10">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-card rounded-xl p-4 border border-border text-left"
            >
              <f.icon className="h-5 w-5 text-primary mb-2" />
              <h3 className="text-sm font-semibold text-foreground">{f.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>

        <Button
          onClick={() => { window.location.href = getLoginUrl(); }}
          size="lg"
          className="w-full max-w-xs text-base font-semibold"
        >
          Get Started
        </Button>
      </div>
    </div>
  );
}
