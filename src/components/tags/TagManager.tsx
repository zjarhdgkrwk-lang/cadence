import { useState } from "react";
import { useTagStore } from "../../stores/tagStore";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";
import type { Tag } from "../../lib/types";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#6366f1", "#a855f7", "#ec4899",
  "#64748b",
];

interface EditRowProps {
  tag: Tag;
  onDone: () => void;
}

function EditRow({ tag, onDone }: EditRowProps) {
  const { renameTag, setTagColor, deleteTag } = useTagStore();
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color ?? PRESET_COLORS[5]);
  const [delConfirm, setDelConfirm] = useState(false);

  async function save() {
    if (name.trim() && name.trim() !== tag.name) await renameTag(tag.id, name.trim());
    if (color !== tag.color) await setTagColor(tag.id, color);
    onDone();
  }

  async function remove() {
    await deleteTag(tag.id);
    onDone();
  }

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
      <div className="flex gap-1 flex-wrap w-28 items-center">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-110"
            style={{ backgroundColor: c, borderColor: color === c ? "white" : "transparent" }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-4 h-4 rounded cursor-pointer border-0 p-0"
          title="커스텀 색상"
          aria-label="커스텀 색상 선택"
        />
      </div>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-7 text-sm flex-1"
        onKeyDown={(e) => e.key === "Enter" && save()}
        autoFocus
      />
      <button onClick={save} className="text-green-500 hover:opacity-80" aria-label="Save">
        <Check size={15} />
      </button>
      <button onClick={onDone} className="text-muted-foreground hover:opacity-80" aria-label="Cancel">
        <X size={15} />
      </button>
      {delConfirm ? (
        <>
          <span className="text-xs text-destructive">삭제?</span>
          <button onClick={remove} className="text-destructive hover:opacity-80 text-xs font-semibold">예</button>
          <button onClick={() => setDelConfirm(false)} className="text-muted-foreground hover:opacity-80 text-xs">아니오</button>
        </>
      ) : (
        <button onClick={() => setDelConfirm(true)} className="text-muted-foreground hover:text-destructive" aria-label="Delete tag">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

interface CreateRowProps {
  onDone: () => void;
}

function CreateRow({ onDone }: CreateRowProps) {
  const { createTag } = useTagStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[5]);

  async function create() {
    if (!name.trim()) return;
    await createTag(name.trim(), color);
    onDone();
  }

  return (
    <div className="flex items-center gap-2 py-1.5 border-t border-border mt-2 pt-2">
      <div className="flex gap-1 flex-wrap w-28 items-center">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            className="w-4 h-4 rounded-full border-2 transition-transform hover:scale-110"
            style={{ backgroundColor: c, borderColor: color === c ? "white" : "transparent" }}
            onClick={() => setColor(c)}
            aria-label={c}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-4 h-4 rounded cursor-pointer border-0 p-0"
          title="커스텀 색상"
          aria-label="커스텀 색상 선택"
        />
      </div>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="새 태그 이름"
        className="h-7 text-sm flex-1"
        onKeyDown={(e) => e.key === "Enter" && create()}
        autoFocus
      />
      <button onClick={create} className="text-green-500 hover:opacity-80" aria-label="Create tag">
        <Check size={15} />
      </button>
      <button onClick={onDone} className="text-muted-foreground hover:opacity-80" aria-label="Cancel">
        <X size={15} />
      </button>
    </div>
  );
}

export function TagManager() {
  const { tags } = useTagStore();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">태그 관리</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>태그 관리</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto pr-1">
          {tags.map((tag) =>
            editingId === tag.id ? (
              <EditRow key={tag.id} tag={tag} onDone={() => setEditingId(null)} />
            ) : (
              <div
                key={tag.id}
                className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0 group"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color ?? "#6366f1" }}
                />
                <span className="flex-1 text-sm">{tag.name}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                  onClick={() => setEditingId(tag.id)}
                  aria-label="Edit tag"
                >
                  <Pencil size={13} />
                </button>
              </div>
            )
          )}
          {tags.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">태그가 없습니다.</p>
          )}
        </div>
        {creating ? (
          <CreateRow onDone={() => setCreating(false)} />
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full text-xs gap-1"
            onClick={() => setCreating(true)}
          >
            <Plus size={13} /> 새 태그 만들기
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
