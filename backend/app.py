import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

load_dotenv()

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-change-me")
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")
CORS(app, supports_credentials=True, origins=["http://localhost:5173"])


@app.get("/api/hello")
def hello():
    return jsonify(message="Hello Slavko!")


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
    return jsonify(user=session["user"])


@app.get("/api/auth/me")
def auth_me():
    user = session.get("user")
    if not user:
        return jsonify(error="Not authenticated"), 401
    return jsonify(user=user)


@app.post("/api/auth/logout")
def auth_logout():
    session.clear()
    return jsonify(ok=True)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
