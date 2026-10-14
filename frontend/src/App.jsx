import { useEffect, useRef, useState } from "react";

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
          if (!res.ok) {
            setError("Sign-in failed");
            return;
          }
          onSignedIn((await res.json()).user);
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

export default function App() {
  const [message, setMessage] = useState("Loading...");
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/hello")
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => setMessage(`Error: ${err.message}`));

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setUser(data?.user ?? null))
      .finally(() => setChecking(false));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.google?.accounts.id.disableAutoSelect();
    setUser(null);
  };

  return (
    <main>
      <h1>{message}</h1>
      {checking ? null : user ? (
        <p>
          Signed in as {user.name} ({user.email}){" "}
          <button onClick={logout}>Sign out</button>
        </p>
      ) : (
        <GoogleSignIn onSignedIn={setUser} />
      )}
    </main>
  );
}
