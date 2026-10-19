import { useEffect, useState } from "react";
import { readJson } from "./api.js";
import { formatDate } from "./format.js";

// Administrator only: every workspace, with its owner and how much it holds.
export default function AdminWorkspaces({ onOpen }) {
  const [workspaces, setWorkspaces] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/workspaces")
      .then(async (res) => ({ res, body: await readJson(res) }))
      .then(({ res, body }) => {
        if (cancelled) return;
        if (res.ok) setWorkspaces(body.workspaces);
        else setError(body.error || "Could not load the workspaces");
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="call-list">
      <h2>All workspaces</h2>
      {error && <p className="error">{error}</p>}
      {!workspaces && !error && <p>Loading...</p>}
      {workspaces && workspaces.length === 0 && <p className="muted">No workspaces yet.</p>}

      {workspaces && workspaces.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Owner</th>
                <th>Members</th>
                <th>Calls</th>
                <th>Last call</th>
              </tr>
            </thead>
            <tbody>
              {workspaces.map((w) => (
                <tr
                  key={w.id}
                  tabIndex={0}
                  onClick={() => onOpen(w.id)}
                  onKeyDown={(e) => e.key === "Enter" && onOpen(w.id)}
                >
                  <td>
                    <strong>{w.name}</strong>
                  </td>
                  <td>
                    {w.ownerName || w.ownerEmail}
                    {w.ownerName && <small>{w.ownerEmail}</small>}
                  </td>
                  <td>{w.memberCount}</td>
                  <td>{w.callCount}</td>
                  <td>{w.lastCalledAt ? formatDate(w.lastCalledAt) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
