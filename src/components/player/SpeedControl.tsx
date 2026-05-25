import { useState, useRef, useEffect } from "react";
import { Gauge } from "lucide-react";
import { usePlayerStore } from "../../stores/playerStore";
import { controller } from "../../lib/playerController";

const STEP = 0.05;
const MIN = 0.5;
const MAX = 2.0;

/** 0.05 단위로 반올림 */
function snapToStep(v: number): number {
  return Math.round(v * 20) / 20;
}

/** 불필요한 소수점 0 없이 표시. 예: 1.00→"1×"  1.50→"1.5×"  1.05→"1.05×" */
function formatSpeed(v: number): string {
  return `${parseFloat(v.toFixed(2))}×`;
}

export function SpeedControl() {
  const speed = usePlayerStore((s) => s.speed);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 팝오버 외부 클릭 닫기
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // 편집 모드 진입 시 자동 선택
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEditing() {
    setInputVal(String(parseFloat(speed.toFixed(2))));
    setEditing(true);
  }

  function commitInput() {
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed)) {
      controller.setSpeed(Math.max(MIN, Math.min(MAX, snapToStep(parsed))));
    }
    setEditing(false);
  }

  function adjust(delta: number) {
    controller.setSpeed(Math.max(MIN, Math.min(MAX, snapToStep(speed + delta))));
  }

  const isDefault = speed === 1.0;
  const label = formatSpeed(speed);

  return (
    <div ref={containerRef} className="relative">
      {/* 트리거 버튼 */}
      <button
        onClick={() => { setOpen((o) => !o); setEditing(false); }}
        className="flex items-center gap-0.5 px-1.5 py-1 rounded text-xs font-medium transition-colors"
        style={{
          color: isDefault ? "var(--color-fg-muted)" : "var(--color-accent)",
          backgroundColor: open ? "var(--color-surface-raised)" : "transparent",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.backgroundColor = "var(--color-surface-raised)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.backgroundColor = open
            ? "var(--color-surface-raised)"
            : "transparent")
        }
        title="재생 속도"
        aria-label={`재생 속도: ${label}`}
        aria-expanded={open}
      >
        <Gauge size={14} />
        <span style={{ minWidth: "3ch", textAlign: "right" }}>{label}</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-1 right-0 rounded-lg shadow-lg z-50"
          style={{
            backgroundColor: "var(--color-surface-raised)",
            border: "1px solid var(--color-border)",
            padding: "6px 8px",
          }}
        >
          <div className="flex items-center gap-1">
            {/* 감속 */}
            <button
              onClick={() => adjust(-STEP)}
              disabled={speed <= MIN}
              className="w-6 h-6 rounded text-sm flex items-center justify-center"
              style={{
                color: speed <= MIN ? "var(--color-fg-subtle, #888)" : "var(--color-fg)",
                cursor: speed <= MIN ? "default" : "pointer",
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => {
                if (speed > MIN)
                  e.currentTarget.style.backgroundColor =
                    "color-mix(in srgb, var(--color-surface-raised) 80%, var(--color-fg) 20%)";
              }}
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
              aria-label="배속 감소"
            >
              −
            </button>

            {/* 속도 표시 / 직접 입력 */}
            {editing ? (
              <input
                ref={inputRef}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onBlur={commitInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); commitInput(); }
                  if (e.key === "Escape") setEditing(false);
                }}
                className="text-xs text-center rounded"
                style={{
                  width: "4.5ch",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-accent)",
                  color: "var(--color-fg)",
                  outline: "none",
                  padding: "1px 2px",
                }}
              />
            ) : (
              <button
                onClick={startEditing}
                title="클릭하여 직접 입력"
                className="text-xs rounded"
                style={{
                  minWidth: "4.5ch",
                  textAlign: "center",
                  color: isDefault ? "var(--color-fg)" : "var(--color-accent)",
                  fontWeight: isDefault ? 400 : 600,
                  backgroundColor: "transparent",
                  padding: "1px 2px",
                  cursor: "text",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    "color-mix(in srgb, var(--color-surface-raised) 80%, var(--color-fg) 20%)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                {label}
              </button>
            )}

            {/* 가속 */}
            <button
              onClick={() => adjust(STEP)}
              disabled={speed >= MAX}
              className="w-6 h-6 rounded text-sm flex items-center justify-center"
              style={{
                color: speed >= MAX ? "var(--color-fg-subtle, #888)" : "var(--color-fg)",
                cursor: speed >= MAX ? "default" : "pointer",
                backgroundColor: "transparent",
              }}
              onMouseEnter={(e) => {
                if (speed < MAX)
                  e.currentTarget.style.backgroundColor =
                    "color-mix(in srgb, var(--color-surface-raised) 80%, var(--color-fg) 20%)";
              }}
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
              aria-label="배속 증가"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
