import { useMemo } from "react";
import { Download } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

const InstallAppButton = () => {
  const { pathname } = useLocation();
  const { canInstall, isInstalling, promptInstall } = useInstallPrompt();
  const shouldHideOnHome = useMemo(() => pathname === "/", [pathname]);

  if (!canInstall || shouldHideOnHome) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70] px-4 sm:px-0">
      <Button
        type="button"
        size="lg"
        onClick={promptInstall}
        disabled={isInstalling}
        className="h-12 rounded-full px-5 shadow-2xl shadow-primary/20"
      >
        <Download className="h-4 w-4" />
        {isInstalling ? "Installing..." : "Install App"}
      </Button>
    </div>
  );
};

export default InstallAppButton;