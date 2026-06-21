import { useEffect } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  detail,
  confirmLabel = "确认",
  cancelLabel = "取消",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [busy, onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="confirm-overlay" role="presentation">
      <div
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className="confirm-dialog"
        role="dialog"
      >
        <h3 className="confirm-dialog-title" id="confirm-dialog-title">
          {title}
        </h3>
        {message ? <p className="confirm-dialog-message">{message}</p> : null}
        {detail ? <p className="confirm-dialog-detail">{detail}</p> : null}
        <div className="confirm-dialog-actions">
          <button
            className={danger ? "confirm-dialog-danger" : "primary-button"}
            disabled={busy}
            type="button"
            onClick={() => void onConfirm()}
          >
            {busy ? "处理中..." : confirmLabel}
          </button>
          <button
            className="confirm-dialog-cancel"
            disabled={busy}
            type="button"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
