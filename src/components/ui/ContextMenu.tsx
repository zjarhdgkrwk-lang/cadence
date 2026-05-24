import { useEffect, useRef } from "react";
import { ListPlus, Play, Plus, Trash2 } from "lucide-react";
import { useUIStore } from "../../stores/uiStore";
import { usePlaylistStore } from "../../stores/playlistStore";
import { controller } from "../../lib/playerController";

export function ContextMenu() {
  const contextMenu = useUIStore((s) => s.contextMenu);
  const { setContextMenu } = useUIStore.getState();
  const playlists = usePlaylistStore((s) => s.playlists);
  const { addTracks } = usePlaylistStore.getState();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;

  const { x, y, track, playlistId } = contextMenu;

  function close() {
    setContextMenu(null);
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 rounded shadow-lg border py-1 min-w-[160px]"
      style={{
        left: x,
        top: y,
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <MenuItem
        icon={<Play size={13} />}
        label="재생"
        onClick={() => { controller.playTrack(track); close(); }}
      />
      <MenuItem
        icon={<ListPlus size={13} />}
        label="다음에 재생"
        onClick={() => { controller.addToQueueNext(track); close(); }}
      />
      <MenuItem
        icon={<Plus size={13} />}
        label="큐에 추가"
        onClick={() => { controller.addToQueueEnd(track); close(); }}
      />

      {playlists.length > 0 && (
        <>
          <div
            className="my-1 border-t"
            style={{ borderColor: "var(--color-border)" }}
          />
          <p
            className="px-3 py-0.5 text-xs"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            플레이리스트에 추가
          </p>
          {playlists.map((p) => (
            <MenuItem
              key={p.id}
              icon={<Plus size={13} />}
              label={p.name}
              onClick={() => {
                addTracks(p.id, [track.id]).catch(() => {});
                close();
              }}
            />
          ))}
        </>
      )}

      {playlistId != null && (
        <>
          <div
            className="my-1 border-t"
            style={{ borderColor: "var(--color-border)" }}
          />
          <MenuItem
            icon={<Trash2 size={13} />}
            label="이 플레이리스트에서 제거"
            onClick={() => {
              usePlaylistStore.getState().removeTrack(playlistId, track.id).catch(() => {});
              close();
            }}
            danger
          />
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors hover:bg-[var(--color-surface-raised)]"
      style={{
        color: danger ? "var(--color-error, #e53e3e)" : "var(--color-fg)",
      }}
    >
      <span style={{ color: danger ? "var(--color-error, #e53e3e)" : "var(--color-fg-muted)" }}>
        {icon}
      </span>
      {label}
    </button>
  );
}
