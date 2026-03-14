import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EditMealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: {
    id: number;
    mealName: string;
    mealType: string;
    calories: string;
    protein: string;
    quantity: string | null;
    servingType: string | null;
    tags: string | null;
  };
  onSuccess: () => void;
}

const servingTypes = ["pieces", "grams", "plates", "cups", "bowls", "slices", "tablespoons", "servings"];

export default function EditMealDialog({ open, onOpenChange, meal, onSuccess }: EditMealDialogProps) {
  const [mealName, setMealName] = useState(meal.mealName);
  const [mealType, setMealType] = useState(meal.mealType);
  const [calories, setCalories] = useState(String(Math.round(Number(meal.calories))));
  const [protein, setProtein] = useState(String(Math.round(Number(meal.protein))));
  const [quantity, setQuantity] = useState(meal.quantity ? String(Number(meal.quantity)) : "");
  const [servingType, setServingType] = useState(meal.servingType || "");
  const [tags, setTags] = useState<string[]>(
    meal.tags ? (meal.tags as string).split(",").filter(Boolean) : []
  );
  const [tagInput, setTagInput] = useState("");

  const updateMeal = trpc.meals.update.useMutation({
    onSuccess: () => {
      toast.success("Meal updated");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = () => {
    if (!mealName.trim()) {
      toast.error("Meal name is required");
      return;
    }
    updateMeal.mutate({
      id: meal.id,
      mealName: mealName.trim(),
      mealType: mealType as "breakfast" | "lunch" | "dinner" | "snack",
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      quantity: quantity ? Number(quantity) : undefined,
      servingType: servingType || undefined,
      tags,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Meal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label htmlFor="edit-name">Meal Name</Label>
            <Input id="edit-name" value={mealName} onChange={(e) => setMealName(e.target.value)} />
          </div>

          <div>
            <Label>Meal Type</Label>
            <Select value={mealType} onValueChange={setMealType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-cal">Calories (kcal)</Label>
              <Input
                id="edit-cal" type="number" inputMode="decimal"
                value={calories} onChange={(e) => setCalories(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-prot">Protein (g)</Label>
              <Input
                id="edit-prot" type="number" inputMode="decimal"
                value={protein} onChange={(e) => setProtein(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-qty">Quantity</Label>
              <Input
                id="edit-qty" type="number" inputMode="decimal"
                value={quantity} onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <Label>Serving Type</Label>
              <Select value={servingType} onValueChange={setServingType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {servingTypes.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <Label>Tags</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="e.g. vegan, high-protein"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag(); }
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-xs font-medium bg-muted text-muted-foreground rounded-full px-2.5 py-0.5"
                  >
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-foreground">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={updateMeal.isPending}>
            {updateMeal.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
