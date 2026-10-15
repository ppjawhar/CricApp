import { useEffect, useState } from "react";

export type ConfirmSheetOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type PendingConfirmation = ConfirmSheetOptions & {
  resolve: (confirmed: boolean) => void;
};

export default function useConfirmSheet() {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      pending.resolve(false);
      setPending(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending]);

  function confirm(options: ConfirmSheetOptions) {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }

  function settle(confirmed: boolean) {
    if (!pending) return;
    pending.resolve(confirmed);
    setPending(null);
  }

  const confirmationSheet = pending ? (
    <div
      className="sheet-backdrop confirmation-backdrop"
      onMouseDown={() => settle(false)}
    >
      <section
        className="confirmation-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-title"
        aria-describedby="confirmation-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <span className="eyebrow">PLEASE CONFIRM</span>
        <h2 id="confirmation-title">{pending.title}</h2>
        <p id="confirmation-message">{pending.message}</p>
        <div className="confirmation-actions">
          <button
            type="button"
            className="confirmation-cancel"
            onClick={() => settle(false)}
          >
            {pending.cancelLabel || "Cancel"}
          </button>
          <button
            type="button"
            className={`confirmation-submit${
              pending.tone === "danger" ? " danger" : ""
            }`}
            onClick={() => settle(true)}
            autoFocus
          >
            {pending.confirmLabel || "Confirm"}
          </button>
        </div>
      </section>
    </div>
  ) : null;

  return { confirm, confirmationSheet };
}
