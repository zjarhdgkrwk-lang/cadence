import type { Tag } from "../../lib/types";
import { X } from "lucide-react";

interface Props {
  tag: Tag;
  onRemove?: () => void;
  size?: "sm" | "md";
}

export function TagBadge({ tag, onRemove, size = "sm" }: Props) {
  const bg = tag.color ?? "#6366f1";
  const textClass = size === "sm" ? "text-xs" : "text-sm";

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium ${textClass}`}
      style={{ backgroundColor: bg + "33", color: bg, border: `1px solid ${bg}55` }}
    >
      {tag.name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 rounded-full hover:opacity-70 transition-opacity"
          aria-label={`Remove tag ${tag.name}`}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}
