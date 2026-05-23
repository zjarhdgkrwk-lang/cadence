import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { initThemeListeners } from "@/stores/uiStore";
import { getAppInfo } from "@/lib/ipc";

function App() {
  useEffect(() => {
    const cleanup = initThemeListeners();

    getAppInfo()
      .then((info) => {
        console.log("[Cadence] app_info:", info);
      })
      .catch((err) => {
        console.warn("[Cadence] app_info unavailable (dev mode?):", err);
      });

    return cleanup;
  }, []);

  return <AppShell />;
}

export default App;
