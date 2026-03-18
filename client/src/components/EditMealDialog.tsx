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
import { Loader2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import TagInput from "@/components/TagInput";
import { format } from "date-fns";
import { useDemo } from "@/contexts/DemoContext";

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
    loggedAt: number | string;
  };
  onSuccess: () => void;
  isDemo?: boolean;
}

const servingTypes = ["pieces", "grams", "plates", "cups", "bowls", "slices", "tablespoons", "servings", "ml"];

export default function EditMealDialog({ open, onOpenChange, meal, onSuccess, isDemo = false }: EditMealDialogProps) {
  const [mealName, setMealName] = useState(meal.mealName);
  const [mealType, setMealType] = useState(meal.mealType);
  const [calories, setCalories] = useState(String(Math.round(Number(meal.calories))));
  const [protein, setProtein] = useState(String(Math.round(Number(meal.protein))));
  const [quantity, setQuantity] = useState(meal.quantity ? String(Number(meal.quantity)) : "");
  const [servingType, setServingType] = useState(meal.servingType || "");
  const [tags, setTags] = useState<string[]>(
    meal.tags ? (meal.tags as string).split(",").filter(Boolean) : []
  );

  // Date editing - initialize from loggedAt timestamp
  const loggedAtMs = Number(meal.loggedAt);
  const initialDate = format(new Date(loggedAtMs), "yyyy-MM-dd");
  const initialTime = format(new Date(loggedAtMs), "HH:mm");
  const [logDate, setLogDate] = useState(initialDate);
  const [logTime, setLogTime] = useState(initialTime);

  const { updateMeal: demoUpdateMeal } = useDemo();

  const updateMeal = trpc.meals.update.useMutation({
    onSuccess: () => {
      toast.success("Meal updated");
      onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!mealName.trim()) {
      toast.error("Meal name is required");
      return;
    }

    // Build new loggedAt from date + time inputs
    const newLoggedAt = new Date(`${logDate}T${logTime}:00`).getTime();
    if (isNaN(newLoggedAt)) {
      toast.error("Invalid date or time");
      return;
    }

    if (isDemo) {
      demoUpdateMeal(meal.id, {
        mealName: mealName.trim(),
        mealType: mealType as "breakfast" | "lunch" | "dinner" | "snack",
        calories: String(Number(calories) || 0),
        protein: String(Number(protein) || 0),
        quantity: quantity ? String(Number(quantity)) : null,
        servingType: servingType || null,
        tags: tags.length > 0 ? tags.join(",") : null,
        loggedAt: newLoggedAt,
      });
      toast.success("Meal updated");
      onSuccess();
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
      loggedAt: newLoggedAt,
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

          {/* Date and Time editing */}
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <Label htmlFor="edit-date" className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                Date
              </Label>
              <Input
                id="edit-date"
                type="date"
                className="w-full"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
              />
            </div>
            <div className="min-w-0">
              <Label htmlFor="edit-time">Time</Label>
              <Input
                id="edit-time"
                type="time"
                className="w-full"
                value={logTime}
                onChange={(e) => setLogTime(e.target.value)}
              />
            </div>
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

          <TagInput tags={tags} onTagsChange={setTags} />

          <Button className="w-full" onClick={handleSubmit} disabled={updateMeal.isPending}>
            {updateMeal.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
