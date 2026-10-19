import { useEffect, useState } from "react";
import { readJson } from "./api.js";
import { formatDate, formatDuration, formatPrice } from "./format.js";

const PAGE_SIZE = 25;

// endpoint: where the list comes from (the administrator reads a chosen workspace's calls)
export default function CallList({ onOpen, isOwner, endpoint = "/api/calls" }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // wait for a pause in typing before searching
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setOffset(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ limit: PAGE_SIZE, offset });
    if (query) params.set("q", query);
    fetch(`${endpoint}?${params}`)
      .then(async (res) => ({ res, body: await readJson(res) }))
      .then(({ res, body }) => {
        if (cancelled) return;
        if (!res.ok) setError(body.error || "Could not load calls");
        else {
          setError(null);
          setData(body);
        }
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [endpoint, query, offset]);

  const total = data?.total ?? 0;
  const from = total ? offset + 1 : 0;
  const to = Math.min(offset + PAGE_SIZE, total);

  return (
    <section className="call-list">
      {!isOwner && (
        <p className="muted">
          You see only the calls you entered. The workspace owner sees all calls.
        </p>
      )}
      <input
        type="search"
        className="search"
        placeholder="Search phone, name, comment..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <p className="error">{error}</p>}
      {!data && !error && <p>Loading...</p>}

      {data && (
        <>
          {data.calls.length === 0 ? (
            <p className="muted">{query ? "No calls match your search." : "No calls yet."}</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Contact</th>
                    <th>Type</th>
                    <th>Duration</th>
                    <th>Price</th>
                    <th aria-label="Voice message" />
                  </tr>
                </thead>
                <tbody>
                  {data.calls.map((call) => (
                    <tr
                      key={call.id}
                      tabIndex={0}
                      onClick={() => onOpen(call.id)}
                      onKeyDown={(e) => e.key === "Enter" && onOpen(call.id)}
                    >
                      <td>{formatDate(call.calledAt)}</td>
                      <td>
                        <strong>{call.name || call.phone}</strong>
                        {call.name && <small>{call.phone}</small>}
                      </td>
                      <td>
                        {call.callType ?? ""}
                        {call.isVideo ? " (video)" : ""}
                      </td>
                      <td>{formatDuration(call.durationSeconds)}</td>
                      <td>{formatPrice(call.priceCents)}</td>
                      <td title={call.hasVoice ? "Has voice message" : ""}>
                        {call.hasVoice ? "🎙" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pager">
            <span className="muted">
              {from}–{to} of {total}
            </span>
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
