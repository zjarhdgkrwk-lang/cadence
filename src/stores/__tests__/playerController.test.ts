import { describe, beforeEach, it, expect, vi } from "vitest";
import { usePlayerStore } from "../playerStore";
import { useQueueStore } from "../queueStore";
import type { Track, PlayerStatus } from "../../lib/types";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (p: string) => `asset://${p}`,
}));
vi.mock("../../lib/ipc", () => ({
  updatePlayStats: vi.fn().mockResolvedValue(undefined),
  logFrontend: vi.fn(),
  openLogFolder: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/persist", () => ({
  scheduleSave: vi.fn(),
}));

import { controller } from "../../lib/playerController";

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
    lyrics_source: "none",
    missing: false,
    date_added: 0,
    last_played_at: null,
    play_count: 0,
  };
}

function createMockAudio(): HTMLAudioElement {
  let ct = 0;
  return {
    get currentTime() { return ct; },
    set currentTime(v: number) { ct = v; },
    src: "",
    volume: 1,
    muted: false,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    load: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    error: null,
    readyState: 4,
    ended: false,
  } as unknown as HTMLAudioElement;
}

const BASE_STORE_STATE = {
  status: "idle" as PlayerStatus,
  currentTrack: null,
  positionMs: 0,
  durationMs: 0,
  volume: 1,
  muted: false,
  _statCredited: false,
};

let audio: HTMLAudioElement;

describe("PlayerController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePlayerStore.setState(BASE_STORE_STATE);
    useQueueStore.setState({
      items: [],
      currentIndex: -1,
      history: [],
      unplayed: [],
      shuffle: false,
      repeatMode: "no_repeat",
    });
    audio = createMockAudio();
    controller.mountAudio(audio);
  });

  // ── seek ─────────────────────────────────────────────────────

  describe("seek", () => {
    it("playing 상태에서 seek하면 위치만 변경되고 status 유지", () => {
      const track = mkTrack(1);
      usePlayerStore.setState({
        ...BASE_STORE_STATE,
        status: "playing",
        currentTrack: track,
        durationMs: 180_000,
        positionMs: 0,
      });

      controller.seek(90_000);

      const ps = usePlayerStore.getState();
      expect(ps.status).toBe("playing");
      expect(ps.positionMs).toBe(90_000);
      expect(audio.currentTime).toBe(90);
    });

    it("paused 상태에서 seek하면 위치만 변경되고 paused 유지", () => {
      const track = mkTrack(1);
      usePlayerStore.setState({
        ...BASE_STORE_STATE,
        status: "paused",
        currentTrack: track,
        durationMs: 180_000,
        positionMs: 10_000,
      });

      controller.seek(60_000);

      const ps = usePlayerStore.getState();
      expect(ps.status).toBe("paused");
      expect(ps.positionMs).toBe(60_000);
      expect(audio.currentTime).toBe(60);
    });

    // ── 핵심 버그 재현 및 수정 검증 ────────────────────────────

    it("[one_track 버그] idle + track 있음 → seek 허용 후 paused 전이", () => {
      const track = mkTrack(1);
      // one_track 종료 후 상태: status=idle, track은 남아있음
      usePlayerStore.setState({
        ...BASE_STORE_STATE,
        status: "idle",
        currentTrack: track,
        durationMs: 180_000,
        positionMs: 180_000, // 곡 끝 위치
      });

      controller.seek(45_000);

      const ps = usePlayerStore.getState();
      expect(ps.status).toBe("paused");      // idle → paused 전이
      expect(ps.positionMs).toBe(45_000);    // 요청 위치로 이동
      expect(audio.currentTime).toBe(45);    // audio element도 동기화
    });

    it("ended + track 있음 → seek 허용 후 paused 전이", () => {
      const track = mkTrack(2);
      usePlayerStore.setState({
        ...BASE_STORE_STATE,
        status: "ended",
        currentTrack: track,
        durationMs: 180_000,
        positionMs: 180_000,
      });

      controller.seek(30_000);

      const ps = usePlayerStore.getState();
      expect(ps.status).toBe("paused");
      expect(ps.positionMs).toBe(30_000);
      expect(audio.currentTime).toBe(30);
    });

    it("idle + track 없음 → seek 차단, 위치·status 불변", () => {
      usePlayerStore.setState({
        ...BASE_STORE_STATE,
        status: "idle",
        currentTrack: null,
        durationMs: 0,
        positionMs: 0,
      });

      controller.seek(60_000);

      const ps = usePlayerStore.getState();
      expect(ps.status).toBe("idle");   // 변경 없음
      expect(ps.positionMs).toBe(0);    // 변경 없음
      expect(audio.currentTime).toBe(0);
    });

    it("seek 후 paused 상태에서 play() 호출 가능 (정상 재생 흐름)", () => {
      const track = mkTrack(3);
      // 종료 후 seek → paused 전이 이후
      usePlayerStore.setState({
        ...BASE_STORE_STATE,
        status: "idle",
        currentTrack: track,
        durationMs: 180_000,
        positionMs: 180_000,
      });

      controller.seek(0);
      expect(usePlayerStore.getState().status).toBe("paused");

      // paused 상태에서 play() 호출 시 audio.play()가 실행돼야 함
      controller.play();
      expect(audio.play).toHaveBeenCalled();
    });

    it("음수 seek은 0으로 클램프", () => {
      const track = mkTrack(4);
      usePlayerStore.setState({
        ...BASE_STORE_STATE,
        status: "paused",
        currentTrack: track,
        durationMs: 180_000,
        positionMs: 50_000,
      });

      controller.seek(-1_000);

      expect(usePlayerStore.getState().positionMs).toBe(0);
      expect(audio.currentTime).toBe(0);
    });
  });
});
