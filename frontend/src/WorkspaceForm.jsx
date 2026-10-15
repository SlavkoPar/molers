import { useState } from "react";
import { readJson } from "./api.js";

const parseEmails = (text) => [
  ...new Set(
    text
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  ),
];

export default function WorkspaceForm({ workspace, onSaved, onCancel }) {
  const [name, setName] = useState(workspace?.name ?? "");
  const [emailsText, setEmailsText] = useState(
    workspace?.emails.join("\n") ?? ""
  );
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const emails = parseEmails(emailsText);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/workspace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, emails }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError(data.error || "Could not save workspace");
        return;
      }
      onSaved(data.workspace);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="workspace-form" onSubmit={submit}>
      <h2>{workspace ? "Edit workspace" : "Set up your workspace"}</h2>

      <label>
        WorkSpace
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="e.g. Acme Inc."
          required
          autoFocus
        />
      </label>

      <label>
        Member emails
        <textarea
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
          rows={6}
          placeholder={"one per line, or separated by commas\nalice@example.com\nbob@example.com"}
        />
        <small>
          {emails.length} {emails.length === 1 ? "email" : "emails"}
        </small>
      </label>

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Saving..." : "Save"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
