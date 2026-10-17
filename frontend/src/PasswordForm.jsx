import { useState } from "react";
import { readJson } from "./api.js";

export default function PasswordForm({ onSignedIn }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const registering = mode === "register";

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/auth/${registering ? "register" : "login"}`, {
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
    <form className="workspace-form auth-form" onSubmit={submit}>
      <nav className="tabs">
        <button
          type="button"
          aria-current={!registering ? "page" : undefined}
          onClick={() => {
            setMode("login");
            setError(null);
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          aria-current={registering ? "page" : undefined}
          onClick={() => {
            setMode("register");
            setError(null);
          }}
        >
          Create account
        </button>
      </nav>

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
          autoComplete={registering ? "new-password" : "current-password"}
          minLength={registering ? 8 : undefined}
          maxLength={128}
          required
        />
        {registering && <small>At least 8 characters.</small>}
      </label>

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="submit" disabled={busy || !email || !password}>
          {busy ? "Please wait..." : registering ? "Create account" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
