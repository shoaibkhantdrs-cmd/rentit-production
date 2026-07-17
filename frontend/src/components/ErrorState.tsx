interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: ErrorStateProps) {
  return (
    <div className="state-panel state-panel--error" role="alert">
      <div className="state-panel__icon" aria-hidden="true">
        ⚠️
      </div>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="btn-v2 btn-v2--secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
