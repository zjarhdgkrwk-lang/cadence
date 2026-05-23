export function NowPlayingBar() {
  return (
    <footer
      className="flex items-center px-4 border-t shrink-0"
      style={{
        height: "var(--nowplaying-bar-h)",
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
      aria-label="현재 재생 중"
    >
      <p className="text-sm" style={{ color: "var(--color-fg-muted)" }}>
        재생 중인 곡 없음
      </p>
    </footer>
  );
}
