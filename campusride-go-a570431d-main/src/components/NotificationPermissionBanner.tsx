import { motion } from "framer-motion";
import { Bell, BellOff } from "lucide-react";

type NotificationPermissionBannerProps = {
  show: boolean;
  onEnable: () => void;
};

const NotificationPermissionBanner = ({ show, onEnable }: NotificationPermissionBannerProps) => {
  if (!show) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed left-3 right-3 top-3 z-[90] max-w-full sm:left-auto sm:right-6 sm:top-6 sm:w-[28rem]"
    >
      <div className="rounded-2xl border border-amber-400/30 bg-amber-100/95 px-4 py-3 shadow-xl backdrop-blur-md dark:bg-amber-900/70">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-200">
            <BellOff className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Notifications are off</p>
            <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-100/85">
              Enable notifications to receive real-time ride alerts when the app is in background.
            </p>
            <button
              type="button"
              onClick={onEnable}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-700"
            >
              <Bell className="h-3.5 w-3.5" />
              Enable notifications
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default NotificationPermissionBanner;
