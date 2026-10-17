import { useState } from "react";
import { readJson } from "./api.js";

// Password sign-in for accounts that already have a password. New accounts are made
// with an emailed link (see EmailLinkForm), so there is no sign-up here.
export default function PasswordForm({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError(data.error || "Sign-in failed");
        return;
      }
      onSignedIn(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="password-signin">
      <summary>Sign in with a password</summary>
      <form className="workspace-form" onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </label>

        {error && <p className="error">{error}</p>}

        <div className="form-actions">
          <button type="submit" disabled={busy || !email || !password}>
            {busy ? "Please wait..." : "Sign in"}
          </button>
        </div>
      </form>
    </details>
  );
}
