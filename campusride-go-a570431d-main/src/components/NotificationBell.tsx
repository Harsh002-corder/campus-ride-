import { useEffect, useMemo, useState } from "react";
import { Bell } from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn("relative p-2 rounded-xl bg-muted/50 hover:bg-muted transition-colors", className)}>
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
              {Math.min(unreadCount, 9)}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 bg-muted/20">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && <div className="p-4 text-xs text-muted-foreground">Loading notifications...</div>}
          {!loading && items.length === 0 && <div className="p-4 text-xs text-muted-foreground">No notifications yet.</div>}

          {!loading && items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => markRead(item.id)}
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
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
