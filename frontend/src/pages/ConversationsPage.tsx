import { Link } from "react-router-dom";
import { chatApi } from "@/api/chat";
import { useAsync } from "@/hooks/useAsync";
import { RequireAuth } from "@/components/RequireAuth";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";

function ConversationSkeleton() {
  return (
    <div className="conversation-list" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="conversation-row conversation-row--skeleton">
          <div className="skeleton" style={{ width: 44, height: 44, borderRadius: "50%" }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton skeleton--text" style={{ width: "40%" }} />
            <div className="skeleton skeleton--text" style={{ width: "70%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ConversationList() {
  const { status, data, error, reload } = useAsync(() => chatApi.listConversations(1, 50), []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Messages</h1>
          <p>Conversations with owners and renters.</p>
        </div>
      </div>

      {status === "loading" && <ConversationSkeleton />}

      {status === "error" && <ErrorState message={error} onRetry={reload} />}

      {status === "success" && data.items.length === 0 && (
        <EmptyState
          icon="💬"
          title="No conversations yet"
          description="Message a property owner from a listing page to start a conversation."
        />
      )}

      {status === "success" && data.items.length > 0 && (
        <div className="conversation-list">
          {data.items.map((conversation) => (
            <Link
              key={conversation.id}
              to={`/messages/${conversation.id}`}
              className="conversation-row"
            >
              <div className="conversation-row__avatar" aria-hidden="true">
                {(conversation.otherParticipant?.name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="conversation-row__body">
                <div className="conversation-row__top">
                  <span className="conversation-row__name">
                    {conversation.otherParticipant?.name ?? "Deleted user"}
                  </span>
                  <span className="field-hint">{timeAgo(conversation.lastMessageAt)}</span>
                </div>
                {conversation.propertyTitle ? (
                  <div className="field-hint">Re: {conversation.propertyTitle}</div>
                ) : null}
                <div className="conversation-row__preview">
                  {conversation.lastMessagePreview ?? "No messages yet"}
                </div>
              </div>
              {conversation.unreadCount > 0 ? (
                <span className="unread-badge" aria-label={`${conversation.unreadCount} unread messages`}>
                  {conversation.unreadCount}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ConversationsPage() {
  return (
    <RequireAuth message="Sign in to see your messages.">
      <ConversationList />
    </RequireAuth>
  );
}
