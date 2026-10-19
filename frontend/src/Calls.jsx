import { useState } from "react";
import AdminWorkspace from "./AdminWorkspace.jsx";
import AdminWorkspaces from "./AdminWorkspaces.jsx";
import CallDetail from "./CallDetail.jsx";
import CallForm from "./CallForm.jsx";
import CallList from "./CallList.jsx";
import Reports from "./Reports.jsx";

export default function Calls({ workspaceName, isOwner, isAdmin }) {
  // { name: "list" | "reports" | "new" | "admin" }, { name: "adminWorkspace", id }, or
  // { name: "detail", id, back, admin } where back is the view to return to
  const [view, setView] = useState({ name: "list" });

  // the tab a view belongs to (a call detail belongs to the tab it was opened from)
  const owner = view.name === "detail" ? view.back : view;
  const tab = owner.name === "adminWorkspace" ? "admin" : owner.name;

  const tabs = [
    ["list", "Calls"],
    ["reports", "Reports"],
    ["new", "New call"],
    ...(isAdmin ? [["admin", "Workspaces"]] : []),
  ];

  return (
    <>
      <nav className="tabs">
        {tabs.map(([name, label]) => (
          <button
            key={name}
            type="button"
            aria-current={tab === name ? "page" : undefined}
            onClick={() => setView({ name })}
          >
            {label}
          </button>
        ))}
      </nav>

      {view.name === "list" && (
        <CallList
          isOwner={isOwner}
          onOpen={(id) => setView({ name: "detail", id, back: { name: "list" } })}
        />
      )}
      {view.name === "reports" && (
        <Reports
          isOwner={isOwner}
          onOpen={(id) => setView({ name: "detail", id, back: { name: "reports" } })}
        />
      )}
      {view.name === "new" && (
        <CallForm workspaceName={workspaceName} onSaved={() => setView({ name: "list" })} />
      )}

      {isAdmin && view.name === "admin" && (
        <AdminWorkspaces onOpen={(id) => setView({ name: "adminWorkspace", id })} />
      )}
      {isAdmin && view.name === "adminWorkspace" && (
        <AdminWorkspace
          workspaceId={view.id}
          onBack={() => setView({ name: "admin" })}
          onOpenCall={(id) =>
            setView({
              name: "detail",
              id,
              admin: true,
              back: { name: "adminWorkspace", id: view.id },
            })
          }
        />
      )}

      {view.name === "detail" && (
        <CallDetail
          callId={view.id}
          backLabel={
            view.back.name === "reports"
              ? "reports"
              : view.back.name === "adminWorkspace"
                ? "workspace"
                : "calls"
          }
          apiBase={view.admin ? "/api/admin/calls" : "/api/calls"}
          readOnly={Boolean(view.admin)}
          onBack={() => setView(view.back)}
        />
      )}
    </>
  );
}
