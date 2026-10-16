import { useEffect, useState } from "react";
import { readJson } from "./api.js";
import { formatDuration, formatPrice } from "./format.js";
import { DATE_LEVEL, USER_LEVEL, buildTree, timeLabel, totals } from "./report.js";

const REPORTS = [
  { id: "date", label: "By date", levels: [DATE_LEVEL], ownerOnly: false },
  { id: "user-date", label: "By user, date", levels: [USER_LEVEL, DATE_LEVEL], ownerOnly: true },
  { id: "date-user", label: "By date, user", levels: [DATE_LEVEL, USER_LEVEL], ownerOnly: true },
];

const pad = (n) => String(n).padStart(2, "0");
const inputDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: inputDate(from), to: inputDate(to) };
}

function Stats({ calls }) {
  const t = totals(calls);
  return (
    <span className="stats">
      <span>{t.count} {t.count === 1 ? "call" : "calls"}</span>
      <span>{formatDuration(t.durationSeconds) || "0:00"}</span>
      <span>{formatPrice(t.priceCents) || "0.00"}</span>
    </span>
  );
}

function CallRows({ calls, onOpen }) {
  return (
    <table>
      <tbody>
        {calls.map((call) => (
          <tr
            key={call.id}
            tabIndex={0}
            onClick={() => onOpen(call.id)}
            onKeyDown={(e) => e.key === "Enter" && onOpen(call.id)}
          >
            <td>{timeLabel(call.calledAt)}</td>
            <td>
              <strong>{call.name || call.phone}</strong>
              {call.name && <small>{call.phone}</small>}
            </td>
            <td>{call.callType ?? ""}</td>
            <td>{formatDuration(call.durationSeconds)}</td>
            <td>{formatPrice(call.priceCents)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Nodes({ nodes, depth, onOpen }) {
  return nodes.map((node) => (
    <details key={node.key} className={`group depth-${depth}`} open={depth === 0}>
      <summary>
        <span className="group-title">{node.label}</span>
        <Stats calls={node.calls} />
      </summary>
      {node.children ? (
        <Nodes nodes={node.children} depth={depth + 1} onOpen={onOpen} />
      ) : (
        <CallRows calls={node.calls} onOpen={onOpen} />
      )}
    </details>
  ));
}

export default function Reports({ isOwner, onOpen }) {
  const available = REPORTS.filter((r) => isOwner || !r.ownerOnly);
  const [reportId, setReportId] = useState("date");
  const [range, setRange] = useState(defaultRange);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!range.from || !range.to || range.from > range.to) return;
    let cancelled = false;
    // whole local days: from the start of the first day up to the start of the day after the last
    const start = new Date(`${range.from}T00:00:00`);
    const end = new Date(`${range.to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    const params = new URLSearchParams({ from: start.toISOString(), to: end.toISOString() });

    fetch(`/api/reports/calls?${params}`)
      .then(async (res) => ({ res, body: await readJson(res) }))
      .then(({ res, body }) => {
        if (cancelled) return;
        if (!res.ok) setError(body.error || "Could not load the report");
        else {
          setError(null);
          setData(body);
        }
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const report = available.find((r) => r.id === reportId) ?? available[0];
  const invalidRange = !range.from || !range.to || range.from > range.to;
  const tree = data && !invalidRange ? buildTree(data.calls, report.levels) : null;

  return (
    <section className="reports">
      <div className="report-controls">
        {available.length > 1 && (
          <div className="segmented" role="tablist" aria-label="Report">
            {available.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={r.id === report.id}
                onClick={() => setReportId(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        <label>
          From
          <input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          />
        </label>
      </div>

      {!isOwner && (
        <p className="muted">This report covers the calls you entered.</p>
      )}
      {invalidRange && <p className="error">Choose a valid date range.</p>}
      {error && <p className="error">{error}</p>}
      {!data && !error && !invalidRange && <p>Loading...</p>}

      {data?.truncated && !invalidRange && (
        <p className="error">
          Only the newest {data.limit} calls are included. Narrow the date range to see
          the rest.
        </p>
      )}

      {tree && (tree.length === 0 ? (
        <p className="muted">No calls in this period.</p>
      ) : (
        <>
          <div className="report-total">
            <strong>Total</strong>
            <Stats calls={data.calls} />
          </div>
          <Nodes nodes={tree} depth={0} onOpen={onOpen} />
        </>
      ))}
    </section>
  );
}
