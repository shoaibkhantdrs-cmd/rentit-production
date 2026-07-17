import { useCallback, useEffect, useRef } from "react";
import { env } from "@/config/env";
import { tokenStore } from "@/api/tokenStore";
import { ChatRealtimeEvent } from "@/api/types";

function buildWsUrl(): string | null {
  const stored = tokenStore.get();
  if (!stored) return null;
  const httpUrl = new URL("/ws/chat", env.apiBaseUrl);
  httpUrl.protocol = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  httpUrl.searchParams.set("token", stored.tokens.accessToken);
  return httpUrl.toString();
}

/**
 * Connects to the backend's hand-rolled WebSocket server (see
 * backend/src/infrastructure/realtime/WebSocketGateway.ts) using the
 * browser's native, spec-compliant WebSocket API -- no client library
 * needed, since our server speaks plain RFC 6455. Reconnects with a
 * simple backoff on drop, which also covers "offline -> back online"
 * recovery (Part 8).
 */
export function useChatSocket(onEvent: (event: ChatRealtimeEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (cancelled) return;
      // No token yet (logged out) -- park a slow retry loop so that
      // logging in later (without a full page reload) still picks up a
      // connection, rather than requiring a refresh.
      const url = buildWsUrl();
      if (!url) {
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15000);
        return;
      }

      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as ChatRealtimeEvent;
          onEventRef.current(parsed);
        } catch {
          // Ignore anything that isn't valid JSON -- a malformed frame
          // shouldn't take the whole chat UI down.
        }
      };

      socket.onopen = () => {
        retryDelay = 1000;
      };

      socket.onclose = () => {
        if (cancelled) return;
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15000);
      };
    }

    connect();

    // Reconnecting immediately on login/logout keeps the "socket only
    // works after a page refresh" gap as small as possible.
    const unsubscribe = tokenStore.subscribe(() => {
      socketRef.current?.close();
      socketRef.current = null;
      if (retryTimer) clearTimeout(retryTimer);
      retryDelay = 1000;
      connect();
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
    };
  }, []);

  // Perf fix: this was a plain function, recreated fresh on every render --
  // it only ever reads socketRef (a stable ref), so it never actually
  // needed to change. useCallback with an empty dep array gives ChatContext
  // a reference-stable `send` it can safely include in its own memoized
  // value below.
  const send = useCallback((payload: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  }, []);

  return { send };
}
