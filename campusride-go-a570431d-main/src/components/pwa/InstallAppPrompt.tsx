import { Download } from "lucide-react";
import { useState } from "react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export default function InstallAppPrompt() {
  const { canInstall, isIOS, isStandalone, promptInstall } = useInstallPrompt();
  const [showIosHint, setShowIosHint] = useState(false);

  if (isStandalone) return null;

  if (canInstall) {
    return (
      <button
        type="button"
        onClick={() => {
          void promptInstall();
        }}
        className="fixed bottom-5 right-5 z-[70] rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl backdrop-blur-sm bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <Download className="h-4 w-4" /> Download App
        </span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <div className="fixed bottom-5 right-5 z-[70] max-w-xs space-y-2">
        <button
          type="button"
          onClick={() => setShowIosHint((prev) => !prev)}
          className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-xl backdrop-blur-sm bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 transition-colors"
        >
          <span className="inline-flex items-center gap-2">
            <Download className="h-4 w-4" /> Download App
          </span>
        </button>
        {showIosHint && (
          <div className="rounded-2xl border border-border bg-background/95 px-4 py-3 text-xs text-foreground shadow-xl backdrop-blur-sm">
            <p className="font-semibold mb-1">Install CampusRide on iPhone</p>
            <p>Tap Share in Safari, then choose Add to Home Screen.</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
