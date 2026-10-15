import { useCallback, useEffect, useRef, useState } from "react";
import { readJson } from "./api.js";

// Safari records mp4; Chrome/Firefox usually only support webm/ogg, so prefer mp4 when available.
const RECORDING_TYPES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"];

const pickRecordingType = () =>
  typeof MediaRecorder === "undefined"
    ? null
    : RECORDING_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

const extensionFor = (mimeType) =>
  mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";

const MIC_KEY = "micDeviceId";

const readSavedMic = () => {
  try {
    return localStorage.getItem(MIC_KEY) || "";
  } catch {
    return "";
  }
};

const saveMic = (id) => {
  try {
    localStorage.setItem(MIC_KEY, id);
  } catch {
    // storage unavailable; the choice just won't be remembered
  }
};

// Open the chosen microphone; fall back to the system default if it is gone (unplugged).
async function openMicrophone(deviceId) {
  if (deviceId) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });
    } catch (err) {
      if (err.name !== "OverconstrainedError" && err.name !== "NotFoundError") throw err;
    }
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

// Loudest sample (0..1) below which a recording counts as silent.
const SILENCE_LEVEL = 0.01;

// Report the microphone's current loudness (0..1) every 100 ms; returns a stop function.
function watchLevel(stream, onLevel) {
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(samples);
    let peak = 0;
    for (const s of samples) peak = Math.max(peak, Math.abs(s - 128) / 128);
    onLevel(peak);
  }, 100);
  return () => {
    clearInterval(timer);
    ctx.close();
  };
}

// value for <input type="datetime-local"> in local time
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const emptyFields = () => ({
  phone: "",
  name: "",
  address: "",
  calledAt: nowLocal(),
  callType: "incoming",
  durationSeconds: "",
  price: "",
  location: "",
  comment: "",
  isVideo: false,
});

export default function CallForm({ workspaceName, onSaved }) {
  const [fields, setFields] = useState(emptyFields);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [voice, setVoice] = useState(null); // { blob, url, durationMs }
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const startedAtRef = useRef(0);
  const peakRef = useRef(0);
  const testRef = useRef(null); // stops the microphone test
  const [level, setLevel] = useState(0);
  const [testing, setTesting] = useState(false);
  const [mics, setMics] = useState([]);
  const [micId, setMicId] = useState(readSavedMic);

  const set = (key) => (e) =>
    setFields((f) => ({
      ...f,
      [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 200);
    return () => clearInterval(timer);
  }, [recording]);

  // release the microphone and the preview URL when the form goes away
  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      testRef.current?.();
    },
    []
  );
  useEffect(() => () => voice && URL.revokeObjectURL(voice.url), [voice]);

  const loadMics = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    // Chrome adds "default"/"communications" aliases of real devices; "System default" covers them
    setMics(
      devices.filter(
        (d) =>
          d.kind === "audioinput" &&
          d.deviceId !== "default" &&
          d.deviceId !== "communications"
      )
    );
  }, []);

  // device names stay blank until the microphone has been allowed once, so reload after each open
  useEffect(() => {
    loadMics().catch(() => {});
    navigator.mediaDevices?.addEventListener?.("devicechange", loadMics);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", loadMics);
  }, [loadMics]);

  const chooseMic = (id) => {
    setMicId(id);
    saveMic(id);
  };

  const stopTest = () => {
    testRef.current?.();
    testRef.current = null;
    setTesting(false);
    setLevel(0);
  };

  const startTest = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone access is not supported in this browser");
      return;
    }
    try {
      const stream = await openMicrophone(micId);
      loadMics().catch(() => {});
      const stopMeter = watchLevel(stream, setLevel);
      testRef.current = () => {
        stopMeter();
        stream.getTracks().forEach((t) => t.stop());
      };
      setTesting(true);
    } catch (err) {
      setError(`Microphone unavailable: ${err.message}`);
    }
  };

  const startRecording = async () => {
    setError(null);
    stopTest();
    const type = pickRecordingType();
    if (type === null || !navigator.mediaDevices?.getUserMedia) {
      setError("Recording is not supported in this browser");
      return;
    }
    try {
      const stream = await openMicrophone(micId);
      loadMics().catch(() => {});
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      peakRef.current = 0;
      const stopMeter = watchLevel(stream, (level) => {
        peakRef.current = Math.max(peakRef.current, level);
        setLevel(level);
      });
      recorder.onstop = () => {
        stopMeter();
        stream.getTracks().forEach((t) => t.stop());
        const mimeType = recorder.mimeType || type || "audio/webm";
        const blob = new Blob(chunks, { type: mimeType });
        setVoice({
          blob,
          url: URL.createObjectURL(blob),
          durationMs: Date.now() - startedAtRef.current,
          silent: peakRef.current < SILENCE_LEVEL,
        });
        setLevel(0);
        setRecording(false);
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setVoice(null);
      recorder.start();
      setRecording(true);
    } catch (err) {
      setError(`Microphone unavailable: ${err.message}`);
    }
  };

  const stopRecording = () => recorderRef.current?.stop();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaved(null);
    setSaving(true);
    try {
      const body = new FormData();
      for (const [key, value] of Object.entries(fields)) {
        if (key === "calledAt") body.append(key, new Date(value).toISOString());
        else if (value !== "") body.append(key, String(value));
      }
      if (voice) {
        const mimeType = voice.blob.type || "audio/webm";
        body.append("voice", voice.blob, `voice.${extensionFor(mimeType)}`);
        body.append("voiceMessageMs", String(voice.durationMs));
      }
      const res = await fetch("/api/calls", { method: "POST", body });
      const data = await readJson(res);
      if (!res.ok) {
        setError(data.error || "Could not save the call");
        return;
      }
      setSaved(
        data.inserted
          ? "Call saved"
          : data.updated
            ? "Call already existed; voice message added"
            : "This call was already saved"
      );
      setVoice(null);
      setFields(emptyFields());
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const seconds = (ms) => (ms / 1000).toFixed(1);

  return (
    <form className="workspace-form call-form" onSubmit={submit}>
      <h2>New call{workspaceName ? ` · ${workspaceName}` : ""}</h2>

      <label>
        Phone
        <input value={fields.phone} onChange={set("phone")} required placeholder="+381..." />
      </label>
      <label>
        Name
        <input value={fields.name} onChange={set("name")} />
      </label>
      <label>
        Address
        <input value={fields.address} onChange={set("address")} />
      </label>

      <div className="form-row">
        <label>
          Called at
          <input
            type="datetime-local"
            value={fields.calledAt}
            onChange={set("calledAt")}
            required
          />
        </label>
        <label>
          Type
          <select value={fields.callType} onChange={set("callType")}>
            <option value="incoming">Incoming</option>
            <option value="outgoing">Outgoing</option>
            <option value="missed">Missed</option>
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Duration (seconds)
          <input
            type="number"
            min="0"
            value={fields.durationSeconds}
            onChange={set("durationSeconds")}
          />
        </label>
        <label>
          Price
          <input
            type="number"
            min="0"
            step="0.01"
            value={fields.price}
            onChange={set("price")}
          />
        </label>
      </div>

      <label>
        Location
        <input value={fields.location} onChange={set("location")} />
      </label>
      <label>
        Comment
        <textarea rows={3} value={fields.comment} onChange={set("comment")} />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={fields.isVideo} onChange={set("isVideo")} />
        Video call
      </label>

      <fieldset className="recorder">
        <legend>Voice message</legend>

        <label className="mic-select">
          Microphone
          <select
            value={mics.some((m) => m.deviceId === micId) ? micId : ""}
            onChange={(e) => chooseMic(e.target.value)}
            disabled={recording}
          >
            <option value="">System default</option>
            {mics.map((m, i) => (
              <option key={m.deviceId} value={m.deviceId}>
                {m.label || `Microphone ${i + 1}`}
              </option>
            ))}
          </select>
        </label>

        {(recording || testing) && (
          <meter
            className="level"
            min={0}
            max={0.5}
            value={level}
            aria-label="Microphone level"
          />
        )}

        {recording ? (
          <div>
            <span className="rec-dot" aria-hidden="true" /> Recording {seconds(elapsedMs)}s{" "}
            <button type="button" onClick={stopRecording}>
              Stop
            </button>
          </div>
        ) : (
          <>
            <div>
              <button type="button" onClick={startRecording} disabled={saving}>
                {voice ? "Record again" : "Record"}
              </button>{" "}
              <button type="button" onClick={testing ? stopTest : startTest} disabled={saving}>
                {testing ? "Stop test" : "Test microphone"}
              </button>
            </div>
            {voice && (
              <>
                {" "}
                <button type="button" onClick={() => setVoice(null)}>
                  Remove
                </button>
                <div>
                  {voice.silent && (
                    <p className="error">
                      No sound was recorded. Pick another microphone in the list above
                      (for example your webcam's), use Test microphone to check that the
                      level moves while you speak, then record again.
                    </p>
                  )}
                  <audio controls src={voice.url} />
                  <small>
                    {seconds(voice.durationMs)}s · {voice.blob.type || "audio"}
                  </small>
                </div>
              </>
            )}
          </>
        )}
      </fieldset>

      {error && <p className="error">{error}</p>}
      {saved && <p className="success">{saved}</p>}

      <div className="form-actions">
        <button type="submit" disabled={saving || recording || !fields.phone.trim()}>
          {saving ? "Saving..." : "Save call"}
        </button>
      </div>
    </form>
  );
}
