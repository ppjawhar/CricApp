import type { ReactNode } from "react";

type PageHeaderProps = {
  title?: string;
  eyebrow?: string;
  home?: boolean;
  onBack?: () => void;
  backLabel?: string;
  backLoading?: boolean;
  action?: ReactNode;
};

export default function PageHeader({
  title,
  eyebrow,
  home = false,
  onBack,
  backLabel = "Go back",
  backLoading = false,
  action,
}: PageHeaderProps) {
  return (
    <header className={`page-header${home ? " page-header-home" : ""}`}>
      <div className="page-header-leading">
        {onBack && (
          <button type="button" className="page-header-back" onClick={onBack} aria-label={backLoading ? "Saving match" : backLabel} aria-busy={backLoading} disabled={backLoading}>
            {backLoading ? <span className="page-header-spinner" aria-hidden="true" /> : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>}
          </button>
        )}
        {home ? (
          <div className="page-header-brand">
            <span className="brand-mark"><span /><i /></span>
            <strong>CricApp</strong>
          </div>
        ) : (
          <div className="page-header-copy">
            {eyebrow && <span>{eyebrow}</span>}
            <h1>{title}</h1>
          </div>
        )}
      </div>
      {action && <div className="page-header-actions">{action}</div>}
    </header>
  );
}
