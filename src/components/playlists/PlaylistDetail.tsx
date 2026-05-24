import { useEffect } from "react";
import { Play, Trash2 } from "lucide-react";
import { usePlaylistStore } from "../../stores/playlistStore";
import { useUIStore } from "../../stores/uiStore";
import { controller } from "../../lib/playerController";
import { artUrl } from "../../lib/ipc";

function formatDuration(ms: number | null): string {
  if (!ms) return "--:--";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export function PlaylistDetail() {
  const selectedId = useUIStore((s) => s.selectedPlaylistId);
  const playlists = usePlaylistStore((s) => s.playlists);
  const playlistTracksMap = usePlaylistStore((s) => s.playlistTracksMap);
  const { loadPlaylistTracks, deletePlaylist, removeTrack } = usePlaylistStore.getState();
  const { setView, setSelectedPlaylistId } = useUIStore.getState();

  const playlist = playlists.find((p) => p.id === selectedId);
  const tracks = selectedId != null ? (playlistTracksMap[selectedId] ?? null) : null;

  useEffect(() => {
    if (selectedId != null && tracks === null) {
      loadPlaylistTracks(selectedId).catch(() => {});
    }
  }, [selectedId, tracks, loadPlaylistTracks]);

  if (!playlist) {
    return (
      <main
        className="flex-1 flex items-center justify-center"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
          플레이리스트를 선택하세요
        </p>
      </main>
    );
  }

  async function handleDelete() {
    if (!playlist) return;
    await deletePlaylist(playlist.id).catch(() => {});
    setSelectedPlaylistId(null);
    setView("tracks");
  }

  return (
    <main
      className="flex-1 flex flex-col overflow-hidden"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--color-fg)" }}
          >
            {playlist.name}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-fg-subtle)" }}>
            {tracks?.length ?? 0}곡
          </p>
        </div>

        <div className="flex items-center gap-2">
          {tracks && tracks.length > 0 && (
            <button
              onClick={() =>
                controller.replaceQueueAndPlay(tracks, 0, {
                  type: "playlist",
                  playlistId: playlist.id,
                  playlistName: playlist.name,
                })
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors hover:opacity-80"
              style={{
                backgroundColor: "var(--color-accent)",
                color: "#fff",
              }}
            >
              <Play size={14} />
              재생
            </button>
          )}
          <button
            onClick={handleDelete}
            className="p-1.5 rounded transition-colors hover:bg-[var(--color-surface-raised)]"
            title="플레이리스트 삭제"
            aria-label="플레이리스트 삭제"
          >
            <Trash2 size={16} style={{ color: "var(--color-fg-muted)" }} />
          </button>
        </div>
      </div>

      {/* Track list */}
      {!tracks ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
            로딩 중…
          </p>
        </div>
      ) : tracks.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
            곡이 없습니다. 트랙을 우클릭해 추가하세요.
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto py-1">
          {tracks.map((track, idx) => {
            const art = artUrl(track.art_cache_path);
            return (
              <li key={`${track.id}-${idx}`}>
                <div
                  className="group flex items-center gap-3 px-4 py-2 hover:bg-[var(--color-surface-raised)] cursor-default"
                  onDoubleClick={() =>
                    controller.replaceQueueAndPlay(tracks, idx, {
                      type: "playlist",
                      playlistId: playlist.id,
                      playlistName: playlist.name,
                    })
                  }
                >
                  <div className="w-8 flex-shrink-0 flex items-center justify-center">
                    {art ? (
                      <img
                        src={art}
                        alt=""
                        width={32}
                        height={32}
                        className="rounded-sm object-cover"
                        style={{ width: 32, height: 32 }}
                      />
                    ) : (
                      <span
                        className="text-xs tabular-nums"
                        style={{ color: "var(--color-fg-subtle)" }}
                      >
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-medium truncate leading-tight"
                      style={{ color: "var(--color-fg)" }}
                    >
                      {track.title}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--color-fg-muted)" }}
                    >
                      {track.artist}
                    </p>
                  </div>

                  <span
                    className="text-xs tabular-nums flex-shrink-0"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    {formatDuration(track.duration_ms)}
                  </span>

                  <button
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--color-border)] transition-opacity"
                    onClick={() =>
                      removeTrack(playlist.id, track.id).catch(() => {})
                    }
                    title="플레이리스트에서 제거"
                    aria-label="플레이리스트에서 제거"
                  >
                    <Trash2 size={13} style={{ color: "var(--color-fg-muted)" }} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
