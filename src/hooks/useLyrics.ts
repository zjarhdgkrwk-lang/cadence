import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayerStore } from "../stores/playerStore";
import { readLrcFile, updateLrcOffset } from "../lib/ipc";
import { parseLrc, applyOffset, findActiveLine } from "../lib/lrcParser";
import type { LrcLine, Track } from "../lib/types";

interface UseLyricsResult {
  lines: LrcLine[];
  /** timeMs of the active group, or -1 if none. All lines with this timeMs are active. */
  activeTimeMs: number;
  loading: boolean;
  offsetMs: number;
  adjustOffset: (deltaMs: number) => Promise<void>;
}

export function useLyrics(track: Track | null): UseLyricsResult {
  const [lines, setLines] = useState<LrcLine[]>([]);
  const [offsetMs, setOffsetMs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTimeMs, setActiveTimeMs] = useState(-1);

  // Refs to keep RAF loop free of stale closures
  const linesRef = useRef<LrcLine[]>([]);
  const rawLinesRef = useRef<LrcLine[]>([]);
  const activeTimeMsRef = useRef(-1);

  // Load LRC when track changes
  useEffect(() => {
    if (!track) {
      rawLinesRef.current = [];
      linesRef.current = [];
      setLines([]);
      setOffsetMs(0);
      setActiveTimeMs(-1);
      activeTimeMsRef.current = -1;
      return;
    }

    const initOffset = track.lrc_offset_ms;
    setOffsetMs(initOffset);
    setLines([]);
    setActiveTimeMs(-1);
    activeTimeMsRef.current = -1;
    setLoading(true);

    readLrcFile(track.id)
      .then((content) => {
        const parsed = content ? parseLrc(content) : [];
        rawLinesRef.current = parsed;
        const withOffset = applyOffset(parsed, initOffset);
        linesRef.current = withOffset;
        setLines(withOffset);
      })
      .catch(() => {
        rawLinesRef.current = [];
        linesRef.current = [];
        setLines([]);
      })
      .finally(() => setLoading(false));
  // track.id change is the only meaningful signal
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  // Permanent RAF loop: compares active timeMs (not index) so simultaneous lines
  // are all highlighted together, and state only updates on group transitions.
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      const posMs = usePlayerStore.getState().positionMs;
      const idx = findActiveLine(linesRef.current, posMs);
      const newTimeMs = idx >= 0 ? linesRef.current[idx].timeMs : -1;
      if (newTimeMs !== activeTimeMsRef.current) {
        activeTimeMsRef.current = newTimeMs;
        setActiveTimeMs(newTimeMs);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const adjustOffset = useCallback(
    async (deltaMs: number) => {
      if (!track) return;
      const newOffset = offsetMs + deltaMs;
      setOffsetMs(newOffset);
      const withOffset = applyOffset(rawLinesRef.current, newOffset);
      linesRef.current = withOffset;
      setLines(withOffset);
      await updateLrcOffset(track.id, newOffset).catch(() => {});
    },
    [track, offsetMs],
  );

  return { lines, activeTimeMs, loading, offsetMs, adjustOffset };
}
