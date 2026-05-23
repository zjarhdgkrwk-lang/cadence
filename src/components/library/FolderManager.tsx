import { useEffect, useRef, useState } from "react";
import { FolderOpen, X, RefreshCw, Plus } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { addFolder, removeFolder, startScan } from "../../lib/ipc";
import { useLibraryStore } from "../../stores/libraryStore";

export function FolderManager() {
  const { folders, loadFolders, isScanning } = useLibraryStore();
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadFolders();
    }
  }, [loadFolders]);

  async function handleAddFolder() {
    setError(null);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "음악 폴더 추가",
      });
      if (!selected) return;
      const path = typeof selected === "string" ? selected : selected[0];
      if (!path) return;
      await addFolder(path);
      await loadFolders();
      // 폴더 추가 직후 자동 스캔 (SSOT §3.1)
      if (!isScanning) {
        await startScan();
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleRemove(id: number) {
    setError(null);
    try {
      await removeFolder(id);
      await loadFolders();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleScan() {
    setError(null);
    try {
      await startScan();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--color-fg-subtle)" }}
        >
          음악 폴더
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleAddFolder}
            title="폴더 추가"
            className="p-1 rounded hover:bg-[var(--color-surface-raised)] transition-colors"
            style={{ color: "var(--color-fg-muted)" }}
          >
            <Plus size={14} />
          </button>
          <button
            onClick={handleScan}
            disabled={isScanning || folders.length === 0}
            title="라이브러리 스캔"
            className="p-1 rounded hover:bg-[var(--color-surface-raised)] transition-colors disabled:opacity-40"
            style={{ color: "var(--color-fg-muted)" }}
          >
            <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {folders.length === 0 ? (
        <button
          onClick={handleAddFolder}
          className="w-full flex items-center gap-2 py-2 px-2 rounded text-sm border border-dashed transition-colors hover:border-[var(--color-border-strong)]"
          style={{
            color: "var(--color-fg-subtle)",
            borderColor: "var(--color-border)",
          }}
        >
          <FolderOpen size={14} />
          <span>폴더 추가…</span>
        </button>
      ) : (
        <ul className="space-y-0.5">
          {folders.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-1 group rounded px-1"
            >
              <FolderOpen size={12} style={{ color: "var(--color-fg-subtle)", flexShrink: 0 }} />
              <span
                className="flex-1 text-xs truncate"
                style={{ color: "var(--color-fg-muted)" }}
                title={f.path}
              >
                {f.path.split(/[\\/]/).pop() ?? f.path}
              </span>
              <button
                onClick={() => handleRemove(f.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity hover:text-[var(--color-danger)]"
                style={{ color: "var(--color-fg-subtle)" }}
                title="폴더 제거"
              >
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-xs mt-1" style={{ color: "var(--color-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
