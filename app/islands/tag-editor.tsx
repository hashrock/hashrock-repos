import { useState } from "hono/jsx";

interface Props {
  repoId: number;
  initialTags: string[];
  onTagsChange?: (repoId: number, tags: string[]) => void;
}

export default function TagEditor({ repoId, initialTags, onTagsChange }: Props) {
  const [tagsState, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const saveTags = async (newTags: string[]) => {
    setSaving(true);
    try {
      await fetch(`/api/repos/${repoId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: newTags }),
      });
    } finally {
      setSaving(false);
    }
  };

  const addTag = async () => {
    const tag = input.trim().toLowerCase();
    if (!tag || tagsState.includes(tag)) {
      setInput("");
      return;
    }
    const newTags = [...tagsState, tag];
    setTags(newTags);
    setInput("");
    onTagsChange?.(repoId, newTags);
    await saveTags(newTags);
  };

  const removeTag = async (tag: string) => {
    const newTags = tagsState.filter((t) => t !== tag);
    setTags(newTags);
    onTagsChange?.(repoId, newTags);
    await saveTags(newTags);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div class="flex gap-1 mt-2 flex-wrap items-center">
      {tagsState.map((tag) => (
        <span
          key={tag}
          class="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            class="ml-0.5 text-blue-400 hover:text-blue-700 cursor-pointer"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onInput={(e) => setInput((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
        placeholder="+ tag"
        class="text-xs px-2 py-0.5 border rounded w-20 outline-none focus:border-blue-400"
      />
      {saving && <span class="text-xs text-gray-400">saving...</span>}
    </div>
  );
}
