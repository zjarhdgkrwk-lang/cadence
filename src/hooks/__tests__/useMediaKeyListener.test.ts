/**
 * useMediaKeyListener — 액션 라우팅 로직 단위 테스트.
 * routeMediaKeyAction 순수 함수를 직접 호출해 테스트.
 * (@testing-library/react 불필요, 훅 라이프사이클 불관여)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { routeMediaKeyAction } from "../useMediaKeyListener";

// 컨트롤러 스텁
function makeCtrl() {
  return {
    toggle: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    pause: vi.fn(),
  };
}

describe("routeMediaKeyAction", () => {
  let ctrl: ReturnType<typeof makeCtrl>;

  beforeEach(() => {
    ctrl = makeCtrl();
  });

  it("play_pause → toggle", () => {
    routeMediaKeyAction("play_pause", ctrl);
    expect(ctrl.toggle).toHaveBeenCalledOnce();
  });

  it("next → next", () => {
    routeMediaKeyAction("next", ctrl);
    expect(ctrl.next).toHaveBeenCalledOnce();
  });

  it("prev → prev", () => {
    routeMediaKeyAction("prev", ctrl);
    expect(ctrl.prev).toHaveBeenCalledOnce();
  });

  it("stop → pause", () => {
    routeMediaKeyAction("stop", ctrl);
    expect(ctrl.pause).toHaveBeenCalledOnce();
  });

  it("unknown action → 아무 것도 호출 안 함 (경고만)", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    routeMediaKeyAction("unknown_action", ctrl);
    expect(ctrl.toggle).not.toHaveBeenCalled();
    expect(ctrl.next).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("unknown action"));
    consoleSpy.mockRestore();
  });

  it("각 액션은 하나의 메서드만 호출", () => {
    routeMediaKeyAction("next", ctrl);
    expect(ctrl.toggle).not.toHaveBeenCalled();
    expect(ctrl.prev).not.toHaveBeenCalled();
    expect(ctrl.pause).not.toHaveBeenCalled();
    expect(ctrl.next).toHaveBeenCalledOnce();
  });
});

// ── 50ms 디바운스 로직 단위 테스트 ────────────────────────────────────────────
describe("50ms dedup (단독 로직 검증)", () => {
  it("같은 action + 50ms 미만 → 중복 감지", () => {
    const DEDUP_MS = 50;
    let lastAction: string | null = null;
    let lastTime = 0;

    function shouldDedup(action: string, now: number): boolean {
      if (action === lastAction && now - lastTime < DEDUP_MS) return true;
      lastAction = action;
      lastTime = now;
      return false;
    }

    expect(shouldDedup("next", 1000)).toBe(false); // 첫 호출
    expect(shouldDedup("next", 1030)).toBe(true);  // 30ms — 중복
    expect(shouldDedup("next", 1060)).toBe(false); // 60ms — 통과
    expect(shouldDedup("prev", 1065)).toBe(false); // 다른 액션 — 통과
    expect(shouldDedup("prev", 1070)).toBe(true);  // prev 5ms — 중복
  });
});
