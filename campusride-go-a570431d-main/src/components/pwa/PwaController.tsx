import InstallAppPrompt from "@/components/pwa/InstallAppPrompt";
import OfflineBanner from "@/components/pwa/OfflineBanner";
import { usePwaUpdater } from "@/hooks/usePwaUpdater";

export default function PwaController() {
  usePwaUpdater();

  return (
    <>
      <OfflineBanner />
      <InstallAppPrompt />
    </>
  );
}
