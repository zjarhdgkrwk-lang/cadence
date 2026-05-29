import { useState, useEffect, useRef } from "react";
import { useTagStore } from "../../stores/tagStore";
import { useUIStore } from "../../stores/uiStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Check, Plus } from "lucide-react";
import type { Tag } from "../../lib/types";

export function TrackTagAssign() {
  const { tags, getTrackTags, assignTags, bulkAssignTags, createTag } = useTagStore();
  const { tagDialogOpen, tagDialogTrackIds, closeTagDialog } = useUIStore();

  const isSingle = tagDialogTrackIds.length === 1;

  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tagDialogOpen) { setChecked(new Set()); setSearch(""); return; }
    if (isSingle) {
      setLoading(true);
      getTrackTags(tagDialogTrackIds[0])
        .then((ts: Tag[]) => setChecked(new Set(ts.map((t) => t.id))))
        .finally(() => setLoading(false));
    } else {
      setChecked(new Set());
    }
  }, [tagDialogOpen, tagDialogTrackIds, isSingle, getTrackTags]);

  // Auto-focus search when dialog opens
  useEffect(() => {
    if (tagDialogOpen) setTimeout(() => searchRef.current?.focus(), 50);
  }, [tagDialogOpen]);

  const searchTrimmed = search.trim();
  const searchLower = searchTrimmed.toLowerCase();
  const filteredTags = searchLower
    ? tags.filter((t) => t.name.toLowerCase().includes(searchLower))
    : tags;
  const hasExactMatch = tags.some((t) => t.name.toLowerCase() === searchLower);
  const showCreate = searchTrimmed.length > 0 && !hasExactMatch;

  function toggle(id: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!searchTrimmed || creating) return;
    setCreating(true);
    try {
      const newTag = await createTag(searchTrimmed, "#6366f1");
      setChecked((prev) => new Set([...prev, newTag.id]));
      setSearch("");
      searchRef.current?.focus();
    } finally {
      setCreating(false);
    }
  }

  async function apply() {
    if (isSingle) {
      await assignTags(tagDialogTrackIds[0], [...checked]);
    } else {
      if (checked.size > 0) await bulkAssignTags(tagDialogTrackIds, [...checked]);
    }
    closeTagDialog();
  }

  return (
    <Dialog open={tagDialogOpen} onOpenChange={(v: boolean) => !v && closeTagDialog()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {isSingle ? "태그 지정" : `태그 추가 (${tagDialogTrackIds.length}곡)`}
          </DialogTitle>
        </DialogHeader>

        {/* Search / create input */}
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && showCreate) handleCreate();
          }}
          placeholder="태그 검색 또는 생성…"
          className="w-full rounded px-2.5 py-1.5 text-sm outline-none bg-transparent"
          style={{
            border: "1px solid var(--color-border)",
            color: "var(--color-fg)",
          }}
        />

        {loading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">로드 중…</p>
        ) : (
          <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto py-1 mt-1">
            {filteredTags.map((tag: Tag) => {
              const on = checked.has(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggle(tag.id)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-sm transition-colors hover:bg-[var(--color-surface-raised)]"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color ?? "#6366f1" }}
                  />
                  <span className={on ? "font-medium" : ""} style={{ color: "var(--color-fg)" }}>
                    {tag.name}
                  </span>
                  {on && (
                    <Check size={12} className="ml-auto flex-shrink-0" style={{ color: "var(--color-accent)" }} />
                  )}
                </button>
              );
            })}

            {/* Notion-style inline create */}
            {showCreate && (
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left text-sm transition-colors hover:bg-[var(--color-surface-raised)]"
                style={{ color: "var(--color-fg-muted)" }}
              >
                <Plus size={12} className="flex-shrink-0" />
                <span>
                  + &lsquo;{searchTrimmed}&rsquo; 만들기
                </span>
              </button>
            )}

            {filteredTags.length === 0 && !showCreate && (
              <p className="text-sm text-muted-foreground py-2 px-2">태그가 없습니다.</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={closeTagDialog}>취소</Button>
          <Button size="sm" onClick={apply} disabled={loading}>
            {isSingle ? "적용" : "추가"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
