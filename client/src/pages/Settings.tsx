import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Target,
  Sheet,
  Loader2,
  Save,
  ExternalLink,
  LogOut,
  Copy,
  CheckCircle2,
  AlertCircle,
  Info,
  Tag,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();
  const { data: settings, refetch } = trpc.settings.get.useQuery();
  const { data: saInfo } = trpc.sheets.serviceAccountEmail.useQuery();
  const { data: userTags = [], refetch: refetchTags } = trpc.tags.list.useQuery();
  const utils = trpc.useUtils();

  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Settings saved");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const addTagMutation = trpc.tags.add.useMutation({
    onSuccess: () => {
      refetchTags();
      utils.tags.suggestions.invalidate();
      setNewTagName("");
      toast.success("Tag added");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateTagMutation = trpc.tags.update.useMutation({
    onSuccess: () => {
      refetchTags();
      utils.tags.suggestions.invalidate();
      setEditingTagId(null);
      setEditingTagName("");
      toast.success("Tag updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteTagMutation = trpc.tags.delete.useMutation({
    onSuccess: () => {
      refetchTags();
      utils.tags.suggestions.invalidate();
      toast.success("Tag deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const [calorieTarget, setCalorieTarget] = useState("2000");
  const [proteinTarget, setProteinTarget] = useState("150");
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetName, setSheetName] = useState("Sheet1");
  const [copied, setCopied] = useState(false);

  // Tag management state
  const [newTagName, setNewTagName] = useState("");
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editingTagName, setEditingTagName] = useState("");

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

  const handleCopyEmail = () => {
    if (saInfo?.email) {
      navigator.clipboard.writeText(saInfo.email);
      setCopied(true);
      toast.success("Email copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    addTagMutation.mutate({ name });
  };

  const handleUpdateTag = () => {
    if (editingTagId === null || !editingTagName.trim()) return;
    updateTagMutation.mutate({ id: editingTagId, name: editingTagName.trim() });
  };

  const handleDeleteTag = (id: number) => {
    deleteTagMutation.mutate({ id });
  };

  const serviceAccountConfigured = !!saInfo?.email;

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

      {/* Tag Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Manage Tags
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Create and manage tags to categorize your meals. Tags you create here will appear as quick-add options when logging meals.
          </p>

          {/* Add new tag */}
          <div className="flex gap-2">
            <Input
              placeholder="New tag name..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              className="text-sm"
            />
            <Button
              size="sm"
              onClick={handleAddTag}
              disabled={addTagMutation.isPending || !newTagName.trim()}
            >
              {addTagMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>

          {/* Tag list */}
          {userTags.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-xs">
              No tags yet. Add your first tag above.
            </div>
          ) : (
            <div className="space-y-1">
              {userTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors group"
                >
                  {editingTagId === tag.id ? (
                    <>
                      <Input
                        value={editingTagName}
                        onChange={(e) => setEditingTagName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleUpdateTag();
                          }
                          if (e.key === "Escape") {
                            setEditingTagId(null);
                          }
                        }}
                        className="text-sm h-7 flex-1"
                        autoFocus
                      />
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-green-600 hover:text-green-700"
                        onClick={handleUpdateTag}
                        disabled={updateTagMutation.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => setEditingTagId(null)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="inline-flex items-center text-[10px] font-medium bg-orange-100 text-orange-700 rounded-full px-2.5 py-0.5 uppercase tracking-wider">
                        {tag.name}
                      </span>
                      <div className="flex-1" />
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                        onClick={() => {
                          setEditingTagId(tag.id);
                          setEditingTagName(tag.name);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        onClick={() => handleDeleteTag(tag.id)}
                        disabled={deleteTagMutation.isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
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
        <CardContent className="space-y-4">
          {/* Service Account Status */}
          {serviceAccountConfigured ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-green-800">Service Account Connected</p>
                  <p className="text-[11px] text-green-700 mt-0.5">
                    Share your Google Sheet with this email as <strong>Editor</strong>:
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <code className="text-[10px] bg-white border border-green-200 rounded px-2 py-1 text-green-900 truncate block">
                      {saInfo.email}
                    </code>
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 shrink-0 text-green-700 hover:text-green-900"
                      onClick={handleCopyEmail}
                    >
                      {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Service Account Not Configured</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    A Google Cloud service account key is needed to write data to your sheet.
                    Please contact the app administrator to set up the service account credentials.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Sheet URL */}
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

          {/* Setup Instructions */}
          <div className="bg-muted rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs font-semibold text-foreground">How Sync Works</p>
            </div>
            <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Paste your Google Sheets URL above and save</li>
              {serviceAccountConfigured && (
                <li>
                  Share your sheet with <strong className="text-foreground">{saInfo!.email}</strong> as Editor
                </li>
              )}
              <li>On the Dashboard, tap the <strong className="text-foreground">Sync</strong> button to push data</li>
              <li>The app will auto-fill: Date, Day, Calories, Protein, and Meals columns</li>
            </ol>
            <Separator />
            <p className="text-[10px] text-muted-foreground">
              <strong>Meals format:</strong>{" "}
              <code className="bg-background px-1 rounded">Bfast: meal - XXX cal, XXg protein</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
