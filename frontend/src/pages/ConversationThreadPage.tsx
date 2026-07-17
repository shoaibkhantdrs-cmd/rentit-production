import { FormEvent, memo, useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { X } from "lucide-react";
import { chatApi } from "@/api/chat";
import { propertiesApi } from "@/api/properties";
import { useAsync } from "@/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { RequireAuth } from "@/components/RequireAuth";
import { ErrorState } from "@/components/ErrorState";
import { ApiError } from "@/api/httpClient";
import { toMessageDto } from "@/utils/chatMessage";
import { ConversationSummary, MessageDto, PropertyDetail } from "@/api/types";

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

// Perf fix: this used to be inlined in ChatThread's messages.map(), so every
// keystroke in the composer below (setDraft on each character) re-rendered
// the whole thread, re-executing map() and re-parsing
// Date/toLocaleTimeString for every loaded message (50+ in long threads).
// Extracting the bubble into its own memoized component means a composer
// keystroke re-renders ChatThread but skips re-rendering every bubble whose
// props haven't actually changed. `isDeleting` is passed as a per-message
// boolean (not the raw deletingMessageId) so only the one bubble being
// deleted re-renders when a delete starts/finishes, not all of them.
const MessageBubble = memo(function MessageBubble({
  message,
  isDeleting,
  onDelete,
}: {
  message: MessageDto;
  isDeleting: boolean;
  onDelete: (messageId: string) => void;
}) {
  return (
    <div className={`chat-bubble${message.isMine ? " chat-bubble--mine" : ""}`}>
      {message.isDeleted ? (
        <em className="field-hint">Message deleted</em>
      ) : (
        <>
          {message.body ? <p>{message.body}</p> : null}
          {message.imageUrl ? (
            <img
              src={message.imageUrl}
              alt="Shared attachment"
              className="chat-bubble__image"
              loading="lazy"
              decoding="async"
            />
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
            onClick={() => onDelete(message.id)}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        ) : null}
      </div>
    </div>
  );
});

function ChatThread() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const { subscribe, sendSocket, refreshUnreadCount } = useChat();

  const { status, data, error, reload } = useAsync(() => chatApi.listMessages(id, 1, PAGE_SIZE), [id]);

  // Bug fix (QA report #12): this used to fetch a single hardcoded page
  // (page 1, pageSize 100) of chatApi.listConversations and give up if
  // the open thread wasn't in it -- for an account with more than 100
  // conversations, opening an older thread silently lost the header
  // name, property chip, and rent display. There's no single-conversation
  // GET endpoint on the backend, so this walks subsequent pages of the
  // existing paginated endpoint (bounded, so it can't run away) until the
  // conversation is found or the list is exhausted.
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const CONV_PAGE_SIZE = 100;
    const MAX_PAGES = 20; // 2,000 conversations of headroom -- generous but bounded

    (async () => {
      let page = 1;
      while (page <= MAX_PAGES) {
        const res = await chatApi.listConversations(page, CONV_PAGE_SIZE);
        const found = res.items.find((c) => c.id === id);
        if (found) {
          if (!cancelled) setSummary(found);
          return;
        }
        if (page * CONV_PAGE_SIZE >= res.total) return; // no more pages
        page += 1;
      }
    })().catch(() => {
      // Non-critical -- header falls back to the generic "Conversation" title.
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const threadPropertyId = summary?.propertyId ?? null;

  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [olderPage, setOlderPage] = useState(1);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [draft, setDraft] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [threadProperty, setThreadProperty] = useState<PropertyDetail | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [loadEarlierError, setLoadEarlierError] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  // Mirrors deletingMessageId for the busy-guard check inside handleDelete
  // below, so that callback can stay a stable ([id]-only) useCallback
  // reference instead of also depending on deletingMessageId -- otherwise
  // MessageBubble's memoization would be defeated every time a delete
  // starts or finishes, since every bubble receives the same onDelete prop.
  const deletingMessageIdRef = useRef<string | null>(null);

  // Local object-URL preview of the attachment before it's sent -- revoked
  // whenever the selection changes so we don't leak blob URLs.
  useEffect(() => {
    if (!image) {
      setImagePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  // Real inline property card in the thread header -- the conversation
  // summary only carries propertyId/propertyTitle, so the full listing
  // (image, rent) is fetched from the existing property-details endpoint
  // rather than inventing new fields on the chat API.
  useEffect(() => {
    if (!threadPropertyId) {
      setThreadProperty(null);
      return;
    }
    let cancelled = false;
    propertiesApi
      .getById(threadPropertyId)
      .then((p) => {
        if (!cancelled) setThreadProperty(p);
      })
      .catch(() => {
        // Non-critical -- the plain text fallback link still works.
      });
    return () => {
      cancelled = true;
    };
  }, [threadPropertyId]);

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
    // Bug fix (QA report #6): this used to have no busy guard and no
    // error handling. Repeated clicks fired concurrent, unordered
    // requests, and a rejected request became a silent unhandled
    // promise rejection with no feedback.
    if (loadingEarlier) return;
    setLoadingEarlier(true);
    setLoadEarlierError(null);
    const nextPage = olderPage + 1;
    try {
      const res = await chatApi.listMessages(id, nextPage, PAGE_SIZE);
      setMessages((prev) => [...[...res.items].reverse(), ...prev]);
      setOlderPage(nextPage);
      setHasMoreOlder(nextPage * PAGE_SIZE < res.total);
    } catch (err) {
      setLoadEarlierError(err instanceof ApiError ? err.message : "Could not load earlier messages.");
    } finally {
      setLoadingEarlier(false);
    }
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

  const handleDelete = useCallback(
    async (messageId: string) => {
      if (!window.confirm("Delete this message?")) return;
      // Bug fix (QA report #7): no busy guard used to exist here, so rapid
      // repeat clicks on the same message's Delete button could fire
      // multiple concurrent delete requests for the same message.
      if (deletingMessageIdRef.current) return;
      deletingMessageIdRef.current = messageId;
      setDeletingMessageId(messageId);
      try {
        await chatApi.deleteMessage(id, messageId);
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isDeleted: true, body: null, imageUrl: null } : m)),
        );
      } catch (err) {
        setSendError(err instanceof ApiError ? err.message : "Could not delete that message.");
      } finally {
        deletingMessageIdRef.current = null;
        setDeletingMessageId(null);
      }
    },
    [id],
  );

  if (status === "loading") return <ThreadSkeleton />;
  if (status === "error") return <ErrorState message={error} onRetry={reload} />;

  const propertyImage =
    threadProperty?.images.find((img) => img.isPrimary)?.url ?? threadProperty?.images[0]?.url ?? null;

  return (
    <div className="chat-thread">
      <div className="page-header">
        <div>
          <Link to="/messages" className="field-hint">
            &larr; All messages
          </Link>
          <h1 style={{ margin: "4px 0 0" }}>{summary?.otherParticipant?.name ?? "Conversation"}</h1>
        </div>
      </div>

      {summary?.propertyTitle && summary.propertyId ? (
        <Link to={`/properties/${summary.propertyId}`} className="chat-property-chip">
          {propertyImage ? (
            <img src={propertyImage} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="chat-property-chip__placeholder" aria-hidden="true" />
          )}
          <span>
            <strong>{summary.propertyTitle}</strong>
            {threadProperty ? (
              <span className="field-hint">&#8377;{threadProperty.rentAmount.toLocaleString("en-IN")}/mo</span>
            ) : null}
          </span>
        </Link>
      ) : null}

      <div className="chat-messages">
        {hasMoreOlder ? (
          <button
            type="button"
            className="btn-v2 btn-v2--secondary btn-v2--sm"
            onClick={loadEarlier}
            disabled={loadingEarlier}
          >
            {loadingEarlier ? "Loading..." : "Load earlier messages"}
          </button>
        ) : null}
        {loadEarlierError ? <div className="alert alert--error">{loadEarlierError}</div> : null}

        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isDeleting={deletingMessageId === message.id}
            onDelete={handleDelete}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {otherTyping ? (
        <div className="field-hint chat-typing" role="status">
          Typing...
        </div>
      ) : null}

      {sendError ? <div className="alert alert--error">{sendError}</div> : null}

      {imagePreviewUrl ? (
        <div className="chat-image-preview">
          <img src={imagePreviewUrl} alt="Attachment preview" />
          <button
            type="button"
            className="chat-image-preview__remove"
            aria-label="Remove attachment"
            onClick={() => setImage(null)}
          >
            <X size={13} />
          </button>
        </div>
      ) : null}

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
        <label className="btn-v2 btn-v2--secondary btn-v2--sm chat-composer__attach">
          {image ? "Change photo" : "Attach photo"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" className="btn-v2 btn-v2--primary" disabled={sending || (!draft.trim() && !image)}>
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
