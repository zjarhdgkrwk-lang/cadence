import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus, Check, X } from "lucide-react";
import { usePlaylistStore } from "../../stores/playlistStore";
import { useUIStore } from "../../stores/uiStore";

function DroppablePlaylistBtn({
  playlistId,
  isActive,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { playlistId: number; isActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `plDrop:${playlistId}`,
    data: { type: "playlist", playlistId },
  });

  return (
    <button
      ref={setNodeRef}
      className="w-full text-left text-sm px-2 py-1 rounded transition-colors hover:bg-[var(--color-surface-raised)]"
      style={{
        color: isActive ? "var(--color-fg)" : "var(--color-fg-muted)",
        fontWeight: isActive ? 600 : undefined,
        backgroundColor: isOver
          ? "var(--color-accent-subtle, var(--color-surface-raised))"
          : isActive
          ? "var(--color-surface-raised)"
          : undefined,
        outline: isOver ? "1px dashed var(--color-accent)" : undefined,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function PlaylistSection() {
  const playlists = usePlaylistStore((s) => s.playlists);
  const { loadPlaylists, createPlaylist, renamePlaylist } = usePlaylistStore.getState();
  const { currentView, selectedPlaylistId, setView, setSelectedPlaylistId } = useUIStore();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const createInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPlaylists().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (creating) createInputRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (renamingId !== null) renameInputRef.current?.focus();
  }, [renamingId]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    await createPlaylist(name).catch(() => {});
    setNewName("");
    setCreating(false);
  }

  async function handleRename() {
    if (renamingId === null) return;
    const name = renameValue.trim();
    if (name) await renamePlaylist(renamingId, name).catch(() => {});
    setRenamingId(null);
  }

  function selectPlaylist(id: number) {
    setSelectedPlaylistId(id);
    setView("playlist");
  }

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          플레이리스트
        </p>
        <button
          onClick={() => { setCreating(true); setNewName(""); }}
          className="p-0.5 rounded hover:bg-[var(--color-surface-raised)]"
          title="플레이리스트 만들기"
          aria-label="플레이리스트 만들기"
        >
          <Plus size={13} style={{ color: "var(--color-fg-subtle)" }} />
        </button>
      </div>

      <ul className="space-y-0.5">
        {playlists.map((p) => (
          <li key={p.id}>
            {renamingId === p.id ? (
              <div className="flex items-center gap-1">
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="flex-1 text-sm px-1.5 py-0.5 rounded border"
                  style={{
                    backgroundColor: "var(--color-bg)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-fg)",
                    outline: "none",
                  }}
                />
                <button onClick={handleRename} aria-label="저장">
                  <Check size={13} style={{ color: "var(--color-fg-muted)" }} />
                </button>
                <button onClick={() => setRenamingId(null)} aria-label="취소">
                  <X size={13} style={{ color: "var(--color-fg-muted)" }} />
                </button>
              </div>
            ) : (
              <DroppablePlaylistBtn
                playlistId={p.id}
                isActive={currentView === "playlist" && selectedPlaylistId === p.id}
                onClick={() => selectPlaylist(p.id)}
                onDoubleClick={() => {
                  setRenamingId(p.id);
                  setRenameValue(p.name);
                }}
                aria-current={
                  currentView === "playlist" && selectedPlaylistId === p.id
                    ? "page"
                    : undefined
                }
              >
                {p.name}
              </DroppablePlaylistBtn>
            )}
          </li>
        ))}

        {creating && (
          <li>
            <div className="flex items-center gap-1">
              <input
                ref={createInputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setCreating(false);
                }}
                placeholder="플레이리스트 이름"
                className="flex-1 text-sm px-1.5 py-0.5 rounded border"
                style={{
                  backgroundColor: "var(--color-bg)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-fg)",
                  outline: "none",
                }}
              />
              <button onClick={handleCreate} aria-label="저장">
                <Check size={13} style={{ color: "var(--color-fg-muted)" }} />
              </button>
              <button onClick={() => setCreating(false)} aria-label="취소">
                <X size={13} style={{ color: "var(--color-fg-muted)" }} />
              </button>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
