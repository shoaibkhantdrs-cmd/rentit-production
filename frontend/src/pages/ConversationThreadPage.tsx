import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { chatApi } from "@/api/chat";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorState } from "@/components/ErrorState";
import { ApiError } from "@/api/httpClient";
import { toMessageDto } from "@/utils/chatMessage";
import { MessageDto } from "@/api/types";

const TYPING_TIMEOUT_MS = 3000;
const TYPING_DEBOUNCE_MS = 1500;
const PAGE_SIZE = 50;

function ThreadSkeleton() {
  return (
    <div className="chat-thread" aria-hidden="true">
      <div className="skeleton skeleton--text" style={{ width: "30%" }} />
      <div className="chat-messages">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="skeleton chat-bubble-skeleton"
            style={i % 2 ? { marginLeft: "auto" } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function ChatThread() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const { subscribe, sendSocket, refreshUnreadCount } = useChat();

  const { status, data, error, reload } = useAsync(() => chatApi.listMessages(id, 1, PAGE_SIZE), [id]);
  const { data: conversationsData } = useAsync(() => chatApi.listConversations(1, 100), []);

  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [olderPage, setOlderPage] = useState(1);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    if (status === "success") {
      // Server returns newest-first for pagination; reverse for the
      // familiar chronological (oldest-at-top) chat layout.
      setMessages([...data.items].reverse());
      setHasMoreOlder(data.total > data.items.length);
      setOlderPage(1);
    }
  }, [status, data]);

  // Mark read as soon as this thread is opened.
  useEffect(() => {
    if (!id) return;
    chatApi
      .markRead(id)
      .then(refreshUnreadCount)
      .catch(() => {
        // Best-effort -- an offline read-receipt just means the other
        // side sees "delivered" a little longer than usual.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (event.conversationId !== id) return;

      if (event.type === "message.new") {
        const dto = toMessageDto(event.message, user?.id ?? "");
        setMessages((prev) => [...prev, dto]);
        if (!dto.isMine) {
          setOtherTyping(false);
          chatApi
            .markRead(id)
            .then(refreshUnreadCount)
            .catch(() => {});
        }
      } else if (event.type === "message.deleted") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.messageId ? { ...m, isDeleted: true, body: null, imageUrl: null } : m,
          ),
        );
      } else if (event.type === "typing") {
        if (event.userId === user?.id) return;
        setOtherTyping(event.isTyping);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (event.isTyping) {
          typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), TYPING_TIMEOUT_MS);
        }
      } else if (event.type === "conversation.read") {
        if (event.userId === user?.id) return;
        const readAt = new Date(event.at).getTime();
        setMessages((prev) =>
          prev.map((m) =>
            m.isMine && new Date(m.createdAt).getTime() <= readAt ? { ...m, readByOther: true } : m,
          ),
        );
      }
    });
    return unsubscribe;
  }, [id, subscribe, user?.id, refreshUnreadCount]);

  const notifyTyping = (isTyping: boolean) => {
    const now = Date.now();
    if (isTyping && now - lastTypingSentRef.current < TYPING_DEBOUNCE_MS) return;
    lastTypingSentRef.current = now;
    sendSocket({ type: "typing", conversationId: id, isTyping });
  };

  const loadEarlier = async () => {
    const nextPage = olderPage + 1;
    const res = await chatApi.listMessages(id, nextPage, PAGE_SIZE);
    setMessages((prev) => [...[...res.items].reverse(), ...prev]);
    setOlderPage(nextPage);
    setHasMoreOlder(nextPage * PAGE_SIZE < res.total);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed && !image) return;
    setSending(true);
    setSendError(null);
    try {
      const sent = await chatApi.sendMessage(id, trimmed || null, image);
      setMessages((prev) => [...prev, toMessageDto(sent, user?.id ?? "")]);
      setDraft("");
      setImage(null);
      notifyTyping(false);
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Could not send that message.");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      await chatApi.deleteMessage(id, messageId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, body: null, imageUrl: null } : m)),
      );
    } catch (err) {
      setSendError(err instanceof ApiError ? err.message : "Could not delete that message.");
    }
  };

  if (status === "loading") return <ThreadSkeleton />;
  if (status === "error") return <ErrorState message={error} onRetry={reload} />;

  const summary = conversationsData?.items.find((c) => c.id === id) ?? null;

  return (
    <div className="chat-thread">
      <div className="page-header">
        <div>
          <Link to="/messages" className="field-hint">
            &larr; All messages
          </Link>
          <h1 style={{ margin: "4px 0 0" }}>{summary?.otherParticipant?.name ?? "Conversation"}</h1>
          {summary?.propertyTitle && summary.propertyId ? (
            <Link to={`/properties/${summary.propertyId}`} className="field-hint">
              Re: {summary.propertyTitle}
            </Link>
          ) : null}
        </div>
      </div>

      <div className="chat-messages">
        {hasMoreOlder ? (
          <button type="button" className="btn btn--secondary btn--sm" onClick={loadEarlier}>
            Load earlier messages
          </button>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className={`chat-bubble${message.isMine ? " chat-bubble--mine" : ""}`}>
            {message.isDeleted ? (
              <em className="field-hint">Message deleted</em>
            ) : (
              <>
                {message.body ? <p>{message.body}</p> : null}
                {message.imageUrl ? (
                  <img src={message.imageUrl} alt="Shared attachment" className="chat-bubble__image" />
                ) : null}
              </>
            )}
            <div className="chat-bubble__meta">
              <span>
                {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {message.isMine && message.readByOther ? <span>&middot; Read</span> : null}
              {message.isMine && !message.isDeleted ? (
                <button
                  type="button"
                  className="chat-bubble__delete"
                  aria-label="Delete message"
                  onClick={() => handleDelete(message.id)}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {otherTyping ? (
        <div className="field-hint chat-typing" role="status">
          Typing...
        </div>
      ) : null}

      {sendError ? <div className="alert alert--error">{sendError}</div> : null}

      <form onSubmit={handleSend} className="chat-composer">
        <input
          aria-label="Message"
          placeholder="Write a message..."
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            notifyTyping(e.target.value.length > 0);
          }}
          onBlur={() => notifyTyping(false)}
        />
        <label className="btn btn--secondary btn--sm chat-composer__attach">
          {image ? "Photo attached" : "Attach photo"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" className="btn btn--primary" disabled={sending || (!draft.trim() && !image)}>
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}

export function ConversationThreadPage() {
  return (
    <RequireAuth message="Sign in to view this conversation.">
      <ChatThread />
    </RequireAuth>
  );
}
