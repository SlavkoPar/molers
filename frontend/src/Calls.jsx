import { useState } from "react";
import CallDetail from "./CallDetail.jsx";
import CallForm from "./CallForm.jsx";
import CallList from "./CallList.jsx";

export default function Calls({ workspaceName }) {
  // { name: "list" } | { name: "new" } | { name: "detail", id }
  const [view, setView] = useState({ name: "list" });

  return (
    <>
      <nav className="tabs">
        <button
          type="button"
          aria-current={view.name !== "new" ? "page" : undefined}
          onClick={() => setView({ name: "list" })}
        >
          Calls
        </button>
        <button
          type="button"
          aria-current={view.name === "new" ? "page" : undefined}
          onClick={() => setView({ name: "new" })}
        >
          New call
        </button>
      </nav>

      {view.name === "list" && (
        <CallList onOpen={(id) => setView({ name: "detail", id })} />
      )}
      {view.name === "detail" && (
        <CallDetail callId={view.id} onBack={() => setView({ name: "list" })} />
      )}
      {view.name === "new" && (
        <CallForm
          workspaceName={workspaceName}
          onSaved={() => setView({ name: "list" })}
        />
      )}
    </>
  );
}
