import { useDemo } from "@/contexts/DemoContext";
import { useLocation } from "wouter";
import { LogIn } from "lucide-react";

export default function DemoBanner() {
  const { isDemo, exitDemo } = useDemo();
  const [, setLocation] = useLocation();

  if (!isDemo) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-amber-500 text-amber-950">
      <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium sm:text-sm">
        <span>You're in demo mode. Data is stored locally.</span>
        <button
          onClick={() => {
            exitDemo();
            setLocation("/");
          }}
          className="inline-flex items-center gap-1 rounded-full bg-amber-950/15 px-3 py-0.5 font-semibold hover:bg-amber-950/25 transition-colors"
        >
          <LogIn className="h-3 w-3" />
          Sign up to save
        </button>
      </div>
    </div>
  );
}
