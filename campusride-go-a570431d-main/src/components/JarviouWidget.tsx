import { useMemo, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

type ChatMessage = {
  id: string;
  sender: "user" | "jarviou";
  text: string;
};

const JarviouWidget = () => {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "jarviou",
      text: "Hi, I am Jarviou. Ask me to book rides, check status, cancel rides, or answer FAQs.",
    },
  ]);

  const canSend = useMemo(() => message.trim().length > 0 && !loading, [message, loading]);

  const send = async () => {
    const text = message.trim();
    if (!text || loading) return;

    setMessage("");
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: "user", text },
    ]);

    try {
      const response = await apiClient.chatbot.message(text);
      setMessages((prev) => [
        ...prev,
        { id: `j-${Date.now()}`, sender: "jarviou", text: response.assistant },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `j-${Date.now()}`,
          sender: "jarviou",
          text: "I am facing a temporary issue. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-3 left-3 right-auto sm:bottom-4 sm:left-4 z-50 !h-9 !w-9 sm:!h-10 sm:!w-10 min-w-0 p-0 rounded-full bg-primary text-primary-foreground border border-primary/40 shadow-lg inline-flex items-center justify-center"
        aria-label="Open Jarviou Assistant"
      >
        {isOpen ? <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <MessageCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="fixed inset-x-2 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 w-auto max-w-full rounded-2xl border border-border/60 bg-background/95 backdrop-blur p-3 shadow-2xl sm:inset-x-auto sm:bottom-20 sm:left-4 sm:w-[340px]"
          >
            <div className="px-1 pb-2 border-b border-border/60">
              <h3 className="font-semibold">Jarviou Assistant</h3>
              <p className="text-xs text-muted-foreground">Smart campus ride helper</p>
            </div>

            <div className="h-[min(52vh,18rem)] overflow-y-auto py-3 space-y-2">
              {messages.map((entry) => (
                <div
                  key={entry.id}
                  className={`text-sm px-3 py-2 rounded-xl break-words ${entry.sender === "user" ? "bg-primary text-primary-foreground ml-8" : "bg-muted mr-8"}`}
                >
                  {entry.text}
                </div>
              ))}
              {loading && <div className="text-xs text-muted-foreground px-1">Jarviou is thinking…</div>}
            </div>

            <div className="pt-2 border-t border-border/60 flex items-center gap-2">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    send();
                  }
                }}
                placeholder="Ask Jarviou anything"
                className="flex-1 h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={send}
                disabled={!canSend}
                className="h-10 w-10 rounded-lg btn-primary-gradient flex items-center justify-center disabled:opacity-40"
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default JarviouWidget;
