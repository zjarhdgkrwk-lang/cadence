import { convertFileSrc } from "@tauri-apps/api/core";
import { usePlayerStore } from "../stores/playerStore";
import { useQueueStore } from "../stores/queueStore";
import { scheduleSave } from "./persist";
import { updatePlayStats } from "./ipc";
import type { Track, PlayerStatus, QueueSource } from "./types";

export interface IPlayerController {
  mountAudio(el: HTMLAudioElement): void;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(ms: number): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  next(): void;
  prev(): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
  playTrack(track: Track): void;
  replaceQueueAndPlay(tracks: Track[], startIndex: number, source?: QueueSource): void;
  addToQueueNext(track: Track): void;
  addToQueueEnd(track: Track): void;
  /** 앱 복원용: 자동 재생 없이 지정 트랙+위치로 준비 */
  restoreSession(track: Track | null, positionMs: number): void;
}

class PlayerController implements IPlayerController {
  private _audio: HTMLAudioElement | null = null;
  private _rafId: number | null = null;
  /** canplay 수신 시 자동 재생 여부 */
  private _playOnLoad = false;
  /** canplay 수신 시 seek할 위치 (복원용) */
  private _seekOnLoad: number | null = null;
  /** 연속 에러 횟수 (무한 skip 루프 방지) */
  private _errorCount = 0;
  /** 마지막 에러 발생 시각 (연쇄 에러 감지용) */
  private _lastErrorMs = 0;

  // ── Audio element ────────────────────────────────────────────

  mountAudio(el: HTMLAudioElement) {
    if (this._audio === el) return;
    this._detach();
    this._audio = el;
    this._attach();
    const { volume, muted } = usePlayerStore.getState();
    el.volume = volume;
    el.muted = muted;
  }

  private _attach() {
    const a = this._audio!;
    a.addEventListener("canplay", this._onCanPlay);
    a.addEventListener("playing", this._onPlaying);
    a.addEventListener("pause", this._onPause);
    a.addEventListener("waiting", this._onWaiting);
    a.addEventListener("stalled", this._onWaiting);
    a.addEventListener("ended", this._onEnded);
    a.addEventListener("error", this._onError);
    a.addEventListener("durationchange", this._onDurationChange);
  }

  private _detach() {
    const a = this._audio;
    if (!a) return;
    a.removeEventListener("canplay", this._onCanPlay);
    a.removeEventListener("playing", this._onPlaying);
    a.removeEventListener("pause", this._onPause);
    a.removeEventListener("waiting", this._onWaiting);
    a.removeEventListener("stalled", this._onWaiting);
    a.removeEventListener("ended", this._onEnded);
    a.removeEventListener("error", this._onError);
    a.removeEventListener("durationchange", this._onDurationChange);
  }

  // ── RAF position loop ────────────────────────────────────────

  private _startRaf() {
    this._stopRaf();
    const tick = () => {
      const a = this._audio;
      if (a && a.readyState >= 2) {
        const posMs = a.currentTime * 1000;
        usePlayerStore.getState()._setPosition(posMs);
        this._checkPlayStats(posMs);
      }
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  private _stopRaf() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /** 재생 시간이 50% 또는 30초 이상이면 1회 통계 기록 */
  private _checkPlayStats(posMs: number) {
    const ps = usePlayerStore.getState();
    if (ps._statCredited || !ps.currentTrack || !ps.durationMs) return;
    if (posMs >= ps.durationMs * 0.5 || posMs >= 30_000) {
      ps._creditStat();
      updatePlayStats(ps.currentTrack.id).catch(() => {});
    }
  }

  // ── Audio event handlers ─────────────────────────────────────

  private _onCanPlay = () => {
    if (usePlayerStore.getState().status !== "loading") return;
    usePlayerStore.getState()._transition("ready");

    if (this._seekOnLoad !== null) {
      const target = this._seekOnLoad;
      this._seekOnLoad = null;
      const a = this._audio!;
      a.currentTime = target / 1000;
      usePlayerStore.getState()._setPosition(target);
    }

    if (this._playOnLoad) {
      this._playOnLoad = false;
      this._audio?.play().catch(() => {});
    }
  };

  private _onPlaying = () => {
    usePlayerStore.getState()._transition("playing");
    this._startRaf();
  };

  private _onPause = () => {
    const { status } = usePlayerStore.getState();
    if (status === "seeking") return; // seeking이 발생시킨 pause — 무시
    usePlayerStore.getState()._transition("paused");
    this._stopRaf();
    scheduleSave();
  };

  private _onWaiting = () => {
    if (usePlayerStore.getState().status === "playing") {
      usePlayerStore.getState()._transition("buffering");
    }
  };

  private _onEnded = () => {
    usePlayerStore.getState()._transition("ended");
    this._stopRaf();
    this._applyRepeat();
  };

  private _onError = () => {
    const { status } = usePlayerStore.getState();
    const recoverable: PlayerStatus[] = [
      "loading",
      "ready",
      "playing",
      "buffering",
    ];
    if (!recoverable.includes(status)) return;

    // [진단] 오디오 에러 원인 로그
    const a = this._audio;
    const errCode = a?.error?.code ?? "?";
    const errMsg = a?.error?.message ?? "";
    const src = a?.src ?? "";
    console.error(
      `[PlayerController] audio error  code=${errCode}  src=${src}\n` +
        `  MediaError.message: ${errMsg}\n` +
        `  code 1=ABORTED 2=NETWORK 3=DECODE 4=SRC_NOT_SUPPORTED`
    );

    usePlayerStore.getState()._transition("error");
    this._stopRaf();
    this._skipOnError();
  };

  private _onDurationChange = () => {
    const a = this._audio;
    if (!a || isNaN(a.duration) || !isFinite(a.duration)) return;
    usePlayerStore.getState()._setDuration(a.duration * 1000);
  };

  // ── Repeat / error-skip ──────────────────────────────────────

  private _applyRepeat() {
    const result = useQueueStore.getState().onTrackEnded();
    if (result.type === "idle") {
      usePlayerStore.getState()._transition("idle");
    } else {
      this._loadAndPlay(result.track);
    }
    scheduleSave();
  }

  private _skipOnError() {
    const now = Date.now();
    const isRapid = now - this._lastErrorMs < 500; // 500ms 내 연속 에러
    this._lastErrorMs = now;
    this._errorCount++;

    const { items } = useQueueStore.getState();

    // 500ms 내 2회 이상 연속 에러 = 권한/설정/코덱 문제로 판단 → 즉시 중단
    // (개별 missing 파일 스킵과 달리, 시스템 전체 문제는 스킵을 계속해도 무의미)
    if (isRapid && this._errorCount >= 2) {
      console.error(
        `[PlayerController] 연속 오류 ${this._errorCount}회 감지 — ` +
          `스킵 중단. ` +
          `원인: asset scope 미포함, 코덱 미지원, 또는 권한 거부일 가능성 높음.\n` +
          `→ tauri.conf.json assetProtocol.scope 또는 파일 경로를 확인하세요.`
      );
      this._errorCount = 0;
      this._lastErrorMs = 0;
      // track은 유지하고 error 상태로 남겨 사용자가 원인 파악 가능하게 함
      usePlayerStore.getState()._transition("error");
      return;
    }

    // 전체 트랙 모두 실패한 경우
    if (this._errorCount >= Math.max(items.length, 1)) {
      console.error(
        `[PlayerController] 전체 ${items.length}곡 모두 오류 — Idle 전환`
      );
      this._errorCount = 0;
      this._lastErrorMs = 0;
      usePlayerStore.getState()._transition("idle");
      usePlayerStore.getState()._setTrack(null);
      return;
    }

    // 개별 곡 오류: 다음 곡으로 스킵
    const result = useQueueStore.getState().navigateNext();
    if (result) {
      this._loadAndPlay(result.track);
    } else {
      this._errorCount = 0;
      this._lastErrorMs = 0;
      usePlayerStore.getState()._transition("idle");
      usePlayerStore.getState()._setTrack(null);
    }
  }

  // ── Internal track loading ───────────────────────────────────

  /** convertFileSrc 사용 (WebView2에서 file:// 직접 차단) */
  private _loadTrack(track: Track) {
    const a = this._audio;
    if (!a) return;
    const ps = usePlayerStore.getState();
    ps._resetStat();
    ps._setTrack(track);
    ps._setPosition(0);
    ps._setDuration(0);
    ps._transition("loading");

    const src = convertFileSrc(track.path);
    // [진단] src 확인 — 이 URL이 asset scope에 포함돼야 재생 가능
    console.log(`[PlayerController] loadTrack  path="${track.path}"  →  src="${src}"`);

    a.src = src;
    a.load();
  }

  private _loadAndPlay(track: Track) {
    this._playOnLoad = true;
    this._loadTrack(track);
    scheduleSave();
  }

  // ── Public interface ─────────────────────────────────────────

  play() {
    const { status } = usePlayerStore.getState();
    if (status === "idle" || status === "loading") return;
    this._audio?.play().catch(() => {});
  }

  pause() {
    this._audio?.pause();
  }

  toggle() {
    const { status } = usePlayerStore.getState();
    if (status === "playing" || status === "buffering") {
      this.pause();
    } else if (status === "paused" || status === "ready") {
      this.play();
    } else if (status === "idle") {
      const qs = useQueueStore.getState();
      if (qs.items.length > 0 && qs.currentIndex >= 0) {
        this._loadAndPlay(qs.items[qs.currentIndex]);
      }
    }
  }

  seek(ms: number) {
    const a = this._audio;
    if (!a) return;
    const ps = usePlayerStore.getState();
    const { status } = ps;

    // 일반 재생 상태: 항상 허용
    const inNormal = (
      ["playing", "paused", "buffering", "ready", "seeking"] as PlayerStatus[]
    ).includes(status);
    // 곡이 끝난 후(one_track/no_repeat 등) — idle/ended 이지만 트랙이 남아있으면
    // 되감기를 허용해 다시 들을 수 있게 한다
    const inPostEnd =
      (status === "idle" || status === "ended") && ps.currentTrack !== null;

    if (!inNormal && !inPostEnd) {
      console.warn(
        `[PlayerController] seek blocked  status=${status}  track=${ps.currentTrack?.id ?? "none"}`
      );
      return;
    }

    const clamped = Math.max(0, ms);
    a.currentTime = clamped / 1000;
    ps._setPosition(clamped);

    // 종료/Idle 상태에서 seek → Paused로 전이해 play 버튼으로 즉시 재개 가능
    if (inPostEnd) {
      ps._transition("paused");
      console.info(
        `[PlayerController] seek from ${status} → paused  posMs=${Math.round(clamped)}`
      );
    }

    scheduleSave();
  }

  setVolume(v: number) {
    const clamped = Math.max(0, Math.min(1, v));
    if (this._audio) this._audio.volume = clamped;
    usePlayerStore.getState()._setVolume(clamped);
    scheduleSave();
  }

  setMuted(m: boolean) {
    if (this._audio) this._audio.muted = m;
    usePlayerStore.getState()._setMuted(m);
    scheduleSave();
  }

  next() {
    const result = useQueueStore.getState().navigateNext();
    if (result) {
      this._errorCount = 0;
      this._loadAndPlay(result.track);
    }
  }

  prev() {
    const result = useQueueStore.getState().navigatePrev();
    if (result) {
      this._errorCount = 0;
      this._loadAndPlay(result.track);
    } else {
      // 히스토리 없음(셔플) 또는 첫 곡(순차) → 현재 곡 처음으로
      this.seek(0);
    }
  }

  toggleShuffle() {
    const { shuffle } = useQueueStore.getState();
    useQueueStore.getState().setShuffle(!shuffle);
    scheduleSave();
  }

  cycleRepeat() {
    useQueueStore.getState().cycleRepeat();
    scheduleSave();
  }

  playTrack(track: Track) {
    this._errorCount = 0;
    this._loadAndPlay(track);
  }

  replaceQueueAndPlay(tracks: Track[], startIndex: number, source?: QueueSource) {
    if (tracks.length === 0) return;
    this._errorCount = 0;
    const si = Math.max(0, Math.min(startIndex, tracks.length - 1));
    useQueueStore.getState().replaceQueue(tracks, si, source);
    this._loadAndPlay(tracks[si]);
  }

  addToQueueNext(track: Track) {
    useQueueStore.getState().addToQueueNext(track);
    scheduleSave();
  }

  addToQueueEnd(track: Track) {
    useQueueStore.getState().addToQueueEnd(track);
    scheduleSave();
  }

  restoreSession(track: Track | null, positionMs: number) {
    if (!track) return;
    const ps = usePlayerStore.getState();
    ps._setTrack(track);
    ps._setPosition(positionMs);
    ps._transition("paused");
    // 오디오 프리로드 (자동 재생 없음)
    this._seekOnLoad = positionMs > 0 ? positionMs : null;
    this._playOnLoad = false;
    this._loadTrack(track);
  }
}

export const controller = new PlayerController();
