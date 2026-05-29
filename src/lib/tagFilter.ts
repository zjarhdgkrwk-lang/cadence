/** 트랙이 태그 필터 조건을 만족하는지 판단 (프런트엔드 로컬 필터링용 유틸). */
export function trackMatchesTags(
  trackTagIds: number[],
  filterTagIds: number[],
  mode: "and" | "or",
): boolean {
  if (filterTagIds.length === 0) return true;
  if (mode === "and") {
    return filterTagIds.every((id) => trackTagIds.includes(id));
  }
  return filterTagIds.some((id) => trackTagIds.includes(id));
}
