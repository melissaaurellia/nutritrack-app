import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Trash2, Pencil, BookOpen, Loader2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";

const CAL_COLOR = "oklch(0.72 0.17 55)";
const PROT_COLOR = "oklch(0.55 0.12 260)";

const servingTypes = ["pieces", "grams", "plates", "cups", "bowls", "slices", "tablespoons", "servings", "ml"];

export default function Library() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [qty, setQty] = useState("");
  const [sType, setSType] = useState("servings");

  const { data: items = [], refetch } = trpc.library.list.useQuery();
  const addMutation = trpc.library.add.useMutation({
    onSuccess: () => {
      toast.success("Added to library");
      refetch();
      resetForm();
      setAddOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.library.update.useMutation({
    onSuccess: () => {
      toast.success("Updated");
      refetch();
      resetForm();
      setEditItem(null);
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.library.delete.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      refetch();
    },
  });

  const filteredItems = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setName("");
    setCalories("");
    setProtein("");
    setQty("");
    setSType("servings");
  };

  const openEdit = (item: any) => {
    setEditItem(item);
    setName(item.name);
    setCalories(String(Number(item.calories)));
    setProtein(String(Number(item.protein)));
    setQty(item.defaultQuantity ? String(Number(item.defaultQuantity)) : "");
    setSType(item.defaultServingType || "servings");
  };

  const handleSubmit = () => {
    if (!name.trim() || !calories) {
      toast.error("Please fill in name and calories");
      return;
    }
    const data = {
      name: name.trim(),
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      defaultQuantity: qty ? parseFloat(qty) : undefined,
      defaultServingType: sType || undefined,
    };

    if (editItem) {
      updateMutation.mutate({ id: editItem.id, ...data });
    } else {
      addMutation.mutate(data);
    }
  };

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate({ id: deleteTarget.id });
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Food Library</h1>
        <Button size="sm" onClick={() => { resetForm(); setAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search your library..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="rounded-2xl bg-card py-12 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">
            {items.length === 0
              ? "Your food library is empty. Add items here or save meals when logging."
              : "No matching items found."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl bg-card p-3 flex items-center gap-3 group transition-all hover:shadow-sm"
            >
              {/* Icon — curved rectangle matching dashboard */}
              <div className="w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center">
                <UtensilsCrossed className="h-6 w-6 text-primary/40" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {item.defaultQuantity && item.defaultServingType
                    ? `${Number(item.defaultQuantity)} ${item.defaultServingType}`
                    : "Per serving"}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-bold" style={{ color: CAL_COLOR }}>
                    {Math.round(Number(item.calories))} kcal
                  </span>
                  <span className="text-xs font-bold" style={{ color: PROT_COLOR }}>
                    {Math.round(Number(item.protein))}g protein
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => openEdit(item)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">{deleteTarget?.name}</span> from your library? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add/Edit Dialog */}
      <Dialog
        open={addOpen || !!editItem}
        onOpenChange={(v) => {
          if (!v) {
            setAddOpen(false);
            setEditItem(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Item" : "Add to Library"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1">Name</Label>
              <Input
                placeholder="e.g. Chicken breast"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1">Calories (kcal)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={calories}
                  onChange={(e) => setCalories(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs mb-1">Protein (g)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1">Default Quantity</Label>
                <Input
                  type="number"
                  placeholder="1"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs mb-1">Serving Type</Label>
                <Select value={sType} onValueChange={setSType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {servingTypes.map((st) => (
                      <SelectItem key={st} value={st}>
                        {st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              className="w-full"
              disabled={addMutation.isPending || updateMutation.isPending}
            >
              {(addMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              )}
              {editItem ? "Update" : "Add to Library"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
