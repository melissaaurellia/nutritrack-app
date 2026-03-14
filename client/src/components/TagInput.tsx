import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { X } from "lucide-react";

interface TagInputProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function TagInput({ tags, onTagsChange }: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: allSuggestions = [] } = trpc.tags.suggestions.useQuery();

  // Filter suggestions: match input and exclude already-selected tags
  const filteredSuggestions = inputValue.trim()
    ? allSuggestions.filter(
        (s) =>
          s.includes(inputValue.trim().toLowerCase()) &&
          !tags.includes(s)
      )
    : [];

  // Previously used tags not yet selected
  const recentTags = allSuggestions.filter((s) => !tags.includes(s));

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      onTagsChange([...tags, t]);
    }
    setInputValue("");
    setShowSuggestions(false);
    // Keep focus on input
    inputRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    onTagsChange(tags.filter((t) => t !== tag));
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="space-y-2">
      <Label className="text-xs">Tags</Label>

      {/* Selected tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-[10px] font-medium bg-orange-100 text-orange-700 rounded-full px-2.5 py-0.5 uppercase tracking-wider"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-orange-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input with autocomplete */}
      <div className="relative">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder="Type a tag..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (inputValue.trim()) {
                  addTag(inputValue);
                }
              }
              if (e.key === "," || e.key === "Tab") {
                if (inputValue.trim()) {
                  e.preventDefault();
                  addTag(inputValue);
                }
              }
            }}
            className="text-sm"
          />
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && inputValue.trim() && (
          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-32 overflow-y-auto">
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur
                  addTag(suggestion);
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Previously used tags */}
      {recentTags.length > 0 && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Quick add:</p>
          <div className="flex flex-wrap gap-1">
            {recentTags.slice(0, 10).map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => addTag(tag)}
                className="text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-2.5 py-0.5 uppercase tracking-wider hover:bg-orange-100 hover:text-orange-700 transition-colors"
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
