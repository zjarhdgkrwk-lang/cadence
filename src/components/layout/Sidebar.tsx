export function Sidebar() {
  return (
    <aside
      className="flex flex-col h-full border-r"
      style={{
        width: "var(--sidebar-w)",
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <div className="flex items-center h-14 px-4 border-b" style={{ borderColor: "var(--color-border)" }}>
        <span className="font-semibold text-base" style={{ color: "var(--color-fg)" }}>
          Cadence
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2" aria-label="사이드바 내비게이션">
        <p className="px-2 py-1 text-xs" style={{ color: "var(--color-fg-subtle)" }}>
          라이브러리 (준비 중)
        </p>
      </nav>
    </aside>
  );
}
