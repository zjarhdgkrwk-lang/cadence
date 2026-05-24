import type { LrcLine } from "./types";

const TIMESTAMP_RE = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/g;
const META_RE = /^\[(?:ti|ar|al|by|offset|length|re|ve):/i;

export function parseLrc(raw: string): LrcLine[] {
  const lines: LrcLine[] = [];

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line || META_RE.test(line)) continue;

    const matches = [...line.matchAll(TIMESTAMP_RE)];
    if (!matches.length) continue;

    const lastMatch = matches[matches.length - 1];
    const text = line.slice(lastMatch.index! + lastMatch[0].length).trim();

    for (const m of matches) {
      const min = parseInt(m[1], 10);
      const sec = parseInt(m[2], 10);
      // 2-digit = centiseconds (×10 → ms), 3-digit = milliseconds
      const frac = m[3].length === 2
        ? parseInt(m[3], 10) * 10
        : parseInt(m[3], 10);
      lines.push({ timeMs: min * 60_000 + sec * 1_000 + frac, text });
    }
  }

  lines.sort((a, b) => a.timeMs - b.timeMs);
  return lines;
}

export function applyOffset(lines: LrcLine[], offsetMs: number): LrcLine[] {
  if (offsetMs === 0) return lines;
  return lines.map((l) => ({ ...l, timeMs: Math.max(0, l.timeMs + offsetMs) }));
}

/** Binary search: last line whose timeMs ≤ positionMs. Returns -1 if none. */
export function findActiveLine(lines: LrcLine[], positionMs: number): number {
  if (!lines.length) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lines[mid].timeMs <= positionMs) lo = mid;
    else hi = mid - 1;
  }
  return lines[lo].timeMs <= positionMs ? lo : -1;
}

/**
 * Expands baseIdx (from findActiveLine) to the full contiguous group of lines
 * sharing the same timeMs. Returns [firstIdx, lastIdx] inclusive.
 * Returns [-1, -1] when baseIdx < 0.
 */
export function findActiveRange(lines: LrcLine[], baseIdx: number): [number, number] {
  if (baseIdx < 0 || !lines.length) return [-1, -1];
  const t = lines[baseIdx].timeMs;
  let first = baseIdx;
  while (first > 0 && lines[first - 1].timeMs === t) first--;
  return [first, baseIdx];
}
