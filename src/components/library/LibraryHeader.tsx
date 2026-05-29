import { useRef, useState } from "react";
import { ChevronUp, ChevronDown, Search, X } from "lucide-react";
import { useLibraryStore } from "../../stores/libraryStore";
import { useTagStore } from "../../stores/tagStore";
import type { SearchField, SortField } from "../../lib/types";
import type { Tag } from "../../lib/types";

const SORT_COLS: { field: SortField; label: string; className: string }[] = [
  { field: "title",  label: "제목",  className: "flex-1 min-w-0" },
  { field: "artist", label: "아티스트", className: "w-40 hidden sm:block" },
  { field: "album",  label: "앨범",  className: "w-48 hidden md:block" },
];

const FIELD_LABELS: { field: SearchField; label: string }[] = [
  { field: "title",  label: "제목" },
  { field: "artist", label: "아티스트" },
  { field: "album",  label: "앨범" },
  { field: "tags",   label: "태그" },
];

const ALL_FIELDS: SearchField[] = ["title", "artist", "album", "tags"];

/** Extract partial #word at end of input (no trailing space) — for autocomplete. */
function partialHashAt(val: string): string | null {
  const m = /#([^\s]*)$/.exec(val);
  return m ? m[1] : null;
}

export function LibraryHeader() {
  const {
    sortField, sortDir, totalTracks, isScanning, scanProgress,
    searchFields, setSort, setSearchAndTags, setSearchFields,
  } = useLibraryStore();
  const { tags } = useTagStore();

  // inputValue: text visible in the box (no chip-promoted tokens).
  // chipTagIds: tags resolved from #tagname tokens, shown as dismissible chips.
  const [inputValue, setInputValue] = useState("");
  const [chipTagIds, setChipTagIds] = useState<number[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Partial tag at end of input → drives autocomplete dropdown.
  const partial = partialHashAt(inputValue); // null = no #word at end
  const dropdownTags: Tag[] =
    partial !== null
      ? tags.filter((t) => t.name.toLowerCase().includes(partial.toLowerCase()) && !chipTagIds.includes(t.id))
      : [];

  function commitSearch(text: string, chips: number[]) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = text.replace(/#[^\s]*$/, "").trim(); // strip any dangling partial #word
      console.info(`[search] text="${q}" tags=[${chips.join(",")}]`);
      setSearchAndTags(q, chips);
    }, 200);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let val = e.target.value;
    const newChips = [...chipTagIds];

    // Promote space-terminated #tagname tokens that exactly match a tag into chips.
    val = val.replace(/#([^\s]+)(?=\s)/g, (_, name: string) => {
      const tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (tag && !newChips.includes(tag.id)) {
        newChips.push(tag.id);
        return ""; // strip from input
      }
      return `#${name}`; // keep unresolved token
    });
    val = val.replace(/[ \t]{2,}/g, " ").trimStart();

    setInputValue(val);
    setChipTagIds(newChips);
    setDropdownOpen(partialHashAt(val) !== null);
    commitSearch(val, newChips);
  }

  function selectDropdownTag(tag: Tag) {
    // Replace trailing #partial with empty, promote tag to chip.
    const newVal = inputValue.replace(/#[^\s]*$/, "").replace(/\s+$/, "");
    const newChips = [...chipTagIds];
    if (!newChips.includes(tag.id)) newChips.push(tag.id);
    setInputValue(newVal);
    setChipTagIds(newChips);
    setDropdownOpen(false);
    inputRef.current?.focus();
    commitSearch(newVal, newChips);
  }

  function removeChip(tagId: number) {
    const newChips = chipTagIds.filter((id) => id !== tagId);
    setChipTagIds(newChips);
    commitSearch(inputValue, newChips);
  }

  function toggleField(field: SearchField) {
    const next = searchFields.includes(field)
      ? searchFields.filter((f) => f !== field)
      : [...searchFields, field];
    setSearchFields(next.length > 0 ? next : ALL_FIELDS);
  }

  const allSelected = FIELD_LABELS.every((f) => searchFields.includes(f.field));

  return (
    <div
      className="flex-shrink-0 border-b"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface)" }}
    >
      {/* 검색 바 + 태그 칩 + 필드 토글 */}
      <div className="relative flex items-center gap-1.5 px-4 py-2 flex-wrap">
        <Search size={15} className="flex-shrink-0" style={{ color: "var(--color-fg-subtle)" }} />

        {/* Active tag chips */}
        {chipTagIds.map((id) => {
          const tag = tags.find((t) => t.id === id);
          if (!tag) return null;
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0"
              style={{
                backgroundColor: (tag.color ?? "#6366f1") + "33",
                color: tag.color ?? "#6366f1",
                border: `1px solid ${(tag.color ?? "#6366f1")}66`,
              }}
            >
              #{tag.name}
              <button
                onClick={() => removeChip(id)}
                className="opacity-70 hover:opacity-100 leading-none"
                aria-label={`태그 ${tag.name} 제거`}
              >
                <X size={10} />
              </button>
            </span>
          );
        })}

        <input
          ref={inputRef}
          type="search"
          value={inputValue}
          onChange={handleChange}
          onFocus={() => { if (partialHashAt(inputValue) !== null) setDropdownOpen(true); }}
          onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Escape") setDropdownOpen(false); }}
          placeholder={chipTagIds.length > 0 ? "검색…" : "검색 또는 #태그명"}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-fg-subtle)] min-w-[80px]"
          style={{ color: "var(--color-fg)" }}
          aria-label="라이브러리 검색"
        />

        {/* 검색 필드 토글 */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {FIELD_LABELS.map(({ field, label }) => {
            const on = searchFields.includes(field);
            return (
              <button
                key={field}
                onClick={() => toggleField(field)}
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  on
                    ? "bg-primary/10 text-primary border-primary/40"
                    : "text-muted-foreground border-transparent hover:border-border"
                } ${allSelected ? "opacity-50" : ""}`}
                title={`${label} 필드 검색 ${on ? "끄기" : "켜기"}`}
                aria-pressed={on}
              >
                {label}
              </button>
            );
          })}
        </div>

        <span className="text-xs tabular-nums flex-shrink-0" style={{ color: "var(--color-fg-subtle)" }}>
          {isScanning
            ? `스캔 중… ${scanProgress?.scanned ?? 0} / ${scanProgress?.total ?? "?"}`
            : `${totalTracks.toLocaleString()}곡`}
        </span>

        {/* #tag autocomplete dropdown */}
        {dropdownOpen && dropdownTags.length > 0 && (
          <div
            className="absolute left-4 top-full z-50 rounded-md border shadow-lg py-1"
            style={{
              backgroundColor: "var(--color-surface-raised)",
              borderColor: "var(--color-border)",
              minWidth: 160,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {dropdownTags.map((tag) => (
              <button
                key={tag.id}
                onMouseDown={(e) => { e.preventDefault(); selectDropdownTag(tag); }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-[var(--color-surface)]"
                style={{ color: "var(--color-fg)" }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: tag.color ?? "#6366f1" }}
                />
                #{tag.name}
              </button>
            ))}
          </div>
        )}
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
              (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
        ))}

        <div className="w-12 flex-shrink-0 text-right">시간</div>
      </div>
    </div>
  );
}
