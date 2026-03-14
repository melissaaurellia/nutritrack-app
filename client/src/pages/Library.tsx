import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Trash2, Pencil, BookOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

const servingTypes = ["pieces", "grams", "plates", "cups", "bowls", "slices", "tablespoons", "servings", "ml"];

export default function Library() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

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
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {items.length === 0
                ? "Your food library is empty. Add items here or save meals when logging."
                : "No matching items found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.defaultQuantity && item.defaultServingType
                        ? `${Number(item.defaultQuantity)} ${item.defaultServingType}`
                        : "No default serving"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <div className="text-right mr-2">
                      <p className="text-sm font-semibold">{Math.round(Number(item.calories))} Cal</p>
                      <p className="text-[10px] text-muted-foreground">
                        {Math.round(Number(item.protein))}g protein
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: item.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
