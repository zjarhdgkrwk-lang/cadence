/**
 * SMTC(Windows 미디어 오버레이) 동기화 훅.
 *
 * 변경 이력:
 *  - BigInt 직렬화 오류(IPC 무음 실패) 방지: ipc.ts에서 number 직렬화로 수정.
 *  - 초기 마운트 시 현재 상태로 즉시 1회 동기화 (세션 복원된 트랙 즉시 반영).
 *  - 모든 IPC 호출 직전 "[FE] [smtc]" 로그를 남겨 Rust 도달 여부 확인 가능.
 *
 * 동기화 타이밍:
 *  - 마운트 즉시: 현재 상태 1회 강제 동기화
 *  - 트랙 변경  → 즉시 metadata + playback 갱신
 *  - 상태 변경  → 즉시 playback 갱신 (playing/paused/stopped)
 *  - 재생 중 위치 → 1초 스로틀 (SMTC 타임라인용)
 */
import { useEffect, useRef } from "react";
import { usePlayerStore } from "../stores/playerStore";
import { updateSmtcMetadata, updateSmtcPlayback } from "../lib/ipc";
import type { Track, PlayerStatus } from "../lib/types";

function toSmtcStatus(status: PlayerStatus): "playing" | "paused" | "stopped" {
  if (status === "playing" || status === "buffering") return "playing";
  if (status === "paused" || status === "ready" || status === "seeking") return "paused";
  // idle | loading | ended | error → stopped
  return "stopped";
}

function syncMetadata(track: Track): void {
  console.info(
    `[FE] [smtc] meta dispatch title="${track.title}" artist="${track.artist}" ` +
    `art=${track.art_cache_path ?? "none"}`
  );
  updateSmtcMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album,
    artPath: track.art_cache_path ?? null,
    durationMs: track.duration_ms ?? null,
  }).catch((e) => console.warn("[FE] [smtc] metadata IPC failed:", e));
}

function syncPlayback(
  status: "playing" | "paused" | "stopped",
  positionMs: number
): void {
  console.info(`[FE] [smtc] playback dispatch status=${status} pos=${Math.round(positionMs)}`);
  updateSmtcPlayback({ status, positionMs }).catch(
    (e) => console.warn("[FE] [smtc] playback IPC failed:", e)
  );
}

export function useSmtc(): void {
  const posThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // ── 1. 초기 마운트 즉시 동기화 ─────────────────────────────────────────
    // 세션 복원 후 subscribe가 fired되기 전에 이미 트랙이 있는 경우를 커버.
    // 또한 subscribe 이전에 일어난 상태 변경도 반영한다.
    const initial = usePlayerStore.getState();
    let lastTrackId: number | null = initial.currentTrack?.id ?? null;
    let lastSmtcStatus: "playing" | "paused" | "stopped" = toSmtcStatus(initial.status);

    if (initial.currentTrack) {
      syncMetadata(initial.currentTrack);
    }
    syncPlayback(lastSmtcStatus, initial.positionMs);

    // ── 2. 이후 상태 변화 구독 ─────────────────────────────────────────────
    const unsubscribe = usePlayerStore.subscribe((s) => {
      const smtcStatus = toSmtcStatus(s.status);
      const trackChanged = (s.currentTrack?.id ?? null) !== lastTrackId;
      const statusChanged = smtcStatus !== lastSmtcStatus;

      // ── 트랙 변경: 메타 + 재생 상태 즉시 갱신 ──────────────────────────
      if (trackChanged) {
        lastTrackId = s.currentTrack?.id ?? null;
        lastSmtcStatus = smtcStatus;

        if (posThrottleRef.current) {
          clearTimeout(posThrottleRef.current);
          posThrottleRef.current = null;
        }

        if (s.currentTrack) {
          syncMetadata(s.currentTrack);
          syncPlayback(smtcStatus, s.positionMs);
        } else {
          // 트랙 없음 → SMTC 정지
          syncPlayback("stopped", 0);
        }
        return;
      }

      // ── 재생 상태 변경: 즉시 갱신 ─────────────────────────────────────
      if (statusChanged) {
        lastSmtcStatus = smtcStatus;

        if (posThrottleRef.current) {
          clearTimeout(posThrottleRef.current);
          posThrottleRef.current = null;
        }

        syncPlayback(smtcStatus, s.positionMs);
        return;
      }

      // ── 재생 중 위치 업데이트: 1초 스로틀 ─────────────────────────────
      if (smtcStatus === "playing" && !posThrottleRef.current) {
        posThrottleRef.current = setTimeout(() => {
          posThrottleRef.current = null;
          const cur = usePlayerStore.getState();
          const curStatus = toSmtcStatus(cur.status);
          syncPlayback(curStatus, cur.positionMs);
        }, 1000);
      }
    });

    return () => {
      unsubscribe();
      if (posThrottleRef.current) {
        clearTimeout(posThrottleRef.current);
        posThrottleRef.current = null;
      }
    };
  }, []);
}
