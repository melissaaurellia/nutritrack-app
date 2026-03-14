import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Target, Sheet, Loader2, Save, ExternalLink, LogOut } from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();
  const { data: settings, refetch } = trpc.settings.get.useQuery();
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const [calorieTarget, setCalorieTarget] = useState("2000");
  const [proteinTarget, setProteinTarget] = useState("150");
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");

  useEffect(() => {
    if (settings) {
      setCalorieTarget(String(settings.dailyCalorieTarget));
      setProteinTarget(String(settings.dailyProteinTarget));
      setSheetUrl(settings.googleSheetUrl || "");
      setSheetName(settings.googleSheetName || "Sheet1");
    }
  }, [settings]);

  const handleSaveTargets = () => {
    const cal = parseInt(calorieTarget);
    const prot = parseInt(proteinTarget);
    if (isNaN(cal) || isNaN(prot) || cal < 0 || prot < 0) {
      toast.error("Please enter valid numbers");
      return;
    }
    updateSettings.mutate({
      dailyCalorieTarget: cal,
      dailyProteinTarget: prot,
    });
  };

  const handleSaveSheets = () => {
    // Extract sheet ID from URL
    let sheetId: string | null = null;
    if (sheetUrl) {
      const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        toast.error("Invalid Google Sheets URL. Please paste the full URL from your browser.");
        return;
      }
      sheetId = match[1];
    }

    updateSettings.mutate({
      googleSheetUrl: sheetUrl || null,
      googleSheetId: sheetId,
      googleSheetName: sheetName || "Sheet1",
    });
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-foreground">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{user?.name || "User"}</p>
              <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-3.5 w-3.5 mr-1" /> Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Daily Targets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Daily Targets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs mb-1">Calorie Target (kcal)</Label>
              <Input
                type="number"
                value={calorieTarget}
                onChange={(e) => setCalorieTarget(e.target.value)}
                placeholder="2000"
              />
            </div>
            <div>
              <Label className="text-xs mb-1">Protein Target (g)</Label>
              <Input
                type="number"
                value={proteinTarget}
                onChange={(e) => setProteinTarget(e.target.value)}
                placeholder="150"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleSaveTargets}
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Save Targets
          </Button>
        </CardContent>
      </Card>

      {/* Google Sheets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sheet className="h-4 w-4 text-green-600" />
            Google Sheets Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Paste your Google Sheets URL to sync your daily meal data. The sheet must be shared
            with "Anyone with the link" as Editor.
          </p>
          <div>
            <Label className="text-xs mb-1">Google Sheets URL</Label>
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs mb-1">Sheet Tab Name</Label>
            <Input
              placeholder="Sheet1"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSaveSheets}
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              Save Sheet Config
            </Button>
            {sheetUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(sheetUrl, "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open Sheet
              </Button>
            )}
          </div>
          <Separator />
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs font-medium text-foreground mb-1">Sync Format</p>
            <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
              Date | Day | Calories (kcal) | Protein (g) | Meals
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Meals column format: <code className="bg-background px-1 rounded">Bfast: meal - XXX cal, XXg protein</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
