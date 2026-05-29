import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  id: string | number;
  children: ReactNode;
  disabled?: boolean;
  data?: Record<string, unknown>;
}

export function SortableTrackItem({ id, children, disabled, data }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled, data });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center group">
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity flex-shrink-0 touch-none"
        aria-label="Drag to reorder"
        tabIndex={-1}
      >
        <GripVertical size={14} />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
