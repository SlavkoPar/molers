import { useEffect, useState } from "react";
import { readJson } from "./api.js";
import { formatDate, formatDuration, formatPrice } from "./format.js";

// apiBase: "/api/calls", or "/api/admin/calls" when the administrator views another
// workspace's call, which is read-only (no Transcribe button).
export default function CallDetail({
  callId,
  onBack,
  backLabel = "calls",
  apiBase = "/api/calls",
  readOnly = false,
}) {
  const [call, setCall] = useState(null);
  const [error, setError] = useState(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeMessage, setTranscribeMessage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setCall(null);
    setError(null);
    setTranscribeMessage(null);
    fetch(`${apiBase}/${callId}`)
      .then(async (res) => ({ res, body: await readJson(res) }))
      .then(({ res, body }) => {
        if (cancelled) return;
        if (res.ok) setCall(body.call);
        else setError(body.error || "Could not load the call");
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [callId, apiBase]);

  // A new voice message is transcribed in the background: check back until the text arrives.
  const awaitingTranscript = call?.hasVoice && !call.transcript;
  useEffect(() => {
    if (!awaitingTranscript) return;
    let tries = 0;
    const timer = setInterval(async () => {
      if (++tries > 20) {
        clearInterval(timer);
        return;
      }
      try {
        const res = await fetch(`${apiBase}/${callId}`);
        if (!res.ok) return;
        const { call: fresh } = await readJson(res);
        if (fresh?.transcript) setCall(fresh);
      } catch {
        // try again on the next tick
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [awaitingTranscript, callId, apiBase]);

  const transcribe = async () => {
    setTranscribing(true);
    setTranscribeMessage(null);
    try {
      const res = await fetch(`/api/calls/${callId}/transcribe`, { method: "POST" });
      const body = await readJson(res);
      if (!res.ok) {
        setTranscribeMessage(body.error || "Transcription failed");
      } else if (!body.recognized) {
        setTranscribeMessage("No speech was recognized in the recording.");
      } else {
        setCall((c) => ({ ...c, transcript: body.transcript }));
      }
    } catch (err) {
      setTranscribeMessage(err.message);
    } finally {
      setTranscribing(false);
    }
  };

  const rows = call && [
    ["Called at", formatDate(call.calledAt)],
    ["Phone", call.phone],
    ["Name", call.name],
    ["Address", call.address],
    ["Type", call.callType ? `${call.callType}${call.isVideo ? " (video)" : ""}` : ""],
    ["Duration", formatDuration(call.durationSeconds)],
    ["Price", formatPrice(call.priceCents)],
    ["Location", call.location],
    ["Number label", call.numberLabel],
    ["Country", call.countryIso],
    ["Comment", call.comment],
  ];

  return (
    <section className="call-detail">
      <button type="button" className="back" onClick={onBack}>
        ← Back to {backLabel}
      </button>

      {error && <p className="error">{error}</p>}
      {!call && !error && <p>Loading...</p>}

      {call && (
        <>
          <h2>{call.name || call.phone}</h2>

          <dl>
            {rows
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>

          {call.hasVoice && (
            <div className="voice">
              <h3>Voice message</h3>
              <audio controls preload="none" src={`${apiBase}/${call.id}/voice`} />
              {call.voiceDurationMs != null && (
                <small>{(call.voiceDurationMs / 1000).toFixed(1)}s</small>
              )}
            </div>
          )}

          {call.hasVoice && (
            <div className="transcript">
              <h3>Transcript</h3>
              {call.transcript ? (
                <p>{call.transcript}</p>
              ) : (
                <p className="muted">
                  No transcript yet. New voice messages are transcribed automatically,
                  which can take a few seconds.
                </p>
              )}
              {!readOnly && (
                <button type="button" onClick={transcribe} disabled={transcribing}>
                  {transcribing
                    ? "Transcribing..."
                    : call.transcript
                      ? "Transcribe again"
                      : "Transcribe"}
                </button>
              )}
              {transcribeMessage && <p className="error">{transcribeMessage}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
