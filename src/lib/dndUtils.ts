import type { Modifier } from "@dnd-kit/core";

function getPointerCoords(event: Event): { x: number; y: number } | null {
  if (event instanceof MouseEvent) return { x: event.clientX, y: event.clientY };
  if (typeof TouchEvent !== "undefined" && event instanceof TouchEvent) {
    const touch = event.touches[0] ?? event.changedTouches[0];
    if (touch) return { x: touch.clientX, y: touch.clientY };
  }
  return null;
}

/**
 * DragOverlay 중심을 커서 위치에 고정한다.
 * @dnd-kit/modifiers 없이 동일한 수식으로 구현.
 */
export const snapCenterToCursor: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  overlayNodeRect,
  transform,
}) => {
  if (!activatorEvent || !draggingNodeRect) return transform;
  const coords = getPointerCoords(activatorEvent);
  if (!coords) return transform;
  const w = overlayNodeRect?.width ?? draggingNodeRect.width;
  const h = overlayNodeRect?.height ?? draggingNodeRect.height;
  return {
    ...transform,
    x: transform.x + coords.x - draggingNodeRect.left - w / 2,
    y: transform.y + coords.y - draggingNodeRect.top - h / 2,
  };
};

/**
 * DnD 순서 변경 후 currentIndex를 보정한다.
 * `from` 위치 항목이 `to` 위치로 이동했을 때 현재 재생 인덱스를 따라간다.
 */
export function adjustCurrentIndex(
  currentIndex: number,
  from: number,
  to: number,
): number {
  if (currentIndex === from) return to;
  if (from < currentIndex && to >= currentIndex) return currentIndex - 1;
  if (from > currentIndex && to <= currentIndex) return currentIndex + 1;
  return currentIndex;
}

/**
 * 새 항목 배열과 position 매핑을 반환한다.
 * 큐·플레이리스트 IPC 호출용.
 */
export function buildPositionMap(
  trackIds: number[],
): { track_id: number; position: number }[] {
  return trackIds.map((track_id, position) => ({ track_id, position }));
}
