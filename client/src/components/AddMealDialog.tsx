import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Camera, Upload, Loader2, Search, BookOpen, PenLine } from "lucide-react";
import TagInput from "@/components/TagInput";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";

interface AddMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealType: MealType;
  loggedAt: number;
  onSuccess: () => void;
}

const servingTypes = ["pieces", "grams", "plates", "cups", "bowls", "slices", "tablespoons", "servings", "ml"];

export default function AddMealDialog({
  open,
  onOpenChange,
  mealType,
  loggedAt,
  onSuccess,
}: AddMealDialogProps) {
  const [tab, setTab] = useState("manual");

  // Manual form state
  const [mealName, setMealName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [quantity, setQuantity] = useState("");
  const [servingType, setServingType] = useState("servings");
  const [addToLibrary, setAddToLibrary] = useState(false);
  const [tags, setTags] = useState<string[]>([]);

  // Photo state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState("image/jpeg");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [photoDescription, setPhotoDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Library search
  const [librarySearch, setLibrarySearch] = useState("");
  const { data: libraryItems = [] } = trpc.library.list.useQuery();

  const filteredLibrary = libraryItems.filter((item) =>
    item.name.toLowerCase().includes(librarySearch.toLowerCase())
  );

  const createMeal = trpc.meals.create.useMutation({
    onSuccess: () => {
      toast.success("Meal logged!");
      resetForm();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const uploadPhoto = trpc.photo.upload.useMutation();
  const analyzePhoto = trpc.photo.analyze.useMutation();

  const resetForm = () => {
    setMealName("");
    setCalories("");
    setProtein("");
    setQuantity("");
    setServingType("servings");
    setAddToLibrary(false);
    setTags([]);
    setPhotoPreview(null);
    setPhotoBase64(null);
    setAnalysisResult(null);
    setPhotoDescription("");
    setAnalyzing(false);
    setTab("manual");
  };

  const handleManualSubmit = () => {
    if (!mealName.trim() || !calories) {
      toast.error("Please fill in meal name and calories");
      return;
    }
    createMeal.mutate({
      mealName: mealName.trim(),
      mealType,
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      quantity: quantity ? parseFloat(quantity) : undefined,
      servingType: servingType || undefined,
      loggedAt,
      addToLibrary,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  const handleLibrarySelect = (item: (typeof libraryItems)[0]) => {
    createMeal.mutate({
      mealName: item.name,
      mealType,
      calories: Number(item.calories),
      protein: Number(item.protein),
      quantity: item.defaultQuantity ? Number(item.defaultQuantity) : undefined,
      servingType: item.defaultServingType ?? undefined,
      loggedAt,
    });
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotoPreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setPhotoBase64(base64);
      setPhotoMime(file.type || "image/jpeg");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const handleAnalyze = async () => {
    if (!photoBase64) return;
    setAnalyzing(true);
    try {
      const { url } = await uploadPhoto.mutateAsync({
        base64: photoBase64,
        mimeType: photoMime,
      });
      const result = await analyzePhoto.mutateAsync({
        imageUrl: url,
        userDescription: photoDescription.trim() || undefined,
      });
      setAnalysisResult({ ...result, photoUrl: url });
    } catch (err: any) {
      toast.error("Failed to analyze photo: " + (err.message || "Unknown error"));
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePhotoSubmit = () => {
    if (!analysisResult) return;
    createMeal.mutate({
      mealName: analysisResult.name,
      mealType,
      calories: analysisResult.calories,
      protein: analysisResult.protein,
      quantity: analysisResult.quantity || undefined,
      servingType: analysisResult.servingType || undefined,
      photoUrl: analysisResult.photoUrl,
      loggedAt,
      addToLibrary,
      tags: tags.length > 0 ? tags : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Add {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="manual" className="text-xs gap-1">
              <PenLine className="h-3.5 w-3.5" /> Manual
            </TabsTrigger>
            <TabsTrigger value="library" className="text-xs gap-1">
              <BookOpen className="h-3.5 w-3.5" /> Library
            </TabsTrigger>
            <TabsTrigger value="photo" className="text-xs gap-1">
              <Camera className="h-3.5 w-3.5" /> Photo
            </TabsTrigger>
          </TabsList>

          {/* Manual Input Tab */}
          <TabsContent value="manual" className="space-y-3 mt-3">
            <div>
              <Label htmlFor="mealName" className="text-xs mb-1">Meal Name</Label>
              <Input
                id="mealName"
                placeholder="e.g. Chicken breast"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="calories" className="text-xs mb-1">Calories (kcal)</Label>
                <Input
                  id="calories" type="number" inputMode="decimal"
                  placeholder="0" value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="protein" className="text-xs mb-1">Protein (g)</Label>
                <Input
                  id="protein" type="number" inputMode="decimal"
                  placeholder="0" value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="quantity" className="text-xs mb-1">Quantity</Label>
                <Input
                  id="quantity" type="number" inputMode="decimal"
                  placeholder="1" value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="servingType" className="text-xs mb-1">Serving Type</Label>
                <Select value={servingType} onValueChange={setServingType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {servingTypes.map((st) => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <TagInput tags={tags} onTagsChange={setTags} />
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="addToLib" className="text-xs">Add to Food Library</Label>
              <Switch id="addToLib" checked={addToLibrary} onCheckedChange={setAddToLibrary} />
            </div>
            <Button onClick={handleManualSubmit} className="w-full" disabled={createMeal.isPending}>
              {createMeal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Log Meal
            </Button>
          </TabsContent>

          {/* Library Tab */}
          <TabsContent value="library" className="space-y-3 mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search your food library..."
                className="pl-9"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredLibrary.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {libraryItems.length === 0
                    ? "Your food library is empty. Log meals and save them to build your library."
                    : "No matching items found."}
                </div>
              ) : (
                filteredLibrary.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleLibrarySelect(item)}
                    className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                        {item.defaultQuantity && item.defaultServingType && (
                          <p className="text-xs text-muted-foreground">
                            {item.defaultQuantity} {item.defaultServingType}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0 space-y-0.5">
                        <p className="text-sm font-semibold" style={{ color: "oklch(0.65 0.18 55)" }}>
                          {Math.round(Number(item.calories))} Cal
                        </p>
                        <p className="text-sm font-semibold" style={{ color: "oklch(0.35 0.1 260)" }}>
                          {Math.round(Number(item.protein))}g Pro
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </TabsContent>

          {/* Photo Tab */}
          <TabsContent value="photo" className="space-y-3 mt-3">
            {!photoPreview ? (
              <div className="space-y-3">
                <div
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Upload a photo of your meal</p>
                  <p className="text-xs text-muted-foreground mt-1">JPG, PNG up to 10MB</p>
                </div>
                <Button
                  variant="outline" className="w-full"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 mr-2" /> Take a Photo
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              </div>
            ) : !analysisResult ? (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={photoPreview} alt="Meal preview" className="w-full h-48 object-cover" />
                </div>
                <div>
                  <Label htmlFor="photoDesc" className="text-xs mb-1">
                    Describe your meal <span className="text-muted-foreground">(optional, helps AI accuracy)</span>
                  </Label>
                  <Input
                    id="photoDesc"
                    placeholder="e.g. Croissant sandwich with egg, cheese, and ham"
                    value={photoDescription}
                    onChange={(e) => setPhotoDescription(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline" className="flex-1"
                    onClick={() => { setPhotoPreview(null); setPhotoBase64(null); setPhotoDescription(""); }}
                  >
                    Retake
                  </Button>
                  <Button className="flex-1" onClick={handleAnalyze} disabled={analyzing}>
                    {analyzing ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyzing...</>
                    ) : (
                      "Analyze Meal"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-border">
                  <img src={photoPreview} alt="Meal preview" className="w-full h-32 object-cover" />
                </div>
                <p className="text-xs text-muted-foreground">{analysisResult.description}</p>

                {/* Single combined meal entry */}
                <div className="bg-muted rounded-lg p-3 space-y-2">
                  <div>
                    <Label className="text-[10px]">Meal Name</Label>
                    <Input
                      value={analysisResult.name}
                      onChange={(e) => setAnalysisResult({ ...analysisResult, name: e.target.value })}
                      className="text-sm font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Calories (kcal)</Label>
                      <Input
                        type="number"
                        value={analysisResult.calories}
                        onChange={(e) => setAnalysisResult({ ...analysisResult, calories: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Protein (g)</Label>
                      <Input
                        type="number"
                        value={analysisResult.protein}
                        onChange={(e) => setAnalysisResult({ ...analysisResult, protein: parseFloat(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>

                <TagInput tags={tags} onTagsChange={setTags} />
                <div className="flex items-center justify-between py-1">
                  <Label className="text-xs">Add to Food Library</Label>
                  <Switch checked={addToLibrary} onCheckedChange={setAddToLibrary} />
                </div>
                <Button onClick={handlePhotoSubmit} className="w-full" disabled={createMeal.isPending}>
                  {createMeal.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Log Meal
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
