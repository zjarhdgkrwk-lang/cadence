import { useQueueStore } from "../../stores/queueStore";
import { usePlayerStore } from "../../stores/playerStore";
import { controller } from "../../lib/playerController";
import { artUrl } from "../../lib/ipc";

function formatDuration(ms: number | null): string {
  if (!ms) return "--:--";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export function QueuePanel() {
  const items = useQueueStore((s) => s.items);
  const currentIndex = useQueueStore((s) => s.currentIndex);
  const source = useQueueStore((s) => s.source);
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const sourceLabel =
    source.type === "playlist" ? `플레이리스트: ${source.playlistName}` : "라이브러리";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b flex-shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span className="text-sm font-medium" style={{ color: "var(--color-fg)" }}>
          재생 큐
        </span>
        <span className="text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          {sourceLabel}
        </span>
      </div>

      {/* Track list */}
      {items.length === 0 ? (
        <div className="flex items-center justify-center flex-1">
          <p className="text-sm" style={{ color: "var(--color-fg-subtle)" }}>
            큐가 비어 있음
          </p>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {items.map((track, idx) => {
            const isCurrent = track.id === currentTrack?.id && idx === currentIndex;
            const art = artUrl(track.art_cache_path);
            return (
              <li key={`${track.id}-${idx}`}>
                <button
                  className="w-full flex items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-[var(--color-surface-raised)]"
                  style={{
                    backgroundColor: isCurrent
                      ? "var(--color-surface-raised)"
                      : undefined,
                  }}
                  onClick={() => {
                    const t = useQueueStore.getState().playIndex(idx);
                    if (t) controller.playTrack(t);
                  }}
                >
                  {/* Art / index */}
                  <div className="w-6 flex-shrink-0 flex items-center justify-center">
                    {art ? (
                      <img
                        src={art}
                        alt=""
                        width={24}
                        height={24}
                        className="rounded-sm object-cover"
                        style={{ width: 24, height: 24 }}
                      />
                    ) : (
                      <span
                        className="text-xs tabular-nums"
                        style={{
                          color: isCurrent
                            ? "var(--color-accent)"
                            : "var(--color-fg-subtle)",
                        }}
                      >
                        {idx + 1}
                      </span>
                    )}
                  </div>

                  {/* Title + artist */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm truncate leading-tight"
                      style={{
                        color: isCurrent ? "var(--color-accent)" : "var(--color-fg)",
                        fontWeight: isCurrent ? 600 : undefined,
                      }}
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

                  {/* Duration */}
                  <span
                    className="text-xs tabular-nums flex-shrink-0"
                    style={{ color: "var(--color-fg-subtle)" }}
                  >
                    {formatDuration(track.duration_ms)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
