import { create } from "zustand";
import type { Track, RepeatMode } from "../lib/types";

const REPEAT_CYCLE: RepeatMode[] = [
  "no_repeat",
  "repeat_all",
  "repeat_one",
  "one_track",
];

function randomFrom(arr: number[]): number {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** currentIndex를 제외한 전체 인덱스 배열 */
function buildUnplayed(length: number, excludeIndex: number): number[] {
  return Array.from({ length }, (_, i) => i).filter((i) => i !== excludeIndex);
}

type NavResult = { track: Track; index: number } | null;
type EndedResult =
  | { type: "load"; track: Track; index: number }
  | { type: "idle" };

interface QueueState {
  items: Track[];
  currentIndex: number;
  /** 셔플 재생 이전 곡 복귀용 스택 (이전에 재생한 인덱스) */
  history: number[];
  /** 셔플 미재생 인덱스 풀 */
  unplayed: number[];
  shuffle: boolean;
  repeatMode: RepeatMode;

  // ── Actions ──────────────────────────────────────────────────
  replaceQueue: (tracks: Track[], startIndex: number) => void;
  addToQueueNext: (track: Track) => void;
  addToQueueEnd: (track: Track) => void;
  /** 다음 트랙으로 이동. null = 정지 필요 */
  navigateNext: () => NavResult;
  /** 이전 트랙으로 이동. null = seek(0) 필요 */
  navigatePrev: () => NavResult;
  /** 트랙 종료 시 반복 모드 적용 */
  onTrackEnded: () => EndedResult;
  setShuffle: (on: boolean) => void;
  cycleRepeat: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  playIndex: (index: number) => Track | null;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  items: [],
  currentIndex: -1,
  history: [],
  unplayed: [],
  shuffle: false,
  repeatMode: "no_repeat",

  replaceQueue(tracks, startIndex) {
    const si = Math.max(0, Math.min(startIndex, tracks.length - 1));
    set({
      items: tracks,
      currentIndex: si,
      history: [],
      unplayed: get().shuffle ? buildUnplayed(tracks.length, si) : [],
    });
  },

  addToQueueNext(track) {
    const { items, currentIndex, unplayed, history, shuffle } = get();
    const insertAt = Math.max(currentIndex + 1, 0);
    const newItems = [
      ...items.slice(0, insertAt),
      track,
      ...items.slice(insertAt),
    ];
    // 삽입 위치 이후 인덱스를 +1 보정
    const shift = (i: number) => (i >= insertAt ? i + 1 : i);
    const newUnplayed = shuffle
      ? [...unplayed.map(shift), insertAt]
      : unplayed;
    set({
      items: newItems,
      unplayed: newUnplayed,
      history: history.map(shift),
    });
  },

  addToQueueEnd(track) {
    const { items, unplayed, shuffle } = get();
    const newIdx = items.length;
    set({
      items: [...items, track],
      unplayed: shuffle ? [...unplayed, newIdx] : unplayed,
    });
  },

  navigateNext() {
    const { items, currentIndex, history, unplayed, shuffle, repeatMode } =
      get();
    if (items.length === 0) return null;

    if (shuffle) {
      let pool = [...unplayed];
      if (pool.length === 0) {
        if (repeatMode === "repeat_all") {
          // 새 셔플 사이클: 전체 인덱스로 재구성
          pool = Array.from({ length: items.length }, (_, i) => i);
        } else {
          return null;
        }
      }
      const nextIdx = randomFrom(pool);
      set({
        currentIndex: nextIdx,
        history: [...history, currentIndex],
        unplayed: pool.filter((i) => i !== nextIdx),
      });
      return { track: items[nextIdx], index: nextIdx };
    }

    // shuffle off: 순차
    const nextIdx = currentIndex + 1;
    if (nextIdx >= items.length) return null;
    set({ currentIndex: nextIdx });
    return { track: items[nextIdx], index: nextIdx };
  },

  navigatePrev() {
    const { items, currentIndex, history, unplayed, shuffle } = get();
    if (items.length === 0) return null;

    if (shuffle && history.length > 0) {
      const prevIdx = history[history.length - 1];
      // 현재 곡을 미재생 풀에 돌려놓음
      set({
        currentIndex: prevIdx,
        history: history.slice(0, -1),
        unplayed: [...unplayed, currentIndex],
      });
      return { track: items[prevIdx], index: prevIdx };
    }

    if (!shuffle && currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      set({ currentIndex: prevIdx });
      return { track: items[prevIdx], index: prevIdx };
    }

    // 히스토리 없음(셔플) 또는 첫 곡(순차) → null → controller가 seek(0) 처리
    return null;
  },

  onTrackEnded() {
    const { items, currentIndex, history, unplayed, shuffle, repeatMode } =
      get();
    if (items.length === 0) return { type: "idle" };

    // 한 곡 반복: 동일 트랙 재시작
    if (repeatMode === "repeat_one") {
      return { type: "load", track: items[currentIndex], index: currentIndex };
    }

    // 한 곡만: 정지
    if (repeatMode === "one_track") {
      return { type: "idle" };
    }

    // 셔플 모드
    if (shuffle) {
      let pool = [...unplayed];
      if (pool.length === 0) {
        if (repeatMode === "repeat_all") {
          pool = Array.from({ length: items.length }, (_, i) => i);
        } else {
          return { type: "idle" };
        }
      }
      const nextIdx = randomFrom(pool);
      set({
        currentIndex: nextIdx,
        history: [...history, currentIndex],
        unplayed: pool.filter((i) => i !== nextIdx),
      });
      return { type: "load", track: items[nextIdx], index: nextIdx };
    }

    // 순차: 다음 인덱스
    const nextIdx = currentIndex + 1;
    if (nextIdx < items.length) {
      set({ currentIndex: nextIdx });
      return { type: "load", track: items[nextIdx], index: nextIdx };
    }

    // 큐 끝
    if (repeatMode === "repeat_all") {
      set({ currentIndex: 0 });
      return { type: "load", track: items[0], index: 0 };
    }

    return { type: "idle" };
  },

  setShuffle(on) {
    const { items, currentIndex } = get();
    if (on) {
      set({
        shuffle: true,
        unplayed: buildUnplayed(items.length, currentIndex),
        history: [],
      });
    } else {
      set({ shuffle: false, unplayed: [], history: [] });
    }
  },

  cycleRepeat() {
    const idx = REPEAT_CYCLE.indexOf(get().repeatMode);
    set({ repeatMode: REPEAT_CYCLE[(idx + 1) % REPEAT_CYCLE.length] });
  },

  setRepeatMode(mode) {
    set({ repeatMode: mode });
  },

  playIndex(index) {
    const { items, currentIndex, history, unplayed, shuffle } = get();
    if (index < 0 || index >= items.length) return null;
    set({
      currentIndex: index,
      history: currentIndex >= 0 ? [...history, currentIndex] : history,
      unplayed: shuffle ? unplayed.filter((i) => i !== index) : unplayed,
    });
    return items[index];
  },
}));
