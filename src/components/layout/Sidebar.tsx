import { FolderManager } from "../library/FolderManager";
import { useUIStore, type LibraryView } from "../../stores/uiStore";
import { openLogFolder } from "../../lib/ipc";

const NAV_ITEMS: { label: string; view: LibraryView }[] = [
  { label: "전체 곡", view: "tracks" },
  { label: "앨범", view: "albums" },
  { label: "아티스트", view: "artists" },
];

export function Sidebar() {
  const { currentView, setView } = useUIStore();

  return (
    <aside
      className="flex flex-col h-full border-r"
      style={{
        width: "var(--sidebar-w)",
        backgroundColor: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      {/* 앱 제목 */}
      <div
        className="flex items-center h-14 px-4 border-b flex-shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span className="font-semibold text-base" style={{ color: "var(--color-fg)" }}>
          Cadence
        </span>
      </div>

      {/* 내비게이션 */}
      <nav className="flex-1 overflow-y-auto" aria-label="사이드바 내비게이션">
        <div
          className="px-3 py-2 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-1"
            style={{ color: "var(--color-fg-subtle)" }}
          >
            라이브러리
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(({ label, view }) => (
              <li key={view}>
                <button
                  onClick={() => setView(view)}
                  className="w-full text-left text-sm px-2 py-1 rounded transition-colors hover:bg-[var(--color-surface-raised)]"
                  style={{
                    color: currentView === view
                      ? "var(--color-fg)"
                      : "var(--color-fg-muted)",
                    fontWeight: currentView === view ? 600 : undefined,
                    backgroundColor: currentView === view
                      ? "var(--color-surface-raised)"
                      : undefined,
                  }}
                  aria-current={currentView === view ? "page" : undefined}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* 폴더 관리 */}
        <div className="border-b" style={{ borderColor: "var(--color-border)" }}>
          <FolderManager />
        </div>
      </nav>

      {/* 하단 유틸리티 */}
      <div
        className="px-3 py-2 border-t flex-shrink-0"
        style={{ borderColor: "var(--color-border)" }}
      >
        <button
          onClick={() => openLogFolder().catch(() => {})}
          className="w-full text-left text-xs px-2 py-1 rounded transition-colors hover:bg-[var(--color-surface-raised)]"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          로그 폴더 열기
        </button>
      </div>
    </aside>
  );
}
