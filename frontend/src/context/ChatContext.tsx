import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { chatApi } from "@/api/chat";
import { useChatSocket } from "@/hooks/useChatSocket";
import { useAuth } from "@/context/AuthContext";
import { ChatRealtimeEvent } from "@/api/types";

type EventListener = (event: ChatRealtimeEvent) => void;

interface ChatContextValue {
  /** Backs the nav badge. Not scoped to a single conversation -- pages
   * that view a thread call refreshUnreadCount() after marking it read. */
  unreadCount: number;
  refreshUnreadCount: () => void;
  /** Lets a conversation thread page listen to every inbound realtime
   * event (message.new/deleted, typing, conversation.read) without each
   * page opening its own WebSocket connection. */
  subscribe: (listener: EventListener) => () => void;
  sendSocket: (payload: unknown) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const listenersRef = useRef(new Set<EventListener>());

  const refreshUnreadCount = useCallback(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    chatApi
      .unreadCount()
      .then((res) => setUnreadCount(res.unreadCount))
      .catch(() => {
        // Offline or a transient error -- leave the last known count
        // showing rather than flashing it to zero.
      });
  }, [isAuthenticated]);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  const handleEvent = useCallback((event: ChatRealtimeEvent) => {
    listenersRef.current.forEach((listener) => listener(event));
    if (event.type === "message.new") {
      setUnreadCount((count) => count + 1);
    }
  }, []);

  const { send } = useChatSocket(handleEvent);

  const subscribe = useCallback((listener: EventListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  return (
    <ChatContext.Provider value={{ unreadCount, refreshUnreadCount, subscribe, sendSocket: send }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
