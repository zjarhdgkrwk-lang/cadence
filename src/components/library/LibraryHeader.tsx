import { useCallback, useRef } from "react";
import { ChevronUp, ChevronDown, Search } from "lucide-react";
import { useLibraryStore } from "../../stores/libraryStore";
import type { SortField } from "../../lib/types";

const SORT_COLS: { field: SortField; label: string; className: string }[] = [
  { field: "title",  label: "제목",  className: "flex-1 min-w-0" },
  { field: "artist", label: "아티스트", className: "w-40 hidden sm:block" },
  { field: "album",  label: "앨범",  className: "w-48 hidden md:block" },
];

export function LibraryHeader() {
  const { sortField, sortDir, totalTracks, isScanning, scanProgress, setSort, setSearch } =
    useLibraryStore();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setSearch(q), 200);
    },
    [setSearch]
  );

  return (
    <div
      className="flex-shrink-0 border-b"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}
    >
      {/* 검색 바 */}
      <div className="flex items-center gap-2 px-4 py-2">
        <Search size={15} style={{ color: "var(--color-fg-subtle)" }} />
        <input
          type="search"
          placeholder="검색 (제목 · 아티스트 · 앨범)"
          onChange={handleSearch}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-fg-subtle)]"
          style={{ color: "var(--color-fg)" }}
          aria-label="라이브러리 검색"
        />
        <span className="text-xs tabular-nums" style={{ color: "var(--color-fg-subtle)" }}>
          {isScanning
            ? `스캔 중… ${scanProgress?.scanned ?? 0} / ${scanProgress?.total ?? "?"}`
            : `${totalTracks.toLocaleString()}곡`}
        </span>
      </div>

      {/* 스캔 진행률 바 */}
      {isScanning && scanProgress && scanProgress.total > 0 && (
        <div
          className="h-0.5 transition-all"
          style={{
            backgroundColor: "var(--color-accent)",
            width: `${(scanProgress.scanned / scanProgress.total) * 100}%`,
          }}
        />
      )}

      {/* 컬럼 헤더 (정렬) */}
      <div
        className="flex items-center gap-3 px-4 py-1 text-xs font-medium"
        style={{ color: "var(--color-fg-subtle)" }}
        role="row"
      >
        {/* 아트/번호 자리 */}
        <div className="w-8 flex-shrink-0" />

        {SORT_COLS.map(({ field, label, className }) => (
          <button
            key={field}
            onClick={() => setSort(field)}
            className={`${className} flex items-center gap-1 hover:text-[var(--color-fg)] transition-colors text-left`}
            role="columnheader"
            aria-sort={
              sortField === field ? (sortDir === "asc" ? "ascending" : "descending") : "none"
            }
          >
            <span>{label}</span>
            {sortField === field &&
              (sortDir === "asc" ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              ))}
          </button>
        ))}

        {/* 재생시간 헤더 */}
        <div className="w-12 flex-shrink-0 text-right">시간</div>
      </div>
    </div>
  );
}
