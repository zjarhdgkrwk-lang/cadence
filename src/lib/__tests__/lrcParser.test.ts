import { describe, it, expect } from "vitest";
import { parseLrc, applyOffset, findActiveLine, findActiveRange } from "../lrcParser";

describe("parseLrc", () => {
  it("[mm:ss.xx] 2자리 소수 파싱 (centiseconds)", () => {
    const lines = parseLrc("[00:12.34]Hello");
    expect(lines).toHaveLength(1);
    expect(lines[0].timeMs).toBe(12_340);
    expect(lines[0].text).toBe("Hello");
  });

  it("[mm:ss.xxx] 3자리 소수 파싱 (milliseconds)", () => {
    const lines = parseLrc("[01:02.340]World");
    expect(lines).toHaveLength(1);
    expect(lines[0].timeMs).toBe(62_340);
    expect(lines[0].text).toBe("World");
  });

  it("멀티 타임스탬프 한 줄 — 동일 텍스트로 여러 항목 생성", () => {
    const lines = parseLrc("[00:10.00][00:20.00]Chorus");
    expect(lines).toHaveLength(2);
    expect(lines[0].timeMs).toBe(10_000);
    expect(lines[1].timeMs).toBe(20_000);
    expect(lines[0].text).toBe("Chorus");
    expect(lines[1].text).toBe("Chorus");
  });

  it("타임스탬프만 있는 빈 줄 — 텍스트가 빈 문자열", () => {
    const lines = parseLrc("[00:30.00]");
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("");
  });

  it("메타 태그 [ti:...] 무시", () => {
    const lines = parseLrc("[ti:Song Title]\n[ar:Artist]\n[00:01.00]Lyric");
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("Lyric");
  });

  it("타임스탬프 없는 일반 텍스트 줄 무시", () => {
    const lines = parseLrc("plain text\n[00:01.00]Lyric");
    expect(lines).toHaveLength(1);
  });

  it("결과가 시간 순으로 정렬됨", () => {
    const raw = "[00:20.00]B\n[00:05.00]A\n[00:35.00]C";
    const lines = parseLrc(raw);
    expect(lines[0].timeMs).toBe(5_000);
    expect(lines[1].timeMs).toBe(20_000);
    expect(lines[2].timeMs).toBe(35_000);
  });

  it("빈 입력 → 빈 배열", () => {
    expect(parseLrc("")).toHaveLength(0);
  });
});

describe("applyOffset", () => {
  it("양수 오프셋 적용", () => {
    const lines = [{ timeMs: 5_000, text: "A" }];
    const result = applyOffset(lines, 500);
    expect(result[0].timeMs).toBe(5_500);
  });

  it("음수 오프셋 — 0 이하로 내려가지 않음", () => {
    const lines = [{ timeMs: 100, text: "A" }];
    const result = applyOffset(lines, -500);
    expect(result[0].timeMs).toBe(0);
  });

  it("오프셋 0 → 동일 객체 반환 (최적화)", () => {
    const lines = [{ timeMs: 1_000, text: "A" }];
    expect(applyOffset(lines, 0)).toBe(lines);
  });

  it("원본 배열 변경하지 않음", () => {
    const lines = [{ timeMs: 1_000, text: "A" }];
    const result = applyOffset(lines, 200);
    expect(lines[0].timeMs).toBe(1_000);
    expect(result[0].timeMs).toBe(1_200);
  });
});

describe("findActiveLine", () => {
  const lines = [
    { timeMs: 0, text: "intro" },
    { timeMs: 5_000, text: "A" },
    { timeMs: 10_000, text: "B" },
    { timeMs: 15_000, text: "C" },
  ];

  it("정확히 일치하는 타임스탬프", () => {
    expect(findActiveLine(lines, 10_000)).toBe(2);
  });

  it("두 타임스탬프 사이 — 이전 줄 반환", () => {
    expect(findActiveLine(lines, 7_500)).toBe(1);
  });

  it("첫 번째 줄 이전 (timeMs=0, positionMs=0) → 0번 인덱스", () => {
    expect(findActiveLine(lines, 0)).toBe(0);
  });

  it("마지막 줄 이후 → 마지막 인덱스", () => {
    expect(findActiveLine(lines, 99_999)).toBe(3);
  });

  it("빈 배열 → -1", () => {
    expect(findActiveLine([], 5_000)).toBe(-1);
  });

  it("positionMs가 첫 번째 타임스탬프보다 작으면 -1", () => {
    const late = [{ timeMs: 5_000, text: "A" }];
    expect(findActiveLine(late, 4_999)).toBe(-1);
  });
});

describe("findActiveRange", () => {
  it("동일 타임스탬프 3개 행 — 전체 그룹 [firstIdx, lastIdx] 반환", () => {
    const lines = [
      { timeMs: 0, text: "intro" },
      { timeMs: 5_000, text: "A" },
      { timeMs: 5_000, text: "B" },
      { timeMs: 5_000, text: "C" },
      { timeMs: 10_000, text: "D" },
    ];
    // findActiveLine returns 3 (rightmost of the 5000ms group)
    const base = findActiveLine(lines, 5_000);
    expect(base).toBe(3);
    expect(findActiveRange(lines, base)).toEqual([1, 3]);
  });

  it("서로 다른 타임스탬프 — 각 행이 단독 그룹 [idx, idx]", () => {
    const lines = [
      { timeMs: 1_000, text: "A" },
      { timeMs: 2_000, text: "B" },
      { timeMs: 3_000, text: "C" },
    ];
    // At 2000ms only B is active — range is [1, 1]
    const base = findActiveLine(lines, 2_000);
    expect(findActiveRange(lines, base)).toEqual([1, 1]);
  });

  it("동일 타임스탬프 2개, 배열 맨 앞 — first=0", () => {
    const lines = [
      { timeMs: 0, text: "A" },
      { timeMs: 0, text: "B" },
      { timeMs: 5_000, text: "C" },
    ];
    const base = findActiveLine(lines, 0);
    expect(base).toBe(1);
    expect(findActiveRange(lines, base)).toEqual([0, 1]);
  });

  it("baseIdx -1 → [-1, -1]", () => {
    const lines = [{ timeMs: 5_000, text: "A" }];
    expect(findActiveRange(lines, -1)).toEqual([-1, -1]);
  });

  it("빈 배열 → [-1, -1]", () => {
    expect(findActiveRange([], -1)).toEqual([-1, -1]);
  });
});
