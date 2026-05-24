import { logFrontend, type LogLevel } from "./ipc";

// ── 재진입 방지 ──────────────────────────────────────────────
// IPC 호출 자체가 console.log를 유발할 경우 무한 루프 방지
let _active = false;

function send(level: LogLevel, args: unknown[], source?: string): void {
  if (_active) return;
  _active = true;
  try {
    const msg = args
      .map((a) => {
        if (typeof a === "string") return a;
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      })
      .join(" ");
    logFrontend(level, msg, source);
  } finally {
    _active = false;
  }
}

// ── console 인터셉터 ─────────────────────────────────────────

export function initLogger(): void {
  const _log = console.log.bind(console);
  const _info = console.info.bind(console);
  const _warn = console.warn.bind(console);
  const _error = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    _log(...args);
    send("log", args);
  };
  console.info = (...args: unknown[]) => {
    _info(...args);
    send("info", args);
  };
  console.warn = (...args: unknown[]) => {
    _warn(...args);
    send("warn", args);
  };
  console.error = (...args: unknown[]) => {
    _error(...args);
    send("error", args);
  };

  // ── window.onerror ──────────────────────────────────────────
  window.addEventListener("error", (ev) => {
    const src = ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : "";
    send("error", [`[onerror] ${ev.message}`], src);
  });

  // ── unhandledrejection ───────────────────────────────────────
  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const msg =
      reason instanceof Error
        ? `[unhandledrejection] ${reason.message}\n${reason.stack ?? ""}`
        : `[unhandledrejection] ${String(reason)}`;
    send("error", [msg]);
  });
}
