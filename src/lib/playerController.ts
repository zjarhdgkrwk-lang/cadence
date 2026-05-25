import { convertFileSrc } from "@tauri-apps/api/core";
import { usePlayerStore } from "../stores/playerStore";
import { useQueueStore } from "../stores/queueStore";
import { scheduleSave } from "./persist";
import { updatePlayStats } from "./ipc";
import type { Track, PlayerStatus, QueueSource, ReplaygainMode } from "./types";

// ─────────────────────────────────────────────────────────────
// 갭리스 상수
// ─────────────────────────────────────────────────────────────
/** 곡 종료까지 이 시간(ms) 이내 진입 시 다음 곡 프리로드 시작 */
const PRELOAD_THRESHOLD_MS = 8_000;
/** 스왑에 필요한 최소 readyState (HAVE_FUTURE_DATA = 3) */
const READYSTATE_ENOUGH = 3;

// ─────────────────────────────────────────────────────────────
// 인터페이스
// ─────────────────────────────────────────────────────────────
export interface IPlayerController {
  mountAudio(primary: HTMLAudioElement, secondary: HTMLAudioElement): void;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(ms: number): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  setSpeed(rate: number): void;
  setReplaygainMode(mode: ReplaygainMode): void;
  next(): void;
  prev(): void;
  toggleShuffle(): void;
  cycleRepeat(): void;
  playTrack(track: Track): void;
  replaceQueueAndPlay(tracks: Track[], startIndex: number, source?: QueueSource): void;
  addToQueueNext(track: Track): void;
  addToQueueEnd(track: Track): void;
  /** 앱 복원용: 자동 재생 없이 지정 트랙+위치로 준비 (Paused 상태로 복원) */
  restoreSession(track: Track | null, positionMs: number): void;
}

// ─────────────────────────────────────────────────────────────
// PlayerController
// ─────────────────────────────────────────────────────────────
class PlayerController implements IPlayerController {
  /** 현재 재생 중인 오디오 엘리먼트. 모든 이벤트 리스너가 여기 부착됨. */
  private _audioA: HTMLAudioElement | null = null;
  /** 다음 곡 프리로드 전용 엘리먼트. canplay/error 리스너만 부착. */
  private _audioB: HTMLAudioElement | null = null;

  private _rafId: number | null = null;
  /** canplay 수신 시 자동 재생 여부 */
  private _playOnLoad = false;
  /** canplay 수신 시 seek할 위치 (복원용) */
  private _seekOnLoad: number | null = null;
  /** 연속 에러 횟수 (무한 skip 루프 방지) */
  private _errorCount = 0;
  /** 마지막 에러 발생 시각 (연쇄 에러 감지용) */
  private _lastErrorMs = 0;

  // ── 프리로드 상태 ──────────────────────────────────────────
  /** _audioB에 현재 로드 중인 트랙 ID. null = 미프리로드. */
  private _preloadedTrackId: number | null = null;

  // ── Audio element mount ──────────────────────────────────────

  mountAudio(primary: HTMLAudioElement, secondary: HTMLAudioElement) {
    // 기존 연결 해제
    this._detachActive();
    this._detachPreload();

    this._audioA = primary;
    this._audioB = secondary;

    this._attachActive();
    // secondary는 필요할 때 _attachPreload()로 리스너를 붙임

    // preservesPitch: WebView2(Chromium 기반)에서 지원. 배속 변경 시 피치 보존.
    for (const el of [primary, secondary]) {
      el.preload = "auto";
      el.preservesPitch = true; // 배속 변경 시 피치 보존 (WebView2/Chromium 지원)
    }

    const { volume, muted, speed } = usePlayerStore.getState();
    primary.volume = volume;
    primary.muted = muted;
    primary.playbackRate = speed;
    secondary.volume = volume; // 프리로드 시 ReplayGain으로 재설정됨
    secondary.muted = muted;
    secondary.playbackRate = speed;
  }

  // ── Active 리스너 관리 (_audioA 전용) ─────────────────────────

  private _attachActive() {
    const a = this._audioA;
    if (!a) return;
    a.addEventListener("canplay", this._onCanPlay);
    a.addEventListener("playing", this._onPlaying);
    a.addEventListener("pause", this._onPause);
    a.addEventListener("waiting", this._onWaiting);
    a.addEventListener("stalled", this._onWaiting);
    a.addEventListener("ended", this._onEnded);
    a.addEventListener("error", this._onError);
    a.addEventListener("durationchange", this._onDurationChange);
  }

  private _detachActive() {
    const a = this._audioA;
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

  // ── Preload 리스너 관리 (_audioB 전용) ─────────────────────────

  private _attachPreload() {
    const b = this._audioB;
    if (!b) return;
    b.addEventListener("canplay", this._onPreloadCanPlay);
    b.addEventListener("error", this._onPreloadError);
  }

  private _detachPreload() {
    const b = this._audioB;
    if (!b) return;
    b.removeEventListener("canplay", this._onPreloadCanPlay);
    b.removeEventListener("error", this._onPreloadError);
  }

  // ── RAF position loop ─────────────────────────────────────────

  private _startRaf() {
    this._stopRaf();
    const tick = () => {
      const a = this._audioA;
      if (a && a.readyState >= 2) {
        const posMs = a.currentTime * 1000;
        usePlayerStore.getState()._setPosition(posMs);
        this._checkPlayStats(posMs);
        this._updatePreload(posMs);
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

  // ── 프리로드 관리 ─────────────────────────────────────────────

  /**
   * RAF 매 tick마다 호출. 다음 곡 프리로드 시작/무효화를 관리.
   * 프리로드 대상이 바뀌면 즉시 무효화하고 새 대상으로 교체.
   */
  private _updatePreload(posMs: number): void {
    const { durationMs } = usePlayerStore.getState();
    const nextTrack = useQueueStore.getState().peekNextTrack();

    // 프리로드 대상이 바뀐 경우 → 무효화
    if (this._preloadedTrackId !== null && nextTrack?.id !== this._preloadedTrackId) {
      console.info(
        `[gapless] preload invalidated  old=${this._preloadedTrackId}  new=${nextTrack?.id ?? "none"}`
      );
      this._clearPreload();
    }

    // 다음 트랙 없음
    if (!nextTrack) return;

    // 이미 프리로드 중
    if (this._preloadedTrackId === nextTrack.id) return;

    // 아직 임계값 밖 (duration 미확정이면 스킵)
    if (durationMs <= 0) return;
    if (durationMs - posMs > PRELOAD_THRESHOLD_MS) return;

    // 프리로드 시작
    const b = this._audioB;
    if (!b) return;

    const src = convertFileSrc(nextTrack.path);
    this._preloadedTrackId = nextTrack.id;
    this._detachPreload(); // 중복 부착 방지
    this._attachPreload();

    b.src = src;
    this._applyVolume(b, nextTrack);
    b.playbackRate = usePlayerStore.getState().speed;
    b.load();

    const remaining = Math.round(durationMs - posMs);
    console.info(`[gapless] preload start  trackId=${nextTrack.id}  remainingMs=${remaining}`);
  }

  /** 프리로드를 완전히 초기화. 다음 _updatePreload 호출 시 재시작됨. */
  private _clearPreload(): void {
    this._detachPreload();
    const b = this._audioB;
    if (b) {
      b.pause();
      b.src = "";
    }
    this._preloadedTrackId = null;
  }

  // ── Active 이벤트 핸들러 ──────────────────────────────────────

  private _onCanPlay = () => {
    if (usePlayerStore.getState().status !== "loading") return;

    // 브라우저가 src/load 시 playbackRate를 1로 초기화할 수 있으므로 재적용.
    // 수동/자동 모든 로드 경로에서 동일하게 적용되도록 보장.
    const { currentTrack } = usePlayerStore.getState();
    if (this._audioA) this._applyPlaybackParams(this._audioA, currentTrack);

    if (this._seekOnLoad !== null) {
      const target = this._seekOnLoad;
      this._seekOnLoad = null;
      const a = this._audioA!;
      a.currentTime = target / 1000;
      usePlayerStore.getState()._setPosition(target);
    }

    if (this._playOnLoad) {
      this._playOnLoad = false;
      usePlayerStore.getState()._transition("ready");
      this._audioA?.play().catch(() => {});
    } else {
      // 자동 재생 없음 (restoreSession) → Paused로 복원
      usePlayerStore.getState()._transition("paused");
    }
  };

  private _onPlaying = () => {
    usePlayerStore.getState()._transition("playing");
    this._startRaf();
  };

  private _onPause = () => {
    const { status } = usePlayerStore.getState();
    if (status === "seeking") return;
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
    const recoverable: PlayerStatus[] = ["loading", "ready", "playing", "buffering"];
    if (!recoverable.includes(status)) return;

    const a = this._audioA;
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
    const a = this._audioA;
    if (!a || isNaN(a.duration) || !isFinite(a.duration)) return;
    usePlayerStore.getState()._setDuration(a.duration * 1000);
  };

  // ── Preload 이벤트 핸들러 ─────────────────────────────────────

  private _onPreloadCanPlay = () => {
    console.info(
      `[gapless] preload ready  trackId=${this._preloadedTrackId}  readyState=${this._audioB?.readyState}`
    );
  };

  private _onPreloadError = () => {
    const b = this._audioB;
    const errCode = b?.error?.code ?? "?";
    console.warn(
      `[gapless] preload error  trackId=${this._preloadedTrackId}  code=${errCode}`
    );
    this._clearPreload();
  };

  // ── 반복 / 에러 스킵 ─────────────────────────────────────────

  private _applyRepeat() {
    const result = useQueueStore.getState().onTrackEnded();
    if (result.type === "idle") {
      usePlayerStore.getState()._transition("idle");
      scheduleSave();
      return;
    }

    const track = result.track;

    // 갭리스 스왑 조건:
    // 1) 프리로드된 트랙이 다음 재생 트랙과 동일
    // 2) _audioB가 존재하고 readyState >= HAVE_FUTURE_DATA(3)
    const canSwap =
      this._preloadedTrackId === track.id &&
      this._audioB !== null &&
      this._audioB.readyState >= READYSTATE_ENOUGH;

    if (canSwap) {
      this._performGaplessSwap(track);
    } else {
      // 폴백 사유를 로그에 기록 (Windows 검증 시 잦은 폴백 원인 파악용)
      const reason = this._audioB === null
        ? "no_secondary_audio"
        : `preloaded=${this._preloadedTrackId ?? "none"}  needed=${track.id}  readyState=${this._audioB.readyState}`;
      console.info(`[gapless] swap fallback  ${reason}`);
      this._loadAndPlay(track);
    }

    scheduleSave();
  }

  /**
   * 갭리스 스왑 실행.
   * _audioA↔_audioB 참조 교체 + 이벤트 리스너 재부착.
   * 실패 위험이 있는 경우 이 함수가 호출되지 않아야 하므로
   * 내부에서는 방어 로직보다 정확한 상태 전이에 집중한다.
   */
  private _performGaplessSwap(track: Track): void {
    // 1) 현재 active에서 리스너 모두 제거
    this._detachActive();
    // 2) preload 리스너도 제거 (새 _audioA가 될 예정이므로)
    this._detachPreload();

    // 3) 참조 교체
    const newActive = this._audioB!;
    const oldActive = this._audioA!;
    this._audioA = newActive;
    this._audioB = oldActive;

    // 4) 새 _audioA에 active 리스너 부착
    this._attachActive();

    // 5) 플레이어 스토어 상태 업데이트
    const ps = usePlayerStore.getState();
    ps._resetStat();
    ps._setTrack(track);
    ps._setPosition(0);
    ps._setDuration(
      newActive.duration && isFinite(newActive.duration)
        ? newActive.duration * 1000
        : 0
    );
    ps._transition("loading"); // playing 이벤트 수신 전까지 loading

    // 6) 볼륨(ReplayGain 포함) + 속도 적용 후 재생 시작
    this._applyPlaybackParams(this._audioA!, track);
    this._audioA!.play().catch((e) => {
      // play() 실패 시 _onError가 처리하므로 여기서는 로그만
      console.error(`[gapless] swap play() rejected:`, e);
    });

    // 7) 구 _audioA 해제 (이제 _audioB). src 초기화로 메모리 해제.
    oldActive.pause();
    oldActive.src = "";
    this._preloadedTrackId = null;

    console.info(`[gapless] swap success  trackId=${track.id}`);
    // _onPlaying 이벤트 → _transition("playing") + _startRaf 자동 처리
  }

  private _skipOnError() {
    const now = Date.now();
    const isRapid = now - this._lastErrorMs < 500;
    this._lastErrorMs = now;
    this._errorCount++;

    const { items } = useQueueStore.getState();

    if (isRapid && this._errorCount >= 2) {
      console.error(
        `[PlayerController] 연속 오류 ${this._errorCount}회 감지 — ` +
          `스킵 중단. ` +
          `원인: asset scope 미포함, 코덱 미지원, 또는 권한 거부일 가능성 높음.\n` +
          `→ tauri.conf.json assetProtocol.scope 또는 파일 경로를 확인하세요.`
      );
      this._errorCount = 0;
      this._lastErrorMs = 0;
      usePlayerStore.getState()._transition("error");
      return;
    }

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

  // ── 재생 파라미터 통합 적용 ───────────────────────────────────

  /**
   * 볼륨(ReplayGain 포함) + 속도 + preservesPitch를 audio에 적용.
   * _loadTrack / _performGaplessSwap / _onCanPlay 모든 로드 경로에서 호출.
   * 브라우저가 src/load 시 playbackRate를 리셋하는 경우를 방어함.
   */
  private _applyPlaybackParams(audio: HTMLAudioElement, track: Track | null): void {
    const { speed } = usePlayerStore.getState();
    this._applyVolume(audio, track);
    audio.playbackRate = speed;
    console.info(`[rate] applied=${speed} trackId=${track?.id ?? "?"}`);
  }

  // ── ReplayGain 볼륨 보정 ──────────────────────────────────────

  /**
   * 사용자 볼륨 × ReplayGain 게인을 계산해 audio.volume에 적용.
   * Web Audio GainNode 없이 audio.volume (0~1)로만 처리하므로 +게인은 1.0 클램프.
   * 대부분의 ReplayGain 값은 음수(과도하게 큰 트랙 감쇠)이므로 실용적.
   */
  private _applyVolume(audio: HTMLAudioElement, track: Track | null): void {
    const { volume, replaygainMode } = usePlayerStore.getState();
    let gainDb = 0;

    if (replaygainMode !== "off" && track) {
      const raw =
        replaygainMode === "album"
          ? track.replaygain_album_gain
          : track.replaygain_track_gain;
      if (raw !== null && raw !== undefined) {
        gainDb = raw;
      }
    }

    const multiplier = Math.pow(10, gainDb / 20);
    const finalVol = Math.max(0, Math.min(1, volume * multiplier));
    audio.volume = finalVol;

    if (gainDb !== 0) {
      console.info(
        `[replaygain] applied  mode=${replaygainMode}  gain=${gainDb}dB  ` +
          `userVol=${volume.toFixed(2)}  finalVol=${finalVol.toFixed(3)}`
      );
    } else if (replaygainMode !== "off") {
      console.info(`[replaygain] none  trackId=${track?.id ?? "?"}`);
    }
  }

  // ── 트랙 로드 ─────────────────────────────────────────────────

  /** convertFileSrc 사용 (WebView2에서 file:// 직접 차단) */
  private _loadTrack(track: Track) {
    const a = this._audioA;
    if (!a) return;

    // 프리로드 초기화 (새 트랙 로드 시작 시 이전 프리로드 무효)
    this._clearPreload();

    const ps = usePlayerStore.getState();
    ps._resetStat();
    ps._setTrack(track);
    ps._setPosition(0);
    ps._setDuration(0);
    ps._transition("loading");

    const src = convertFileSrc(track.path);
    console.log(`[PlayerController] loadTrack  path="${track.path}"  →  src="${src}"`);

    this._applyPlaybackParams(a, track);
    a.src = src;
    a.load();
  }

  private _loadAndPlay(track: Track) {
    this._playOnLoad = true;
    this._loadTrack(track);
    scheduleSave();
  }

  // ── Public interface ──────────────────────────────────────────

  play() {
    const { status } = usePlayerStore.getState();
    if (status === "idle" || status === "loading") return;
    this._audioA?.play().catch(() => {});
  }

  pause() {
    this._audioA?.pause();
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
    const a = this._audioA;
    if (!a) return;
    const ps = usePlayerStore.getState();
    const { status } = ps;

    const inNormal = (
      ["playing", "paused", "buffering", "ready", "seeking"] as PlayerStatus[]
    ).includes(status);
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
    usePlayerStore.getState()._setVolume(clamped);
    // ReplayGain을 반영한 실제 볼륨으로 적용
    const { currentTrack } = usePlayerStore.getState();
    if (this._audioA) this._applyVolume(this._audioA, currentTrack);
    if (this._audioA) this._audioA.muted = usePlayerStore.getState().muted;
    scheduleSave();
  }

  setMuted(m: boolean) {
    if (this._audioA) this._audioA.muted = m;
    if (this._audioB) this._audioB.muted = m;
    usePlayerStore.getState()._setMuted(m);
    scheduleSave();
  }

  setSpeed(rate: number) {
    // 0.05배 단위, [0.5, 2.0] 클램프
    const clamped = Math.max(0.5, Math.min(2.0, Math.round(rate * 20) / 20));
    usePlayerStore.getState()._setSpeed(clamped);
    if (this._audioA) this._audioA.playbackRate = clamped;
    if (this._audioB) this._audioB.playbackRate = clamped;
    console.info(`[rate] speed=${clamped}x`);
    scheduleSave();
  }

  setReplaygainMode(mode: ReplaygainMode) {
    usePlayerStore.getState()._setReplaygainMode(mode);
    // 현재 재생 트랙에 즉시 반영
    const { currentTrack } = usePlayerStore.getState();
    if (this._audioA && currentTrack) this._applyVolume(this._audioA, currentTrack);
    console.info(`[replaygain] mode=${mode}`);
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
    // 자동 재생 금지. _onCanPlay에서 _playOnLoad=false 확인 후 "paused"로 전이.
    this._playOnLoad = false;
    this._seekOnLoad = positionMs > 0 ? positionMs : null;
    this._loadTrack(track);
  }
}

export const controller = new PlayerController();
