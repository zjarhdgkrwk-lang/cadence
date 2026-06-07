/**
 * useKeyboardShortcuts — Phase 7 신규 단축키 로직 테스트.
 * Node 환경(jsdom 미사용): KeyboardEvent 대신 순수 객체 사용.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { controller } from "../../lib/playerController";
import { usePlayerStore } from "../../stores/playerStore";
import { useUIStore } from "../../stores/uiStore";

// ── mock ─────────────────────────────────────────────────────────────────────
vi.mock("../../lib/playerController", () => ({
  controller: {
    toggle: vi.fn(), next: vi.fn(), prev: vi.fn(),
    seek: vi.fn(), setVolume: vi.fn(), toggleShuffle: vi.fn(), cycleRepeat: vi.fn(),
  },
}));

let _positionMs = 10_000;
let _durationMs = 60_000;
let _volume = 0.5;
vi.mock("../../stores/playerStore", () => ({
  usePlayerStore: { getState: () => ({ volume: _volume, positionMs: _positionMs, durationMs: _durationMs }) },
}));

const mockSetRightPanel = vi.fn();
const mockSetNowPlayingExpanded = vi.fn();
let _nowPlayingExpanded = false;
let _rightPanel: string | null = "queue";
vi.mock("../../stores/uiStore", () => ({
  useUIStore: {
    getState: () => ({
      nowPlayingExpanded: _nowPlayingExpanded, rightPanel: _rightPanel,
      setNowPlayingExpanded: mockSetNowPlayingExpanded, setRightPanel: mockSetRightPanel,
    }),
  },
}));

// ── 핸들러 (useKeyboardShortcuts의 onKeyDown 동일 로직) ───────────────────────
const SEEK_STEP_MS = 5_000;

// window.dispatchEvent는 Node 환경에서 없으므로 spy로 대체
const dispatchSpy = vi.fn();
(globalThis as Record<string, unknown>).window = { dispatchEvent: dispatchSpy };

type FakeEvent = { code: string; ctrlKey?: boolean; metaKey?: boolean; target?: { tagName: string; isContentEditable: boolean } };

function onKeyDown(e: FakeEvent) {
  const target = e.target ?? { tagName: "BODY", isContentEditable: false };
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
  const ctrl = e.ctrlKey ?? false;
  const meta = e.metaKey ?? false;
  if (e.code === "Space" && !ctrl && !meta) { controller.toggle(); }
  else if (e.code === "ArrowRight" && ctrl) { controller.next(); }
  else if (e.code === "ArrowLeft" && ctrl) { controller.prev(); }
  else if (e.code === "ArrowRight" && !ctrl && !meta) {
    const { positionMs, durationMs } = usePlayerStore.getState();
    controller.seek(Math.min(positionMs + SEEK_STEP_MS, durationMs));
  } else if (e.code === "ArrowLeft" && !ctrl && !meta) {
    const { positionMs } = usePlayerStore.getState();
    controller.seek(Math.max(0, positionMs - SEEK_STEP_MS));
  } else if (e.code === "ArrowUp" && !ctrl && !meta) {
    controller.setVolume(Math.min(1, usePlayerStore.getState().volume + 0.05));
  } else if (e.code === "ArrowDown" && !ctrl && !meta) {
    controller.setVolume(Math.max(0, usePlayerStore.getState().volume - 0.05));
  } else if (e.code === "KeyF" && ctrl) {
    dispatchSpy("cadence:search-focus");
  } else if (e.code === "Escape") {
    const ui = useUIStore.getState();
    if (ui.nowPlayingExpanded) { ui.setNowPlayingExpanded(false); }
    else if (ui.rightPanel !== null) { ui.setRightPanel(null); }
  }
}

describe("useKeyboardShortcuts — Phase 7 신규 단축키", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _positionMs = 10_000; _durationMs = 60_000; _volume = 0.5;
    _nowPlayingExpanded = false; _rightPanel = "queue";
  });

  it("ArrowRight (non-Ctrl) → seek +5초", () => {
    onKeyDown({ code: "ArrowRight" });
    expect(controller.seek).toHaveBeenCalledWith(15_000);
  });

  it("ArrowLeft (non-Ctrl) → seek -5초", () => {
    onKeyDown({ code: "ArrowLeft" });
    expect(controller.seek).toHaveBeenCalledWith(5_000);
  });

  it("ArrowLeft — 위치 3초 → 0 클램프", () => {
    _positionMs = 3_000;
    onKeyDown({ code: "ArrowLeft" });
    expect(controller.seek).toHaveBeenCalledWith(0);
  });

  it("ArrowRight — 종료 직전 → durationMs 클램프", () => {
    _positionMs = 58_000;
    onKeyDown({ code: "ArrowRight" });
    expect(controller.seek).toHaveBeenCalledWith(60_000);
  });

  it("Ctrl+F → search-focus 이벤트 dispatch", () => {
    onKeyDown({ code: "KeyF", ctrlKey: true });
    expect(dispatchSpy).toHaveBeenCalledWith("cadence:search-focus");
  });

  it("Esc — nowPlayingExpanded true → setNowPlayingExpanded(false)", () => {
    _nowPlayingExpanded = true;
    onKeyDown({ code: "Escape" });
    expect(mockSetNowPlayingExpanded).toHaveBeenCalledWith(false);
    expect(mockSetRightPanel).not.toHaveBeenCalled();
  });

  it("Esc — rightPanel 있음 → setRightPanel(null)", () => {
    _rightPanel = "lyrics";
    onKeyDown({ code: "Escape" });
    expect(mockSetNowPlayingExpanded).not.toHaveBeenCalled();
    expect(mockSetRightPanel).toHaveBeenCalledWith(null);
  });

  it("Esc — 모두 닫혀 있으면 아무 것도 호출 안 함", () => {
    _rightPanel = null;
    onKeyDown({ code: "Escape" });
    expect(mockSetNowPlayingExpanded).not.toHaveBeenCalled();
    expect(mockSetRightPanel).not.toHaveBeenCalled();
  });

  it("ArrowRight + Ctrl → seek 아닌 next", () => {
    onKeyDown({ code: "ArrowRight", ctrlKey: true });
    expect(controller.seek).not.toHaveBeenCalled();
    expect(controller.next).toHaveBeenCalledOnce();
  });

  it("INPUT 포커스 → 단축키 무시", () => {
    onKeyDown({ code: "ArrowRight", target: { tagName: "INPUT", isContentEditable: false } });
    expect(controller.seek).not.toHaveBeenCalled();
  });
});
