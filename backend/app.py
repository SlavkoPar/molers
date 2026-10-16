import base64
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement  # building only, never parsing
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
import hmac
import os
import re
import sqlite3
import threading

import audio
import db
import speech
from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException
from dotenv import load_dotenv
from flask import Flask, Response, abort, jsonify, request, send_from_directory, session
from flask_cors import CORS
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import safe_join

load_dotenv()

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
API_KEY = os.environ.get("API_KEY")
MAX_WORKSPACE_EMAILS = 200
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

PRODUCTION = os.environ.get("PRODUCTION") == "1"
if PRODUCTION and not os.environ.get("SECRET_KEY"):
    raise RuntimeError("SECRET_KEY must be set when PRODUCTION=1")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-change-me")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=PRODUCTION,
    MAX_CONTENT_LENGTH=25 * 1024 * 1024,
)
if PRODUCTION:
    # behind Render's proxy: trust its forwarded scheme and host
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)
# the built app is served from this same origin in production; CORS is for the Vite dev server
CORS(
    app,
    supports_credentials=True,
    origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","),
)
db.init_db()


@app.errorhandler(HTTPException)
def http_error(e):
    if e.code == 413:
        limit_mb = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        return jsonify(error=f"Upload is too large (limit {limit_mb} MB)"), 413
    return jsonify(error=e.description), e.code


@app.errorhandler(Exception)
def unexpected_error(e):
    app.logger.exception("Unhandled error")
    detail = f": {type(e).__name__}: {e}" if app.debug else ""
    return jsonify(error=f"Server error{detail}"), 500


@app.get("/api/hello")
def hello():
    user = session.get("user") or {}
    name = user.get("name") or user.get("email")
    return jsonify(message=f"Hello {name}!" if name else "Hello!")


def _text(root, tag, default=""):
    el = root.find(tag)
    return (el.text or "").strip() if el is not None else default


def _int(root, tag):
    value = _text(root, tag)
    if value == "":
        return None
    try:
        return int(value)
    except ValueError:
        raise ValueError(f"<{tag}> must be an integer")


def sniff_audio_type(data):
    """Best-guess MIME type from the file header (m4a on phones, webm in browsers)."""
    if data[4:8] == b"ftyp":
        return "audio/mp4"
    if data[:4] == b"\x1aE\xdf\xa3":
        return "audio/webm"
    if data[:4] == b"OggS":
        return "audio/ogg"
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "audio/wav"
    if data[:3] == b"ID3" or data[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "audio/mpeg"
    return "application/octet-stream"


def _price_cents(call_el):
    """<priceCents> as-is, or <price> as a decimal amount converted to cents."""
    cents = _int(call_el, "priceCents")
    if cents is not None:
        return cents
    price = _text(call_el, "price")
    if price == "":
        return None
    try:
        return int((Decimal(price) * 100).to_integral_value(ROUND_HALF_UP))
    except InvalidOperation:
        raise ValueError("<price> must be a number")


def _parse_call(el):
    """Turn one <call> element into a dict shaped like NewPhoneCall."""
    call = {
        "workSpace": _text(el, "workSpace"),
        "workspaceId": _int(el, "workspaceId"),
        "phone": _text(el, "phone"),
        "name": _text(el, "name"),
        "address": _text(el, "address"),
        "calledAt": _text(el, "calledAt"),
        "comment": _text(el, "comment"),
        "priceCents": _price_cents(el),
        "callType": _text(el, "callType") or None,
        "durationSeconds": _int(el, "durationSeconds"),
        "location": _text(el, "location"),
        "numberLabel": _text(el, "numberLabel"),
        "countryIso": _text(el, "countryIso"),
        "isVideo": _text(el, "isVideo").lower() in ("true", "1"),
        "voiceDurationMs": _int(el, "voiceMessageMs"),
        "transcript": _text(el, "transcript"),
        "voice": None,
    }
    if not call["phone"]:
        raise ValueError("<phone> is required")
    if not call["calledAt"]:
        raise ValueError("<calledAt> is required")
    try:
        datetime.fromisoformat(call["calledAt"].replace("Z", "+00:00"))
    except ValueError:
        raise ValueError("<calledAt> must be an ISO 8601 timestamp")

    # base64 audio in <voiceMessage> (or <voice>); <voiceMessageMs> gives the duration
    voice = el.find("voiceMessage")
    if voice is None:
        voice = el.find("voice")
    if voice is not None and (voice.text or "").strip():
        tag = voice.tag
        try:
            data = base64.b64decode(re.sub(r"\s+", "", voice.text), validate=True)
        except ValueError:
            raise ValueError(f"<{tag}> must be base64 encoded")
        if not data:
            raise ValueError(f"<{tag}> is empty")
        duration = voice.get("durationMs")
        if duration is not None and not duration.isdigit():
            raise ValueError(f"<{tag} durationMs> must be an integer")
        call["voice"] = {
            "data": data,
            "mimeType": voice.get("mimeType") or sniff_audio_type(data),
            "durationMs": int(duration) if duration else call["voiceDurationMs"],
        }
    return call


FORM_FIELDS = (
    "workSpace", "workspaceId", "phone", "name", "address", "calledAt", "comment",
    "price", "priceCents", "callType", "durationSeconds", "location", "numberLabel",
    "countryIso", "isVideo", "voiceMessageMs", "transcript",
)  # fmt: skip


def parse_call_form(form, voice_file):
    """Build one call from multipart form fields plus an optional audio file."""
    el = Element("call")
    for key in FORM_FIELDS:
        if key in form:
            SubElement(el, key).text = form[key]
    call = _parse_call(el)

    if voice_file:
        data = voice_file.read()
        if not data:
            raise ValueError("voice file is empty")
        sniffed = sniff_audio_type(data)
        call["voice"] = {
            "data": data,
            "mimeType": (
                sniffed
                if sniffed != "application/octet-stream"
                else voice_file.mimetype or sniffed
            ),
            "durationMs": call["voiceDurationMs"],
        }
    return [call]


def parse_calls_xml(body):
    """Parse a <calls> export (many <call>) or a single <call> document."""
    try:
        root = ElementTree.fromstring(body)
    except (ElementTree.ParseError, DefusedXmlException):
        raise ValueError("Malformed XML")

    if root.tag == "call":
        elements = [root]
    elif root.tag == "calls":
        elements = root.findall("call")
    else:
        raise ValueError("Root element must be <calls> or <call>")
    if not elements:
        raise ValueError("No <call> elements found")

    calls = []
    for n, el in enumerate(elements, 1):
        try:
            calls.append(_parse_call(el))
        except ValueError as e:
            raise ValueError(f"Call {n}: {e}")
    return calls


def has_valid_api_key():
    """True when X-API-Key (or an Authorization: Bearer token) matches the configured API_KEY."""
    if not API_KEY:
        return False
    provided = request.headers.get("X-API-Key", "")
    if not provided:
        scheme, _, bearer = request.headers.get("Authorization", "").partition(" ")
        provided = bearer.strip() if scheme.lower() == "bearer" else ""
    return hmac.compare_digest(provided.encode(), API_KEY.encode())


def resolve_workspace_ids(calls, user):
    """Pick the workspace id for every call, or raise ValueError / PermissionError."""
    if user:
        workspace = db.get_workspace(user["id"], user["email"])
        if not workspace:
            raise PermissionError("Set up a workspace first")
        # signed-in users can only write to their own workspace
        for n, call in enumerate(calls, 1):
            name = call["workSpace"]
            if name and name.lower() != workspace["name"].lower():
                raise ValueError(
                    f"Call {n}: workspace '{name}' is not your workspace "
                    f"('{workspace['name']}')"
                )
        return [workspace["id"]] * len(calls)

    ids = []
    for n, call in enumerate(calls, 1):
        if call["workspaceId"] is not None:
            if not db.workspace_exists(call["workspaceId"]):
                raise ValueError(f"Call {n}: unknown workspace id")
            ids.append(call["workspaceId"])
        elif call["workSpace"]:
            found = db.find_workspace_ids_by_name(call["workSpace"])
            if not found:
                raise ValueError(f"Call {n}: unknown workspace '{call['workSpace']}'")
            if len(found) > 1:
                raise ValueError(
                    f"Call {n}: workspace name '{call['workSpace']}' is ambiguous; "
                    "send <workspaceId> instead"
                )
            ids.append(found[0])
        else:
            raise ValueError(f"Call {n}: <workSpace> or <workspaceId> is required")
    return ids


@app.post("/api/calls")
def upload_calls():
    user = session.get("user")
    if not user and not has_valid_api_key():
        return jsonify(error="Not authenticated"), 401

    try:
        if request.mimetype == "multipart/form-data":
            calls = parse_call_form(request.form, request.files.get("voice"))
        else:
            calls = parse_calls_xml(request.get_data())
        workspace_ids = resolve_workspace_ids(calls, user)
    except PermissionError as e:
        return jsonify(error=str(e)), 403
    except ValueError as e:
        return jsonify(error=str(e)), 400

    try:
        for call in calls:
            voice = call["voice"]
            if voice:
                voice["data"], voice["mimeType"] = audio.to_m4a(
                    voice["data"], voice["mimeType"]
                )
    except audio.AudioConversionError as e:
        return jsonify(error=str(e)), 400

    results = db.insert_calls(
        list(zip(workspace_ids, calls)), created_by=user["id"] if user else None
    )
    ids = [call_id for status, call_id in results if status == "inserted"]
    updated = sum(1 for status, _ in results if status == "updated")

    # transcribe new voice messages after responding, unless the upload brought its own text
    to_transcribe = [
        call_id
        for (status, call_id), call in zip(results, calls)
        if status != "skipped" and call["voice"] and not call["transcript"]
    ]
    if to_transcribe and speech.is_configured():
        transcribe_in_background(to_transcribe)

    return (
        jsonify(
            received=len(calls),
            inserted=len(ids),
            updated=updated,
            skipped=len(calls) - len(ids) - updated,
            ids=ids,
            transcribing=len(to_transcribe) if speech.is_configured() else 0,
        ),
        201 if ids else 200,
    )


def read_scope():
    """(workspace_id, only_by, None) for the caller, or (None, None, error response).

    The workspace owner sees every call in it. A member sees only the calls they entered
    themselves, so only_by is their user id; it is None when nothing is filtered out.
    API-key callers see all of one workspace and pass ?workspaceId=.
    """
    user = session.get("user")
    if user:
        workspace = db.get_workspace(user["id"], user["email"])
        if not workspace:
            return None, None, (jsonify(error="Set up a workspace first"), 403)
        only_by = None if workspace["isOwner"] else user["id"]
        return workspace["id"], only_by, None
    if not has_valid_api_key():
        return None, None, (jsonify(error="Not authenticated"), 401)
    workspace_id = request.args.get("workspaceId", type=int)
    if workspace_id is None or not db.workspace_exists(workspace_id):
        return None, None, (jsonify(error="A valid workspaceId is required"), 400)
    return workspace_id, None, None


def in_scope(item, workspace_id, only_by):
    """Whether a call (or voice record) may be seen under the caller's scope."""
    return bool(
        item
        and item["workspaceId"] == workspace_id
        and (only_by is None or item["createdBy"] == only_by)
    )


@app.get("/api/calls")
def list_calls():
    workspace_id, only_by, error = read_scope()
    if error:
        return error

    limit = min(max(request.args.get("limit", 25, type=int), 1), 200)
    offset = max(request.args.get("offset", 0, type=int), 0)
    query = request.args.get("q", "").strip()
    calls, total = db.list_calls(workspace_id, query, limit, offset, only_by)
    return jsonify(calls=calls, total=total, limit=limit, offset=offset)


REPORT_ROW_LIMIT = 5000


def _iso_arg(name):
    """A ?from= / ?to= timestamp, or None when absent. Raises ValueError if malformed."""
    value = request.args.get(name, "").strip()
    if not value:
        return None
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        raise ValueError(f"{name} must be an ISO 8601 timestamp")
    return value


@app.get("/api/reports/calls")
def report_calls():
    """Calls for the Reports tab: the owner gets the whole workspace, a member only their own."""
    workspace_id, only_by, error = read_scope()
    if error:
        return error
    try:
        start, end = _iso_arg("from"), _iso_arg("to")
    except ValueError as e:
        return jsonify(error=str(e)), 400

    calls, truncated = db.report_calls(workspace_id, only_by, start, end, REPORT_ROW_LIMIT)
    return jsonify(calls=calls, truncated=truncated, limit=REPORT_ROW_LIMIT)


@app.get("/api/calls/<int:call_id>")
def get_call(call_id):
    workspace_id, only_by, error = read_scope()
    if error:
        return error

    call = db.get_call(call_id)
    # a call outside the caller's reach looks the same as a missing one
    if not in_scope(call, workspace_id, only_by):
        return jsonify(error="Call not found"), 404
    return jsonify(call=call)


def transcribe_call(call_id, only_if_empty):
    """Run speech-to-text on a call's voice message and store the result in Transcript."""
    voice = db.get_voice(call_id)
    if not voice:
        return None
    call = db.get_call(call_id)
    text = speech.transcribe(voice["data"], call["voiceDurationMs"])
    if text:
        db.set_transcript(call_id, text, only_if_empty)
    return text


def transcribe_in_background(call_ids):
    def run():
        for call_id in call_ids:
            try:
                transcribe_call(call_id, only_if_empty=True)
            except speech.SpeechError as e:
                app.logger.warning("Transcription of call %s failed: %s", call_id, e)
            except Exception:
                app.logger.exception("Transcription of call %s crashed", call_id)

    threading.Thread(target=run, daemon=True).start()


@app.post("/api/calls/<int:call_id>/transcribe")
def transcribe_call_route(call_id):
    workspace_id, only_by, error = read_scope()
    if error:
        return error

    call = db.get_call(call_id)
    if not in_scope(call, workspace_id, only_by):
        return jsonify(error="Call not found"), 404
    if not call["hasVoice"]:
        return jsonify(error="This call has no voice message"), 400
    if not speech.is_configured():
        return jsonify(error="Speech-to-text is not configured"), 503

    try:
        text = transcribe_call(call_id, only_if_empty=False)
    except speech.SpeechError as e:
        return jsonify(error=str(e)), 502
    return jsonify(transcript=text or call["transcript"], recognized=bool(text))


@app.post("/api/transcribe")
def transcribe_audio():
    """Speech-to-text for the mobile app, so the speech server's token stays here.

    Same request and response as the speech server: {audio (base64), durationMs,
    languageCode} in, {text} out.
    """
    if "user" not in session and not has_valid_api_key():
        return jsonify(error="Not authenticated"), 401
    if not speech.is_configured():
        return jsonify(error="Speech-to-text is not configured"), 503

    body = request.get_json(silent=True) or {}
    try:
        data = base64.b64decode(body.get("audio") or "", validate=True)
    except ValueError:
        return jsonify(error="audio must be base64 encoded"), 400
    if not data:
        return jsonify(error="audio is required"), 400
    duration = body.get("durationMs")
    if duration is not None and not isinstance(duration, int):
        return jsonify(error="durationMs must be an integer"), 400
    language = body.get("languageCode")
    if language is not None and not re.fullmatch(r"[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*", str(language)):
        return jsonify(error="Invalid languageCode"), 400

    try:
        text = speech.transcribe(data, duration, language)
    except speech.SpeechError as e:
        return jsonify(error=str(e)), 502
    return jsonify(text=text)


@app.get("/api/calls/<int:call_id>/voice")
def get_call_voice(call_id):
    user = session.get("user")
    if not user and not has_valid_api_key():
        return jsonify(error="Not authenticated"), 401

    voice = db.get_voice(call_id)
    if voice and user:
        workspace = db.get_workspace(user["id"], user["email"])
        only_by = None if workspace and workspace["isOwner"] else user["id"]
        if not workspace or not in_scope(voice, workspace["id"], only_by):
            voice = None  # same answer as a missing call, so ids aren't probeable
    if not voice:
        return jsonify(error="No voice message"), 404
    return Response(voice["data"], mimetype=voice["mimeType"])


@app.post("/api/auth/google")
def auth_google():
    if not GOOGLE_CLIENT_ID:
        return jsonify(error="GOOGLE_CLIENT_ID is not configured"), 500

    credential = (request.get_json(silent=True) or {}).get("credential")
    if not credential:
        return jsonify(error="Missing credential"), 400

    try:
        info = id_token.verify_oauth2_token(
            credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError:
        return jsonify(error="Invalid Google token"), 401

    session["user"] = {
        "id": info["sub"],
        "email": info.get("email"),
        "name": info.get("name"),
        "picture": info.get("picture"),
    }
    db.upsert_user(info["sub"], info.get("email"), info.get("name"))
    return auth_payload(session["user"])


def auth_payload(user):
    return jsonify(user=user, workspace=db.get_workspace(user["id"], user["email"]))


@app.get("/api/auth/me")
def auth_me():
    user = session.get("user")
    if not user:
        return jsonify(error="Not authenticated"), 401
    return auth_payload(user)


@app.put("/api/workspace")
def save_workspace():
    user = session.get("user")
    if not user:
        return jsonify(error="Not authenticated"), 401

    current = db.get_workspace(user["id"], user["email"])
    if current and not current["isOwner"]:
        return jsonify(error="Only the workspace owner can edit it"), 403

    body = request.get_json(silent=True) or {}
    name = str(body.get("name") or "").strip()
    if not name:
        return jsonify(error="Workspace name is required"), 400
    if len(name) > 100:
        return jsonify(error="Workspace name is too long"), 400

    raw = body.get("emails")
    if not isinstance(raw, list):
        return jsonify(error="emails must be a list"), 400
    if len(raw) > MAX_WORKSPACE_EMAILS:
        return jsonify(error=f"At most {MAX_WORKSPACE_EMAILS} emails"), 400

    emails = []
    for item in raw:
        email = str(item).strip().lower()
        if not EMAIL_RE.match(email) or len(email) > 254:
            return jsonify(error=f"Invalid email: {email}"), 400
        if email not in emails:
            emails.append(email)

    taken = db.find_email_conflicts(user["id"], emails)
    if taken:
        return (
            jsonify(error="Already in another workspace: " + ", ".join(taken)),
            409,
        )

    try:
        db.save_workspace(user["id"], name, emails)
    except sqlite3.IntegrityError:
        # lost a race with another save that claimed the same email
        return jsonify(error="An email is already in another workspace"), 409
    return jsonify(workspace=db.get_workspace(user["id"], user["email"]))


@app.post("/api/auth/logout")
def auth_logout():
    session.clear()
    return jsonify(ok=True)


def transcribe_backlog():
    """Transcribe voice messages saved while speech-to-text was off or had failed."""
    if not speech.is_configured():
        return
    call_ids = db.calls_needing_transcript()
    if call_ids:
        app.logger.info("Transcribing %d call(s) without a transcript", len(call_ids))
        transcribe_in_background(call_ids)


FRONTEND_DIR = os.environ.get("FRONTEND_DIR") or os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "dist"
)

if os.path.isfile(os.path.join(FRONTEND_DIR, "index.html")):
    # serve the built React app (production); in development Vite serves it instead

    @app.get("/", defaults={"path": ""})
    @app.get("/<path:path>")
    def frontend(path):
        if path == "api" or path.startswith("api/"):
            abort(404)
        full = safe_join(FRONTEND_DIR, path)
        if path and full and os.path.isfile(full):
            # files under assets/ have content hashes in their names, so they never change
            max_age = 31536000 if path.startswith("assets/") else 3600
            return send_from_directory(FRONTEND_DIR, path, max_age=max_age)
        # any other path is a client-side route: hand it to the app
        return send_from_directory(FRONTEND_DIR, "index.html", max_age=0)


if os.environ.get("TRANSCRIBE_BACKLOG_ON_START") == "1":
    transcribe_backlog()


if __name__ == "__main__":
    # the debug reloader runs this file twice; only the serving process does the work
    if os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        transcribe_backlog()
    app.run(debug=True, port=5000)
