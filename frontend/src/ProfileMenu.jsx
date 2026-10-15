import { useEffect, useRef, useState } from "react";

export default function ProfileMenu({
  user,
  theme,
  onToggleTheme,
  onSignOut,
  onEditWorkspace,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();

  return (
    <div className="profile" ref={ref}>
      <button
        className="profile-button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        {user.picture ? (
          <img src={user.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span>{initial}</span>
        )}
      </button>

      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-info">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          {onEditWorkspace && (
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onEditWorkspace();
              }}
            >
              Edit workspace
            </button>
          )}
          <button role="menuitem" onClick={onToggleTheme}>
            {theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          </button>
          <button role="menuitem" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
