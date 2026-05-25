import { describe, beforeEach, it, expect, vi } from "vitest";
import { useQueueStore } from "../queueStore";
import { usePlayerStore } from "../playerStore";
import type { Track, RepeatMode } from "../../lib/types";

// ─── 목 설정 ───────────────────────────────────────────────────
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (p: string) => `asset://${p}`,
}));
vi.mock("../../lib/ipc", () => ({
  updatePlayStats: vi.fn().mockResolvedValue(undefined),
  setAppState: vi.fn().mockResolvedValue(undefined),
  saveQueue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/persist", () => ({
  scheduleSave: vi.fn(),
}));

function mkTrack(id: number): Track {
  return {
    id,
    path: `/music/track${id}.mp3`,
    filename: `track${id}.mp3`,
    title: `Track ${id}`,
    artist: "Artist",
    album: "Album",
    album_artist: null,
    genre: null,
    track_no: id,
    disc_no: null,
    year: null,
    duration_ms: 180_000,
    bitrate: null,
    codec: null,
    has_embedded_art: false,
    art_cache_path: null,
    dominant_color: null,
    lrc_path: null,
    lrc_offset_ms: 0,
    lyrics_source: "none",
    missing: false,
    date_added: 0,
    last_played_at: null,
    play_count: 0,
    replaygain_track_gain: null,
    replaygain_album_gain: null,
  };
}

function setQueue(
  items: Track[],
  currentIndex: number,
  repeatMode: RepeatMode = "no_repeat",
  shuffle = false
) {
  useQueueStore.setState({
    items,
    currentIndex,
    history: [],
    unplayed: shuffle
      ? items.map((_, i) => i).filter((i) => i !== currentIndex)
      : [],
    shuffle,
    repeatMode,
    source: { type: "library" },
  });
}

// ─── peekNextTrack 테스트 ──────────────────────────────────────

describe("queueStore.peekNextTrack", () => {
  beforeEach(() => {
    useQueueStore.setState({
      items: [],
      currentIndex: -1,
      history: [],
      unplayed: [],
      shuffle: false,
      repeatMode: "no_repeat",
      source: { type: "library" },
    });
  });

  it("빈 큐 → null", () => {
    expect(useQueueStore.getState().peekNextTrack()).toBeNull();
  });

  it("순차, no_repeat: 마지막 곡 → null", () => {
    const [t1] = [mkTrack(1)];
    setQueue([t1], 0, "no_repeat");
    expect(useQueueStore.getState().peekNextTrack()).toBeNull();
  });

  it("순차, no_repeat: 다음 곡 존재 → 반환", () => {
    const [t1, t2] = [mkTrack(1), mkTrack(2)];
    setQueue([t1, t2], 0, "no_repeat");
    expect(useQueueStore.getState().peekNextTrack()?.id).toBe(2);
  });

  it("순차, repeat_all: 마지막 곡 → 첫 곡 반환", () => {
    const [t1, t2] = [mkTrack(1), mkTrack(2)];
    setQueue([t1, t2], 1, "repeat_all");
    expect(useQueueStore.getState().peekNextTrack()?.id).toBe(1);
  });

  it("repeat_one → 현재 곡 반환", () => {
    const [t1, t2] = [mkTrack(1), mkTrack(2)];
    setQueue([t1, t2], 0, "repeat_one");
    expect(useQueueStore.getState().peekNextTrack()?.id).toBe(1);
  });

  it("one_track → null", () => {
    const [t1, t2] = [mkTrack(1), mkTrack(2)];
    setQueue([t1, t2], 0, "one_track");
    expect(useQueueStore.getState().peekNextTrack()).toBeNull();
  });

  it("셔플, unplayed 있음 → unplayed[0] 반환", () => {
    const [t1, t2, t3] = [mkTrack(1), mkTrack(2), mkTrack(3)];
    setQueue([t1, t2, t3], 0, "no_repeat", true);
    // unplayed = [1, 2] (현재 인덱스 0 제외)
    const peek = useQueueStore.getState().peekNextTrack();
    expect(peek).not.toBeNull();
    expect([2, 3]).toContain(peek!.id);
  });

  it("셔플, unplayed 없음, repeat_all → 첫 곡 반환", () => {
    const [t1, t2] = [mkTrack(1), mkTrack(2)];
    useQueueStore.setState({
      items: [t1, t2],
      currentIndex: 0,
      history: [],
      unplayed: [], // 모두 소진
      shuffle: true,
      repeatMode: "repeat_all",
      source: { type: "library" },
    });
    expect(useQueueStore.getState().peekNextTrack()?.id).toBe(1);
  });

  it("셔플, unplayed 없음, no_repeat → null", () => {
    const [t1, t2] = [mkTrack(1), mkTrack(2)];
    useQueueStore.setState({
      items: [t1, t2],
      currentIndex: 0,
      history: [],
      unplayed: [],
      shuffle: true,
      repeatMode: "no_repeat",
      source: { type: "library" },
    });
    expect(useQueueStore.getState().peekNextTrack()).toBeNull();
  });

  it("peekNextTrack는 큐 상태를 변경하지 않음", () => {
    const [t1, t2, t3] = [mkTrack(1), mkTrack(2), mkTrack(3)];
    setQueue([t1, t2, t3], 0, "no_repeat");
    const before = useQueueStore.getState().currentIndex;

    useQueueStore.getState().peekNextTrack();
    useQueueStore.getState().peekNextTrack();

    expect(useQueueStore.getState().currentIndex).toBe(before);
    expect(useQueueStore.getState().items.length).toBe(3);
  });
});

// ─── 프리로드 무효화: addToQueueNext → peekNextTrack 변경 ──────

describe("프리로드 대상 무효화 시나리오", () => {
  beforeEach(() => {
    useQueueStore.setState({
      items: [],
      currentIndex: -1,
      history: [],
      unplayed: [],
      shuffle: false,
      repeatMode: "no_repeat",
      source: { type: "library" },
    });
  });

  it("addToQueueNext 삽입 후 peek이 새 트랙으로 바뀜", () => {
    const [t1, t2, t3] = [mkTrack(1), mkTrack(2), mkTrack(3)];
    setQueue([t1, t2], 0, "no_repeat");

    const peekBefore = useQueueStore.getState().peekNextTrack();
    expect(peekBefore?.id).toBe(2);

    // 현재(0) 바로 다음에 t3 삽입 → 순서: [t1, t3, t2]
    useQueueStore.getState().addToQueueNext(t3);

    const peekAfter = useQueueStore.getState().peekNextTrack();
    expect(peekAfter?.id).toBe(3);
  });

  it("replaceQueue 후 peek이 새 큐 기준으로 반환", () => {
    const [t1, t2] = [mkTrack(1), mkTrack(2)];
    const [t3, t4] = [mkTrack(3), mkTrack(4)];
    setQueue([t1, t2], 0, "no_repeat");

    useQueueStore.getState().replaceQueue([t3, t4], 0);

    expect(useQueueStore.getState().peekNextTrack()?.id).toBe(4);
  });

  it("repeat 모드 변경 후 peek 반영", () => {
    const [t1] = [mkTrack(1)];
    setQueue([t1], 0, "no_repeat");

    // no_repeat: 마지막 곡 → null
    expect(useQueueStore.getState().peekNextTrack()).toBeNull();

    // repeat_all로 변경 → 첫 곡 반환
    useQueueStore.getState().setRepeatMode("repeat_all");
    expect(useQueueStore.getState().peekNextTrack()?.id).toBe(1);
  });
});

// ─── playerStore speed / replaygainMode 상태 테스트 ───────────

describe("playerStore speed / replaygainMode", () => {
  beforeEach(() => {
    usePlayerStore.setState({
      status: "idle",
      currentTrack: null,
      positionMs: 0,
      durationMs: 0,
      volume: 1,
      muted: false,
      speed: 1,
      replaygainMode: "track",
      _statCredited: false,
    } as Parameters<typeof usePlayerStore.setState>[0]);
  });

  it("기본값: speed=1, replaygainMode=track", () => {
    const ps = usePlayerStore.getState();
    expect(ps.speed).toBe(1);
    expect(ps.replaygainMode).toBe("track");
  });

  it("_setSpeed 호출 후 상태 반영", () => {
    usePlayerStore.getState()._setSpeed(1.5);
    expect(usePlayerStore.getState().speed).toBe(1.5);
  });

  it("_setReplaygainMode 호출 후 상태 반영", () => {
    usePlayerStore.getState()._setReplaygainMode("album");
    expect(usePlayerStore.getState().replaygainMode).toBe("album");
  });

  it("speed/replaygainMode 독립적으로 변경됨", () => {
    usePlayerStore.getState()._setSpeed(0.75);
    usePlayerStore.getState()._setReplaygainMode("off");
    const ps = usePlayerStore.getState();
    expect(ps.speed).toBe(0.75);
    expect(ps.replaygainMode).toBe("off");
  });
});

// ─── 리스너 누수 방지: detach/attach 함수 가드 ────────────────
// PlayerController 내부 메서드는 private이므로 직접 테스트 불가.
// 대신 mountAudio를 여러 번 호출해도 이벤트 핸들러가 중복 등록되지 않음을 검증.

describe("PlayerController mountAudio 중복 등록 방지", () => {
  it("같은 element로 mountAudio를 두 번 호출해도 이벤트 리스너는 한 번만", async () => {
    // 이 테스트는 controller 내부를 직접 검증하기 어려우므로
    // addEventListener 호출 횟수를 spy로 확인.
    const { controller } = await import("../../lib/playerController");

    const primary = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
      src: "",
      volume: 1,
      muted: false,
      playbackRate: 1,
      preload: "auto",
      readyState: 0,
      error: null,
    } as unknown as HTMLAudioElement;

    const secondary = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      load: vi.fn(),
      src: "",
      volume: 1,
      muted: false,
      playbackRate: 1,
      preload: "auto",
      readyState: 0,
      error: null,
    } as unknown as HTMLAudioElement;

    controller.mountAudio(primary, secondary);

    // primary에 active 리스너(8종) 부착 확인
    expect(primary.addEventListener).toHaveBeenCalledTimes(8);
    // secondary에는 mountAudio 시점에 리스너 미부착 (프리로드 시에만)
    expect(secondary.addEventListener).toHaveBeenCalledTimes(0);

    // 두 번째 mountAudio: removeEventListener로 이전 리스너 제거 후 재부착
    controller.mountAudio(primary, secondary);

    // 이전 리스너 제거 후 재부착 → removeEventListener 8번 호출
    expect(primary.removeEventListener).toHaveBeenCalledTimes(8);
    // 재부착 → addEventListener 총 16번 (8 + 8)
    expect(primary.addEventListener).toHaveBeenCalledTimes(16);
  });
});
