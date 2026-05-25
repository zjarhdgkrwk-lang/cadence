import { create } from "zustand";
import type { Track, PlayerStatus, ReplaygainMode } from "../lib/types";

interface PlayerState {
  status: PlayerStatus;
  currentTrack: Track | null;
  positionMs: number;
  durationMs: number;
  volume: number;
  muted: boolean;
  speed: number;
  replaygainMode: ReplaygainMode;
  /** 재생 통계 중복 카운트 방지 (트랙 로드 시 리셋) */
  _statCredited: boolean;

  // controller 전용 mutators (밑줄 prefix = 외부 직접 호출 금지)
  _transition: (status: PlayerStatus) => void;
  _setTrack: (track: Track | null) => void;
  _setPosition: (ms: number) => void;
  _setDuration: (ms: number) => void;
  _setVolume: (v: number) => void;
  _setMuted: (m: boolean) => void;
  _setSpeed: (v: number) => void;
  _setReplaygainMode: (m: ReplaygainMode) => void;
  _creditStat: () => void;
  _resetStat: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  status: "idle",
  currentTrack: null,
  positionMs: 0,
  durationMs: 0,
  volume: 1,
  muted: false,
  speed: 1,
  replaygainMode: "track",
  _statCredited: false,

  _transition: (status) => set({ status }),
  _setTrack: (currentTrack) => set({ currentTrack }),
  _setPosition: (positionMs) => set({ positionMs }),
  _setDuration: (durationMs) => set({ durationMs }),
  _setVolume: (volume) => set({ volume }),
  _setMuted: (muted) => set({ muted }),
  _setSpeed: (speed) => set({ speed }),
  _setReplaygainMode: (replaygainMode) => set({ replaygainMode }),
  _creditStat: () => set({ _statCredited: true }),
  _resetStat: () => set({ _statCredited: false }),
}));
