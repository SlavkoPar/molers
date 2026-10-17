import { useCallback, useEffect, useRef, useState } from "react";
import { readJson } from "./api.js";
import EmailLinkForm from "./EmailLinkForm.jsx";
import PasswordForm from "./PasswordForm.jsx";
import ProfileMenu from "./ProfileMenu.jsx";
import Calls from "./Calls.jsx";
import WorkspaceForm from "./WorkspaceForm.jsx";
import "./App.css";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function GoogleSignIn({ onSignedIn }) {
  const buttonRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let timer;

    const init = () => {
      if (!window.google?.accounts?.id) {
        timer = setTimeout(init, 100);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: async ({ credential }) => {
          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential }),
          });
          const data = await readJson(res);
          if (!res.ok) {
            setError(data.error || "Sign-in failed");
            return;
          }
          onSignedIn(data);
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
      });
    };

    init();
    return () => clearTimeout(timer);
  }, [onSignedIn]);

  return (
    <>
      <div ref={buttonRef} />
      {error && <p>{error}</p>}
    </>
  );
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // ignore
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function App() {
  const [message, setMessage] = useState("Loading...");
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [theme, setTheme] = useState(getInitialTheme);
  const [workspace, setWorkspace] = useState(null);
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [linkError, setLinkError] = useState(null);

  const handleSignedIn = useCallback((data) => {
    setUser(data.user);
    setWorkspace(data.workspace);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // storage unavailable; theme just won't persist
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  // the greeting names the signed-in user, so ask again whenever the user changes
  const userId = user?.id;
  useEffect(() => {
    fetch("/api/hello")
      .then(readJson)
      .then((data) => setMessage(data.message ?? data.error))
      .catch((err) => setMessage(`Error: ${err.message}`));
  }, [userId]);

  // arriving from an emailed link (?signin=<token>): trade the token for a session
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("signin");
    if (!token) return;
    // take the token out of the address bar at once, so it stays out of history and screenshots
    window.history.replaceState({}, "", window.location.pathname);
    fetch("/api/auth/email-link/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => ({ res, body: await readJson(res) }))
      .then(({ res, body }) => {
        if (res.ok) handleSignedIn(body);
        else setLinkError(body.error || "That sign-in link did not work");
      })
      .catch((err) => setLinkError(err.message));
  }, [handleSignedIn]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? readJson(res) : null))
      .then((data) => data && handleSignedIn(data))
      .finally(() => setChecking(false));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.google?.accounts.id.disableAutoSelect();
    setUser(null);
    setWorkspace(null);
    setEditingWorkspace(false);
  };

  const needsWorkspace = user && !workspace;

  return (
    <>
      <header className="topbar">
        {user && (
          <ProfileMenu
            user={user}
            theme={theme}
            onToggleTheme={toggleTheme}
            onSignOut={logout}
            onEditWorkspace={
              workspace?.isOwner ? () => setEditingWorkspace(true) : undefined
            }
          />
        )}
      </header>
      <main>
        {needsWorkspace && user.emailVerified === false && (
          <p className="muted">
            Were you invited to a workspace? Sign out, then sign in with an emailed link
            (or Google) using the invited address. This account signs in with a password
            and its email isn't verified, so it can't join a workspace by invitation.
          </p>
        )}
        {needsWorkspace || editingWorkspace ? (
          <WorkspaceForm
            workspace={workspace}
            onSaved={(ws) => {
              setWorkspace(ws);
              setEditingWorkspace(false);
            }}
            onCancel={needsWorkspace ? undefined : () => setEditingWorkspace(false)}
          />
        ) : (
          <>
            <h1>{message}</h1>
            {user && workspace && <Calls workspaceName={workspace.name} isOwner={workspace.isOwner} />}
          </>
        )}
        {!checking && !user && (
          <div className="auth">
            {linkError && <p className="error">{linkError}</p>}
            <EmailLinkForm />
            <p className="muted">or</p>
            <GoogleSignIn onSignedIn={handleSignedIn} />
            <PasswordForm onSignedIn={handleSignedIn} />
          </div>
        )}
      </main>
    </>
  );
}
