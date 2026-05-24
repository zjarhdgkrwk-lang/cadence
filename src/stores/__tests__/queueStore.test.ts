import { describe, beforeEach, it, expect, vi } from "vitest";
import { useQueueStore } from "../queueStore";
import type { Track } from "../../lib/types";

// Tauri API 모킹 (테스트 환경에서 @tauri-apps/api 없음)
vi.mock("@tauri-apps/api/core", () => ({ convertFileSrc: (p: string) => p }));

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
  };
}

const T = [
  mkTrack(1),
  mkTrack(2),
  mkTrack(3),
  mkTrack(4),
  mkTrack(5),
] as const;

function reset() {
  useQueueStore.setState({
    items: [],
    currentIndex: -1,
    history: [],
    unplayed: [],
    shuffle: false,
    repeatMode: "no_repeat",
  });
}

describe("queueStore", () => {
  beforeEach(reset);

  // ── replaceQueue ───────────────────────────────────────────
  describe("replaceQueue", () => {
    it("아이템과 인덱스를 교체하고 히스토리를 초기화한다", () => {
      useQueueStore.getState().replaceQueue([...T], 2);
      const s = useQueueStore.getState();
      expect(s.items).toHaveLength(5);
      expect(s.currentIndex).toBe(2);
      expect(s.history).toHaveLength(0);
      expect(s.unplayed).toHaveLength(0); // shuffle=false
    });

    it("shuffle=true 시 currentIndex를 제외한 unplayed 풀을 구성한다", () => {
      useQueueStore.setState({ shuffle: true });
      useQueueStore.getState().replaceQueue([...T], 1);
      const s = useQueueStore.getState();
      expect(s.unplayed).not.toContain(1);
      expect(s.unplayed).toHaveLength(4);
    });

    it("startIndex를 범위 내로 클램프한다", () => {
      useQueueStore.getState().replaceQueue([...T], 99);
      expect(useQueueStore.getState().currentIndex).toBe(4);
    });
  });

  // ── addToQueueNext ─────────────────────────────────────────
  describe("addToQueueNext", () => {
    it("currentIndex+1 위치에 삽입한다", () => {
      useQueueStore.getState().replaceQueue([T[0], T[1], T[2]], 1);
      useQueueStore.getState().addToQueueNext(T[3]);
      const s = useQueueStore.getState();
      expect(s.items[2]).toEqual(T[3]);
      expect(s.items).toHaveLength(4);
      expect(s.currentIndex).toBe(1); // 변동 없음
    });

    it("삽입 위치 이후 history 인덱스를 +1 보정한다", () => {
      useQueueStore.setState({
        items: [T[0], T[1], T[2], T[3]],
        currentIndex: 1,
        history: [0, 3],
        unplayed: [],
        shuffle: false,
        repeatMode: "no_repeat",
      });
      useQueueStore.getState().addToQueueNext(T[4]);
      expect(useQueueStore.getState().history).toEqual([0, 4]);
    });

    it("shuffle=true 시 삽입된 인덱스를 unplayed에 추가한다", () => {
      useQueueStore.setState({
        items: [T[0], T[1], T[2]],
        currentIndex: 0,
        unplayed: [1, 2],
        shuffle: true,
        history: [],
        repeatMode: "no_repeat",
      });
      useQueueStore.getState().addToQueueNext(T[3]);
      const s = useQueueStore.getState();
      // 삽입 위치는 1, 기존 unplayed [1,2] → [2,3], 신규 1 추가
      expect(s.unplayed).toContain(1);
    });
  });

  // ── addToQueueEnd ──────────────────────────────────────────
  describe("addToQueueEnd", () => {
    it("끝에 추가하고 currentIndex는 변동 없다", () => {
      useQueueStore.getState().replaceQueue([T[0], T[1], T[2]], 0);
      useQueueStore.getState().addToQueueEnd(T[3]);
      const s = useQueueStore.getState();
      expect(s.items[3]).toEqual(T[3]);
      expect(s.currentIndex).toBe(0);
    });

    it("shuffle=true 시 새 인덱스를 unplayed에 추가한다", () => {
      useQueueStore.setState({
        items: [T[0], T[1]],
        currentIndex: 0,
        unplayed: [1],
        shuffle: true,
        history: [],
        repeatMode: "no_repeat",
      });
      useQueueStore.getState().addToQueueEnd(T[2]);
      expect(useQueueStore.getState().unplayed).toContain(2);
    });
  });

  // ── navigateNext (shuffle=false) ──────────────────────────
  describe("navigateNext (shuffle=false)", () => {
    it("인덱스를 순차 증가한다", () => {
      useQueueStore.getState().replaceQueue([...T], 1);
      const r = useQueueStore.getState().navigateNext();
      expect(r?.index).toBe(2);
      expect(useQueueStore.getState().currentIndex).toBe(2);
    });

    it("마지막 곡에서 null을 반환한다", () => {
      useQueueStore.getState().replaceQueue([...T], 4);
      expect(useQueueStore.getState().navigateNext()).toBeNull();
    });
  });

  // ── navigateNext (shuffle=true) ───────────────────────────
  describe("navigateNext (shuffle=true)", () => {
    it("unplayed에서 랜덤 선택하고 history에 이전 인덱스를 기록한다", () => {
      useQueueStore.setState({
        items: [...T],
        currentIndex: 0,
        unplayed: [1, 2, 3, 4],
        shuffle: true,
        history: [],
        repeatMode: "no_repeat",
      });
      const r = useQueueStore.getState().navigateNext();
      expect(r).not.toBeNull();
      const s = useQueueStore.getState();
      expect(s.history).toEqual([0]);
      expect(s.unplayed).not.toContain(r!.index);
    });

    it("unplayed 소진 + repeat_all → 풀 재구성 후 계속", () => {
      useQueueStore.setState({
        items: [T[0], T[1]],
        currentIndex: 0,
        unplayed: [],
        shuffle: true,
        history: [],
        repeatMode: "repeat_all",
      });
      const r = useQueueStore.getState().navigateNext();
      expect(r).not.toBeNull();
    });

    it("unplayed 소진 + no_repeat → null 반환", () => {
      useQueueStore.setState({
        items: [T[0], T[1]],
        currentIndex: 0,
        unplayed: [],
        shuffle: true,
        history: [],
        repeatMode: "no_repeat",
      });
      expect(useQueueStore.getState().navigateNext()).toBeNull();
    });
  });

  // ── navigatePrev (shuffle=false) ──────────────────────────
  describe("navigatePrev (shuffle=false)", () => {
    it("이전 인덱스로 이동한다", () => {
      useQueueStore.getState().replaceQueue([...T], 2);
      const r = useQueueStore.getState().navigatePrev();
      expect(r?.index).toBe(1);
      expect(useQueueStore.getState().currentIndex).toBe(1);
    });

    it("첫 곡에서 null을 반환한다 (controller가 seek(0) 처리)", () => {
      useQueueStore.getState().replaceQueue([...T], 0);
      expect(useQueueStore.getState().navigatePrev()).toBeNull();
    });
  });

  // ── navigatePrev (shuffle=true) ───────────────────────────
  describe("navigatePrev (shuffle=true)", () => {
    it("history에서 pop하고 current를 unplayed에 돌려놓는다", () => {
      useQueueStore.setState({
        items: [...T],
        currentIndex: 2,
        history: [0, 3],
        unplayed: [1, 4],
        shuffle: true,
        repeatMode: "no_repeat",
      });
      const r = useQueueStore.getState().navigatePrev();
      expect(r?.index).toBe(3);
      const s = useQueueStore.getState();
      expect(s.history).toEqual([0]);
      expect(s.unplayed).toContain(2);
    });

    it("history가 비었으면 null을 반환한다", () => {
      useQueueStore.setState({
        items: [...T],
        currentIndex: 2,
        history: [],
        unplayed: [0, 1, 3, 4],
        shuffle: true,
        repeatMode: "no_repeat",
      });
      expect(useQueueStore.getState().navigatePrev()).toBeNull();
    });
  });

  // ── onTrackEnded ──────────────────────────────────────────
  describe("onTrackEnded", () => {
    it("repeat_one: 동일 트랙을 반환한다", () => {
      useQueueStore.setState({
        items: [...T],
        currentIndex: 1,
        repeatMode: "repeat_one",
        shuffle: false,
        history: [],
        unplayed: [],
      });
      const r = useQueueStore.getState().onTrackEnded();
      expect(r.type).toBe("load");
      if (r.type === "load") expect(r.index).toBe(1);
    });

    it("one_track: idle을 반환한다", () => {
      useQueueStore.setState({
        items: [...T],
        currentIndex: 1,
        repeatMode: "one_track",
        shuffle: false,
        history: [],
        unplayed: [],
      });
      expect(useQueueStore.getState().onTrackEnded().type).toBe("idle");
    });

    it("no_repeat: 다음 트랙으로 이동한다", () => {
      useQueueStore.setState({
        items: [...T],
        currentIndex: 1,
        repeatMode: "no_repeat",
        shuffle: false,
        history: [],
        unplayed: [],
      });
      const r = useQueueStore.getState().onTrackEnded();
      expect(r.type).toBe("load");
      if (r.type === "load") expect(r.index).toBe(2);
    });

    it("no_repeat + 마지막 곡: idle을 반환한다", () => {
      useQueueStore.setState({
        items: [...T],
        currentIndex: 4,
        repeatMode: "no_repeat",
        shuffle: false,
        history: [],
        unplayed: [],
      });
      expect(useQueueStore.getState().onTrackEnded().type).toBe("idle");
    });

    it("repeat_all + 마지막 곡: index 0으로 순환한다", () => {
      useQueueStore.setState({
        items: [...T],
        currentIndex: 4,
        repeatMode: "repeat_all",
        shuffle: false,
        history: [],
        unplayed: [],
      });
      const r = useQueueStore.getState().onTrackEnded();
      expect(r.type).toBe("load");
      if (r.type === "load") expect(r.index).toBe(0);
    });

    it("no_repeat + shuffle + unplayed 소진: idle을 반환한다", () => {
      useQueueStore.setState({
        items: [...T],
        currentIndex: 2,
        repeatMode: "no_repeat",
        shuffle: true,
        history: [],
        unplayed: [],
      });
      expect(useQueueStore.getState().onTrackEnded().type).toBe("idle");
    });

    it("repeat_all + shuffle + unplayed 소진: 새 사이클로 재생한다", () => {
      useQueueStore.setState({
        items: [...T],
        currentIndex: 2,
        repeatMode: "repeat_all",
        shuffle: true,
        history: [],
        unplayed: [],
      });
      const r = useQueueStore.getState().onTrackEnded();
      expect(r.type).toBe("load");
    });
  });

  // ── cycleRepeat ────────────────────────────────────────────
  describe("cycleRepeat", () => {
    it("no_repeat → repeat_all → repeat_one → one_track → no_repeat 순환", () => {
      useQueueStore.setState({ repeatMode: "no_repeat" });
      const qs = useQueueStore.getState();
      qs.cycleRepeat();
      expect(useQueueStore.getState().repeatMode).toBe("repeat_all");
      qs.cycleRepeat();
      expect(useQueueStore.getState().repeatMode).toBe("repeat_one");
      qs.cycleRepeat();
      expect(useQueueStore.getState().repeatMode).toBe("one_track");
      qs.cycleRepeat();
      expect(useQueueStore.getState().repeatMode).toBe("no_repeat");
    });
  });

  // ── setShuffle ─────────────────────────────────────────────
  describe("setShuffle", () => {
    it("켤 때 currentIndex 제외한 unplayed 풀을 구성한다", () => {
      useQueueStore.setState({
        items: [...T],
        currentIndex: 2,
        shuffle: false,
        unplayed: [],
        history: [],
        repeatMode: "no_repeat",
      });
      useQueueStore.getState().setShuffle(true);
      const s = useQueueStore.getState();
      expect(s.shuffle).toBe(true);
      expect(s.unplayed).not.toContain(2);
      expect(s.unplayed).toHaveLength(4);
    });

    it("끌 때 unplayed와 history를 비운다", () => {
      useQueueStore.setState({
        items: [...T],
        currentIndex: 2,
        shuffle: true,
        unplayed: [0, 1, 3],
        history: [4],
        repeatMode: "no_repeat",
      });
      useQueueStore.getState().setShuffle(false);
      const s = useQueueStore.getState();
      expect(s.shuffle).toBe(false);
      expect(s.unplayed).toHaveLength(0);
      expect(s.history).toHaveLength(0);
    });
  });
});
