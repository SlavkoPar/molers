import { useEffect, useState } from "react";
import CallList from "./CallList.jsx";
import { readJson } from "./api.js";

// Administrator only: one workspace (owner, members) and all of its calls.
export default function AdminWorkspace({ workspaceId, onBack, onOpenCall }) {
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setWorkspace(null);
    setError(null);
    fetch(`/api/admin/workspaces/${workspaceId}`)
      .then(async (res) => ({ res, body: await readJson(res) }))
      .then(({ res, body }) => {
        if (cancelled) return;
        if (res.ok) setWorkspace(body.workspace);
        else setError(body.error || "Could not load the workspace");
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return (
    <section className="call-detail admin-workspace">
      <button type="button" className="back" onClick={onBack}>
        ← Back to workspaces
      </button>

      {error && <p className="error">{error}</p>}
      {!workspace && !error && <p>Loading...</p>}

      {workspace && (
        <>
          <h2>{workspace.name}</h2>
          <dl>
            <div>
              <dt>Owner</dt>
              <dd>
                {workspace.ownerName ? `${workspace.ownerName} · ` : ""}
                {workspace.ownerEmail}
              </dd>
            </div>
            <div>
              <dt>Members</dt>
              <dd>{workspace.emails.length ? workspace.emails.join(", ") : "none"}</dd>
            </div>
          </dl>

          <h3>Calls</h3>
          <CallList
            isOwner
            endpoint={`/api/admin/workspaces/${workspaceId}/calls`}
            onOpen={onOpenCall}
          />
        </>
      )}
    </section>
  );
}
