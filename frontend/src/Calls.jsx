import { useState } from "react";
import CallDetail from "./CallDetail.jsx";
import CallForm from "./CallForm.jsx";
import CallList from "./CallList.jsx";
import Reports from "./Reports.jsx";

export default function Calls({ workspaceName, isOwner }) {
  // { name: "list" | "reports" | "new" } or { name: "detail", id, back } where back is the tab to return to
  const [view, setView] = useState({ name: "list" });

  // detail belongs to the tab it was opened from
  const tab = view.name === "detail" ? view.back : view.name;
  const openFrom = (back) => (id) => setView({ name: "detail", id, back });

  return (
    <>
      <nav className="tabs">
        {[
          ["list", "Calls"],
          ["reports", "Reports"],
          ["new", "New call"],
        ].map(([name, label]) => (
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

      {view.name === "list" && <CallList isOwner={isOwner} onOpen={openFrom("list")} />}
      {view.name === "reports" && <Reports isOwner={isOwner} onOpen={openFrom("reports")} />}
      {view.name === "detail" && (
        <CallDetail
          callId={view.id}
          backLabel={view.back === "reports" ? "reports" : "calls"}
          onBack={() => setView({ name: view.back })}
        />
      )}
      {view.name === "new" && (
        <CallForm workspaceName={workspaceName} onSaved={() => setView({ name: "list" })} />
      )}
    </>
  );
}
