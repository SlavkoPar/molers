import { useState } from "react";
import { readJson } from "./api.js";

// Sign up or sign in with just an email address: the server mails a one-hour link.
export default function EmailLinkForm() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState(null);
  const [validMinutes, setValidMinutes] = useState(60);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/email-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError(data.error || "Could not send the link");
        return;
      }
      setValidMinutes(data.validMinutes ?? 60);
      setSentTo(email.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="workspace-form">
        <h2>Check your email</h2>
        <p>
          We sent a sign-in link to <strong>{sentTo}</strong>. It works once and expires in{" "}
          {validMinutes === 60 ? "one hour" : `${validMinutes} minutes`}.
        </p>
        <p className="muted">Nothing arrived? Check your spam folder, or try again.</p>
        <div className="form-actions">
          <button type="button" onClick={() => setSentTo(null)}>
            Use another email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="workspace-form" onSubmit={submit}>
      <h2>Sign up or sign in</h2>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
        <small>We email you a link that signs you in. No password needed.</small>
      </label>

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="submit" disabled={busy || !email.trim()}>
          {busy ? "Sending..." : "Email me a link"}
        </button>
      </div>
    </form>
  );
}
