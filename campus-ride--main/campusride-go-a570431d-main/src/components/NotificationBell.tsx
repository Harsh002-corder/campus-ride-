import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiClient } from "@/lib/apiClient";
import { getSocketClient } from "@/lib/socketClient";
import { cn } from "@/lib/utils";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
};

interface NotificationBellProps {
  className?: string;
}

const NotificationBell = ({ className }: NotificationBellProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [pulseBurst, setPulseBurst] = useState(false);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await apiClient.notifications.my();
      setItems(response.notifications || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();

    const socket = getSocketClient();
    const onNew = (notification: NotificationItem) => {
      setItems((prev) => {
        if (prev.some((item) => item.id === notification.id)) {
          return prev;
        }
        return [notification, ...prev].slice(0, 100);
      });
      setPulseBurst(true);
      window.setTimeout(() => setPulseBurst(false), 420);
    };

    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadNotifications();
  }, [open]);

  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

  const markRead = async (notificationId: string) => {
    setItems((prev) => prev.map((item) => (
      item.id === notificationId && !item.readAt
        ? { ...item, readAt: new Date().toISOString() }
        : item
    )));

    try {
      await apiClient.notifications.markRead(notificationId);
    } catch {
      void loadNotifications();
    }
  };

  const extractRideId = (text: string) => {
    const match = text.match(/[a-f\d]{24}/i);
    return match?.[0] || null;
  };

  const openNotification = async (item: NotificationItem) => {
    await markRead(item.id);
    const payloadText = `${item.title} ${item.body}`;
    const rideId = extractRideId(payloadText);
    if (rideId) {
      navigate(`/rides/${rideId}`);
      setOpen(false);
      return;
    }
    if (/issue|complaint/i.test(payloadText)) {
      navigate("/admin", { state: { tab: "issues" } });
      setOpen(false);
      return;
    }
    if (/earning|payout/i.test(payloadText)) {
      navigate("/driver-dashboard/today-earnings");
      setOpen(false);
      return;
    }
    navigate("/rides");
    setOpen(false);
  };

  const markAllRead = async () => {
    const unreadIds = items.filter((item) => !item.readAt).map((item) => item.id);
    if (!unreadIds.length) return;

    const nowIso = new Date().toISOString();
    setItems((prev) => prev.map((item) => (!item.readAt ? { ...item, readAt: nowIso } : item)));
    await Promise.allSettled(unreadIds.map((id) => apiClient.notifications.markRead(id)));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          animate={pulseBurst ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={pulseBurst ? { duration: 0.34, ease: "easeOut" } : { duration: 0.15 }}
          className={cn("relative p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors", className)}
        >
          <motion.span
            animate={unreadCount > 0 ? { rotate: [0, -8, 6, -4, 0] } : { rotate: 0 }}
            transition={unreadCount > 0 ? { duration: 0.85, repeat: Infinity, repeatDelay: 2.4, ease: "easeInOut" } : { duration: 0.2 }}
            className="inline-flex"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
          </motion.span>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0.7, opacity: 0.3 }}
              animate={{ scale: [1, 1.14, 1], opacity: [0.95, 1, 0.95] }}
              transition={{ duration: 1.05, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center"
            >
              {Math.min(unreadCount, 9)}
            </motion.span>
          )}
          <AnimatePresence>
            {pulseBurst && (
              <motion.span
                initial={{ opacity: 0.55, scale: 0.8 }}
                animate={{ opacity: 0, scale: 1.6 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute inset-0 rounded-xl border border-primary/40"
              />
            )}
          </AnimatePresence>
        </motion.button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Notifications</p>
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-[11px] font-semibold text-primary disabled:text-muted-foreground"
              disabled={unreadCount === 0}
            >
              Mark all read
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && <div className="p-4 text-xs text-muted-foreground">Loading notifications...</div>}
          {!loading && items.length === 0 && <div className="p-4 text-xs text-muted-foreground">No notifications yet.</div>}

          <AnimatePresence initial={false}>
            {!loading && items.map((item, i) => (
              <motion.button
                key={item.id}
                type="button"
                onClick={() => void openNotification(item)}
                initial={{ opacity: 0, y: -8, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.99 }}
                transition={{ duration: 0.2, delay: i < 4 ? i * 0.03 : 0 }}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-border/40 hover:bg-muted/30 transition-colors",
                  !item.readAt && "bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  {!item.readAt && <span className="w-2 h-2 rounded-full bg-primary mt-1" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{item.body}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{new Date(item.createdAt).toLocaleString()}</p>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
