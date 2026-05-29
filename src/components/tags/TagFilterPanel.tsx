import { useTagStore } from "../../stores/tagStore";
import { useLibraryStore } from "../../stores/libraryStore";
import { TagBadge } from "./TagBadge";
import { TagManager } from "./TagManager";
import type { Tag } from "../../lib/types";

export function TagFilterPanel() {
  const { tags } = useTagStore();
  const { activeTagIds, tagFilterMode, toggleTagFilter, setTagFilterMode, clearTagFilter } =
    useLibraryStore();

  // Always render so TagManager (tag CRUD) is accessible even when no tags exist.
  return (
    <div className="px-3 pb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          태그
        </span>
        <div className="flex items-center gap-1">
          {activeTagIds.length > 0 && (
            <>
              <button
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  tagFilterMode === "and"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground"
                }`}
                onClick={() => setTagFilterMode("and")}
                title="AND: 선택한 태그 모두 포함"
              >
                AND
              </button>
              <button
                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                  tagFilterMode === "or"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-transparent text-muted-foreground border-border hover:border-foreground"
                }`}
                onClick={() => setTagFilterMode("or")}
                title="OR: 선택한 태그 중 하나 이상 포함"
              >
                OR
              </button>
              <button
                className="text-[10px] text-muted-foreground hover:text-foreground"
                onClick={clearTagFilter}
                title="필터 초기화"
              >
                초기화
              </button>
            </>
          )}
          {/* Always visible — required entry point when there are no tags yet */}
          <TagManager />
        </div>
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag: Tag) => {
            const active = activeTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                onClick={() => toggleTagFilter(tag.id)}
                className={`transition-opacity ${active ? "opacity-100" : "opacity-50 hover:opacity-80"}`}
                title={tag.name}
              >
                <TagBadge tag={tag} />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          태그 없음 — "태그 관리"에서 만들어보세요.
        </p>
      )}
    </div>
  );
}
