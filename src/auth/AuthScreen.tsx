import { useState } from "react";
import { supabase } from "../lib/supabase";

type AuthMode =
  | "welcome"
  | "signIn"
  | "signUp"
  | "forgot"
  | "verify"
  | "reset"
  | "resetSent"
  | "passwordUpdated";

type FieldProps = {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  placeholder: string;
  autoComplete?: string;
  onChange: (value: string) => void;
};

function Field({ id, label, type = "text", value, placeholder, autoComplete, onChange }: FieldProps) {
  const [visible, setVisible] = useState(false);
  const password = type === "password";

  return (
    <label className="auth-field" htmlFor={id}>
      <span>{label}</span>
      <span className="auth-input-wrap">
        <input
          id={id}
          type={password && visible ? "text" : type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          required
        />
        {password && (
          <button type="button" className="password-toggle" onClick={() => setVisible((current) => !current)}>
            {visible ? "Hide" : "Show"}
          </button>
        )}
      </span>
    </label>
  );
}

function Brand() {
  return (
    <div className="auth-brand">
      <span className="auth-brand-mark"><span /><i /></span>
      <strong>CricApp</strong>
    </div>
  );
}

export default function AuthScreen({
  initialMode = "welcome",
  onRecoveryComplete,
}: {
  initialMode?: AuthMode;
  onRecoveryComplete?: () => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMessage("");
    setPassword("");
    setConfirmPassword("");
    setMode(nextMode);
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setMessage(error.message);
    setBusy(false);
  }

  async function signUp(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setMessage(error.message);
    } else if (!data.session) {
      setMode("verify");
    }
    setBusy(false);
  }

  async function sendReset(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    if (error) setMessage(error.message);
    else setMode("resetSent");
    setBusy(false);
  }

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setMessage("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }

    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) setMessage(error.message);
    else setMode("passwordUpdated");
    setBusy(false);
  }

  const formMode = ["signIn", "signUp", "forgot", "reset"].includes(mode);

  return (
    <main className="auth-shell">
      <section className="auth-visual">
        <div className="auth-visual-shade" />
        <div className="auth-visual-content">
          <Brand />
          <div>
            <span className="auth-kicker">YOUR GAME. YOUR CLUB.</span>
            <h1>Every ball,<br />beautifully kept.</h1>
            <p>From the first toss to the final scorecard, keep your cricket together.</p>
          </div>
          <div className="auth-quote">
            <span>“</span>
            <p>Built for the people who make weekend cricket happen.</p>
          </div>
        </div>
      </section>

      <header className="mobile-auth-brand"><Brand /></header>
      <section className="auth-panel">
        {mode === "welcome" && (
          <div className="auth-content auth-welcome">
            <span className="auth-eyebrow">WELCOME TO CRICAPP</span>
            <h2>Cricket starts here.</h2>
            <p>Score matches, organize your club and keep every performance in one place.</p>
            <button type="button" className="auth-primary" onClick={() => changeMode("signUp")}>Create your account <span>→</span></button>
            <button type="button" className="auth-secondary" onClick={() => changeMode("signIn")}>I already have an account</button>
            <small>By continuing, you agree to CricApp’s Terms and Privacy Policy.</small>
          </div>
        )}

        {formMode && (
          <div className="auth-content">
            {mode !== "reset" && <button type="button" className="auth-back" onClick={() => changeMode(mode === "forgot" ? "signIn" : "welcome")}>← <span>Back</span></button>}
            <span className="auth-eyebrow">{mode === "signIn" ? "WELCOME BACK" : mode === "signUp" ? "JOIN THE CLUB" : mode === "forgot" ? "ACCOUNT RECOVERY" : "SECURE YOUR ACCOUNT"}</span>
            <h2>{mode === "signIn" ? "Sign in to CricApp" : mode === "signUp" ? "Create your account" : mode === "forgot" ? "Forgot your password?" : "Choose a new password"}</h2>
            <p>{mode === "signIn" ? "Your clubs, matches and scorecards are waiting." : mode === "signUp" ? "It only takes a minute to get match-ready." : mode === "forgot" ? "Enter your email and we’ll send you a secure reset link." : "Create a strong password you have not used before."}</p>

            <form className="auth-form" onSubmit={mode === "signIn" ? signIn : mode === "signUp" ? signUp : mode === "forgot" ? sendReset : updatePassword}>
              {mode === "signUp" && <Field id="name" label="Full name" value={name} placeholder="Your name" autoComplete="name" onChange={setName} />}
              {mode !== "reset" && <Field id="email" label="Email address" type="email" value={email} placeholder="you@example.com" autoComplete="email" onChange={setEmail} />}
              {(mode === "signIn" || mode === "signUp" || mode === "reset") && <Field id="password" label={mode === "reset" ? "New password" : "Password"} type="password" value={password} placeholder="At least 8 characters" autoComplete={mode === "signIn" ? "current-password" : "new-password"} onChange={setPassword} />}
              {(mode === "signUp" || mode === "reset") && <Field id="confirm-password" label="Confirm password" type="password" value={confirmPassword} placeholder="Enter it again" autoComplete="new-password" onChange={setConfirmPassword} />}
              {mode === "signIn" && <button type="button" className="forgot-link" onClick={() => changeMode("forgot")}>Forgot password?</button>}
              {message && <div className="auth-error" role="alert"><span>!</span>{message}</div>}
              <button type="submit" className="auth-primary" disabled={busy}>
                {busy ? <span className="button-loader" /> : mode === "signIn" ? "Sign in" : mode === "signUp" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"}
                {!busy && <span>→</span>}
              </button>
            </form>

            {(mode === "signIn" || mode === "signUp") && (
              <p className="auth-switch">
                {mode === "signIn" ? "New to CricApp?" : "Already have an account?"}
                <button type="button" onClick={() => changeMode(mode === "signIn" ? "signUp" : "signIn")}>{mode === "signIn" ? "Create an account" : "Sign in"}</button>
              </p>
            )}
          </div>
        )}

        {mode === "verify" && (
          <Confirmation
            symbol="✉"
            eyebrow="CHECK YOUR INBOX"
            title="Verify your email"
            body={<>We sent a verification link to <strong>{email}</strong>. Open it to activate your CricApp account.</>}
            primary="Open sign in"
            onPrimary={() => changeMode("signIn")}
            secondary="Use a different email"
            onSecondary={() => changeMode("signUp")}
          />
        )}

        {mode === "resetSent" && (
          <Confirmation
            symbol="↗"
            eyebrow="EMAIL SENT"
            title="Check your inbox"
            body={<>If an account exists for <strong>{email}</strong>, a password reset link is on its way.</>}
            primary="Back to sign in"
            onPrimary={() => changeMode("signIn")}
          />
        )}

        {mode === "passwordUpdated" && (
          <Confirmation
            symbol="✓"
            eyebrow="ALL SET"
            title="Password updated"
            body={<>Your password has been changed securely. You can continue to your CricApp account.</>}
            primary="Continue to CricApp"
            onPrimary={() => onRecoveryComplete?.()}
          />
        )}
      </section>
    </main>
  );
}

function Confirmation({
  symbol,
  eyebrow,
  title,
  body,
  primary,
  onPrimary,
  secondary,
  onSecondary,
}: {
  symbol: string;
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  primary: string;
  onPrimary: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="auth-content confirmation">
      <span className="confirmation-icon">{symbol}</span>
      <span className="auth-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{body}</p>
      <button type="button" className="auth-primary" onClick={onPrimary}>{primary} <span>→</span></button>
      {secondary && <button type="button" className="auth-secondary" onClick={onSecondary}>{secondary}</button>}
    </div>
  );
}
