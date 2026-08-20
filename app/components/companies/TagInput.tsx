import { useState } from "react";

type Props = {
  /** Form field name for the hidden JSON-encoded array input. */
  name: string;
  defaultValue?: string[];
  placeholder?: string;
  label: string;
};

export function TagInput({
  name,
  defaultValue = [],
  placeholder = "Add item (press Enter)",
  label,
}: Props) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [current, setCurrent] = useState("");

  const add = () => {
    const t = current.trim();
    if (!t) return;
    if (tags.includes(t)) {
      setCurrent("");
      return;
    }
    setTags([...tags, t]);
    setCurrent("");
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white"
        />
        <button
          type="button"
          onClick={add}
          className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {tags.map((t, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2.5 py-1 text-xs"
          >
            {t}
            <button
              type="button"
              onClick={() => setTags(tags.filter((_, idx) => idx !== i))}
              className="text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100"
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
    </div>
  );
}
