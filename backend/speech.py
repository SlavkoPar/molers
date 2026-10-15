import base64
import os

import requests

import audio

try:
    import truststore
except ImportError:  # optional: only needed where HTTPS is re-signed by a local root certificate
    pass
else:
    # Trust the operating system's certificate store, so HTTPS works behind antivirus or
    # corporate proxies that re-sign traffic with a locally installed root certificate.
    truststore.inject_into_ssl()

REQUEST_TIMEOUT_SECONDS = 120


class SpeechError(Exception):
    """The speech service is unavailable or could not transcribe the audio."""


def _settings():
    url = (os.environ.get("SPEECH_SERVER_URL") or "").rstrip("/")
    token = os.environ.get("SPEECH_SERVER_TOKEN") or ""
    language = os.environ.get("SPEECH_LANGUAGE") or "sr-RS"
    return url, token, language


def is_configured():
    url, token, _ = _settings()
    return bool(url and token)


def transcribe(data, duration_ms=None, language=None):
    """Speech-to-text for one voice message; returns the recognised text (maybe empty)."""
    url, token, default_language = _settings()
    language = language or default_language
    if not (url and token):
        raise SpeechError("Speech-to-text is not configured")

    try:
        amr = audio.to_amr_wb(data)
    except audio.AudioConversionError as e:
        raise SpeechError(str(e))

    try:
        res = requests.post(
            f"{url}/api/transcribe",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "audio": base64.b64encode(amr).decode("ascii"),
                "durationMs": duration_ms,
                "languageCode": language,
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as e:
        raise SpeechError(f"Speech service unreachable: {type(e).__name__}")

    try:
        body = res.json()
    except ValueError:
        body = {}
    if not res.ok:
        raise SpeechError(body.get("error") or f"Speech service returned HTTP {res.status_code}")
    return (body.get("text") or "").strip()
