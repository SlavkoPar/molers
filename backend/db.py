import os
import sqlite3

DB_PATH = os.environ.get(
    "DB_PATH", os.path.join(os.path.dirname(os.path.abspath(__file__)), "my.db")
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id         TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    name       TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspaces (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL,
    owner_id TEXT NOT NULL UNIQUE REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email        TEXT NOT NULL,
    PRIMARY KEY (workspace_id, email)
);


CREATE TABLE IF NOT EXISTS persons (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER REFERENCES workspaces(id),
    phone        TEXT NOT NULL,
    name         TEXT NOT NULL DEFAULT '',
    address      TEXT NOT NULL DEFAULT '',
    UNIQUE (workspace_id, phone)
);

CREATE TABLE IF NOT EXISTS exports (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS phone_calls (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id      INTEGER REFERENCES workspaces(id),
    created_by        TEXT REFERENCES users(id),
    person_id         INTEGER NOT NULL REFERENCES persons(id),
    phone             TEXT NOT NULL,
    name              TEXT NOT NULL DEFAULT '',
    address           TEXT NOT NULL DEFAULT '',
    called_at         TEXT NOT NULL,
    comment           TEXT,
    price_cents       INTEGER,
    call_type         TEXT,
    duration_seconds  INTEGER,
    location          TEXT NOT NULL DEFAULT '',
    number_label      TEXT NOT NULL DEFAULT '',
    country_iso       TEXT NOT NULL DEFAULT '',
    is_video          INTEGER NOT NULL DEFAULT 0,
    has_voice         INTEGER NOT NULL DEFAULT 0,
    voice_duration_ms INTEGER,
    transcript        TEXT NOT NULL DEFAULT '',
    export_id         INTEGER REFERENCES exports(id)
);

CREATE INDEX IF NOT EXISTS idx_phone_calls_person ON phone_calls(person_id);
CREATE INDEX IF NOT EXISTS idx_phone_calls_called_at ON phone_calls(called_at);

CREATE TABLE IF NOT EXISTS voice_messages (
    call_id   INTEGER PRIMARY KEY REFERENCES phone_calls(id) ON DELETE CASCADE,
    data      BLOB NOT NULL,
    mime_type TEXT NOT NULL
);
"""


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _columns(conn, table):
    return [r["name"] for r in conn.execute(f"PRAGMA table_info({table})")]


def _migrate(conn):
    """Bring databases created before workspaces up to date."""
    if "workspace_id" not in _columns(conn, "phone_calls"):
        conn.execute(
            "ALTER TABLE phone_calls ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id)"
        )

    if "created_by" not in _columns(conn, "phone_calls"):
        # calls stored before this stay NULL, so only the workspace owner sees them
        conn.execute(
            "ALTER TABLE phone_calls ADD COLUMN created_by TEXT REFERENCES users(id)"
        )

    if "workspace_id" not in _columns(conn, "persons"):
        # phone used to be globally unique; SQLite can only change that by rebuilding
        conn.executescript(
            """
            CREATE TABLE persons_new (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                workspace_id INTEGER REFERENCES workspaces(id),
                phone        TEXT NOT NULL,
                name         TEXT NOT NULL DEFAULT '',
                address      TEXT NOT NULL DEFAULT '',
                UNIQUE (workspace_id, phone)
            );
            INSERT INTO persons_new (id, phone, name, address)
                SELECT id, phone, name, address FROM persons;
            DROP TABLE persons;
            ALTER TABLE persons_new RENAME TO persons;
            """
        )


def init_db():
    with connect() as conn:
        conn.executescript(SCHEMA)
    # foreign keys off so the persons rebuild doesn't trip over phone_calls
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        _migrate(conn)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_phone_calls_workspace ON phone_calls(workspace_id)"
        )
        # an email may belong to one workspace only; keep the oldest entry of any duplicate
        conn.execute(
            """
            DELETE FROM workspace_members WHERE rowid NOT IN
                (SELECT MIN(rowid) FROM workspace_members GROUP BY email)
            """
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_workspace_members_email ON workspace_members(email)"
        )
        conn.commit()
    finally:
        conn.close()


def workspace_exists(workspace_id):
    with connect() as conn:
        return (
            conn.execute(
                "SELECT 1 FROM workspaces WHERE id = ?", (workspace_id,)
            ).fetchone()
            is not None
        )


def upsert_user(user_id, email, name):
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO users (id, email, name) VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name
            """,
            (user_id, email, name),
        )


def get_workspace(user_id, email):
    """The workspace the user owns, or else one that lists their email."""
    with connect() as conn:
        ws = conn.execute(
            "SELECT id, name, owner_id FROM workspaces WHERE owner_id = ?", (user_id,)
        ).fetchone()
        if not ws and email:
            ws = conn.execute(
                """
                SELECT w.id, w.name, w.owner_id FROM workspaces w
                JOIN workspace_members m ON m.workspace_id = w.id
                WHERE m.email = ? LIMIT 1
                """,
                (email.lower(),),
            ).fetchone()
        if not ws:
            return None
        emails = [
            r["email"]
            for r in conn.execute(
                "SELECT email FROM workspace_members WHERE workspace_id = ? ORDER BY email",
                (ws["id"],),
            )
        ]
        return {
            "id": ws["id"],
            "name": ws["name"],
            "emails": emails,
            "isOwner": ws["owner_id"] == user_id,
        }


def find_email_conflicts(owner_id, emails):
    """Emails that already belong to another user's workspace, as member or owner."""
    if not emails:
        return []
    marks = ",".join("?" * len(emails))
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT m.email FROM workspace_members m
            JOIN workspaces w ON w.id = m.workspace_id
            WHERE w.owner_id != ? AND m.email IN ({marks})
            UNION
            SELECT lower(u.email) FROM users u
            JOIN workspaces w ON w.owner_id = u.id
            WHERE u.id != ? AND lower(u.email) IN ({marks})
            """,
            [owner_id, *emails, owner_id, *emails],
        ).fetchall()
    taken = {r[0] for r in rows}
    return [e for e in emails if e in taken]


def save_workspace(owner_id, name, emails):
    """Create the owner's workspace, or replace its name and member emails."""
    with connect() as conn:
        ws = conn.execute(
            "SELECT id FROM workspaces WHERE owner_id = ?", (owner_id,)
        ).fetchone()
        if ws:
            workspace_id = ws["id"]
            conn.execute(
                "UPDATE workspaces SET name = ? WHERE id = ?", (name, workspace_id)
            )
            conn.execute(
                "DELETE FROM workspace_members WHERE workspace_id = ?", (workspace_id,)
            )
        else:
            workspace_id = conn.execute(
                "INSERT INTO workspaces (name, owner_id) VALUES (?, ?)",
                (name, owner_id),
            ).lastrowid
        conn.executemany(
            "INSERT INTO workspace_members (workspace_id, email) VALUES (?, ?)",
            [(workspace_id, e) for e in emails],
        )


def find_workspace_ids_by_name(name):
    with connect() as conn:
        return [
            r["id"]
            for r in conn.execute(
                "SELECT id FROM workspaces WHERE lower(name) = lower(?)", (name,)
            )
        ]


def _insert_call(conn, call, workspace_id, created_by):
    """Store one call as (status, call_id); status is inserted, updated or skipped.

    A call already stored is skipped, except that a voice message it was missing
    is attached ("updated").
    """
    voice = call.get("voice")
    existing = conn.execute(
        "SELECT id, has_voice FROM phone_calls "
        "WHERE workspace_id = ? AND phone = ? AND called_at = ?",
        (workspace_id, call["phone"], call["calledAt"]),
    ).fetchone()
    if existing:
        if voice and not existing["has_voice"]:
            conn.execute(
                "UPDATE phone_calls SET has_voice = 1, voice_duration_ms = ? WHERE id = ?",
                (voice["durationMs"], existing["id"]),
            )
            _store_voice(conn, existing["id"], voice)
            return "updated", existing["id"]
        return "skipped", existing["id"]

    row = conn.execute(
        "SELECT id FROM persons WHERE workspace_id = ? AND phone = ?",
        (workspace_id, call["phone"]),
    ).fetchone()
    if row:
        person_id = row["id"]
    else:
        person_id = conn.execute(
            "INSERT INTO persons (workspace_id, phone, name, address) VALUES (?, ?, ?, ?)",
            (workspace_id, call["phone"], call["name"], call["address"]),
        ).lastrowid

    call_id = conn.execute(
        """
        INSERT INTO phone_calls (
            workspace_id, created_by, person_id, phone, name, address, called_at, comment,
            price_cents, call_type, duration_seconds, location, number_label, country_iso,
            is_video, has_voice, voice_duration_ms, transcript
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            workspace_id,
            created_by,
            person_id,
            call["phone"],
            call["name"],
            call["address"],
            call["calledAt"],
            call["comment"],
            call["priceCents"],
            call["callType"],
            call["durationSeconds"],
            call["location"],
            call["numberLabel"],
            call["countryIso"],
            int(call["isVideo"]),
            int(voice is not None),
            voice["durationMs"] if voice else call.get("voiceDurationMs"),
            call["transcript"],
        ),
    ).lastrowid

    if voice:
        _store_voice(conn, call_id, voice)
    return "inserted", call_id


def _store_voice(conn, call_id, voice):
    conn.execute(
        "INSERT OR REPLACE INTO voice_messages (call_id, data, mime_type) VALUES (?, ?, ?)",
        (call_id, voice["data"], voice["mimeType"]),
    )


def get_voice(call_id):
    """The call's workspace and audio as a dict, or None if it has no voice message."""
    with connect() as conn:
        row = conn.execute(
            """
            SELECT c.workspace_id, c.created_by, v.data, v.mime_type
            FROM voice_messages v JOIN phone_calls c ON c.id = v.call_id
            WHERE v.call_id = ?
            """,
            (call_id,),
        ).fetchone()
    if not row:
        return None
    return {
        "workspaceId": row["workspace_id"],
        "createdBy": row["created_by"],
        "data": bytes(row["data"]),
        "mimeType": row["mime_type"],
    }


CALL_SELECT = """
    SELECT id, workspace_id, created_by, person_id, phone, name, address, called_at, comment,
           price_cents, call_type, duration_seconds, location, number_label,
           country_iso, is_video, has_voice, voice_duration_ms, transcript, export_id
    FROM phone_calls
"""


def _call_dict(r):
    """A phone_calls row in the shape of PhoneCall in Db.ts (no audio bytes)."""
    return {
        "id": r["id"],
        "workspaceId": r["workspace_id"],
        "createdBy": r["created_by"],
        "personId": r["person_id"],
        "phone": r["phone"],
        "name": r["name"],
        "address": r["address"],
        "calledAt": r["called_at"],
        "comment": r["comment"] or "",
        "priceCents": r["price_cents"],
        "callType": r["call_type"],
        "durationSeconds": r["duration_seconds"],
        "location": r["location"],
        "numberLabel": r["number_label"],
        "countryIso": r["country_iso"],
        "isVideo": bool(r["is_video"]),
        "hasVoice": bool(r["has_voice"]),
        "voiceDurationMs": r["voice_duration_ms"],
        "transcript": r["transcript"],
        "exportId": r["export_id"],
    }


def list_calls(workspace_id, query="", limit=25, offset=0, only_created_by=None):
    """Newest calls first. Returns (calls, total) where total ignores limit/offset.

    only_created_by limits the list to calls entered by that user.
    """
    where = "workspace_id = ?"
    params = [workspace_id]
    if only_created_by is not None:
        where += " AND created_by = ?"
        params.append(only_created_by)
    if query:
        escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like = f"%{escaped}%"
        where += (
            " AND (phone LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\'"
            " OR comment LIKE ? ESCAPE '\\' OR transcript LIKE ? ESCAPE '\\')"
        )
        params += [like] * 4
    with connect() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM phone_calls WHERE {where}", params
        ).fetchone()[0]
        rows = conn.execute(
            f"{CALL_SELECT} WHERE {where} ORDER BY called_at DESC, id DESC LIMIT ? OFFSET ?",
            [*params, limit, offset],
        ).fetchall()
    return [_call_dict(r) for r in rows], total


def report_calls(workspace_id, only_created_by=None, start=None, end=None, limit=5000):
    """Slim call rows with the author's name, newest first, for reports.

    start is inclusive and end exclusive (ISO timestamps). Returns (rows, truncated).
    """
    where = "c.workspace_id = ?"
    params = [workspace_id]
    if only_created_by is not None:
        where += " AND c.created_by = ?"
        params.append(only_created_by)
    if start:
        where += " AND c.called_at >= ?"
        params.append(start)
    if end:
        where += " AND c.called_at < ?"
        params.append(end)
    with connect() as conn:
        rows = conn.execute(
            f"""
            SELECT c.id, c.called_at, c.phone, c.name, c.call_type, c.duration_seconds,
                   c.price_cents, c.created_by, u.name AS user_name, u.email AS user_email
            FROM phone_calls c LEFT JOIN users u ON u.id = c.created_by
            WHERE {where}
            ORDER BY c.called_at DESC, c.id DESC LIMIT ?
            """,
            [*params, limit + 1],
        ).fetchall()
    calls = [
        {
            "id": r["id"],
            "calledAt": r["called_at"],
            "phone": r["phone"],
            "name": r["name"],
            "callType": r["call_type"],
            "durationSeconds": r["duration_seconds"],
            "priceCents": r["price_cents"],
            "userId": r["created_by"],
            "userName": r["user_name"] or r["user_email"],
        }
        for r in rows[:limit]
    ]
    return calls, len(rows) > limit


def calls_needing_transcript():
    """Ids of calls that have a voice message but no transcript yet, oldest first."""
    with connect() as conn:
        return [
            r["id"]
            for r in conn.execute(
                "SELECT id FROM phone_calls WHERE has_voice = 1 AND transcript = '' ORDER BY id"
            )
        ]


def set_transcript(call_id, text, only_if_empty=False):
    """Save a call's transcript; with only_if_empty a user's own text is never replaced."""
    sql = "UPDATE phone_calls SET transcript = ? WHERE id = ?"
    if only_if_empty:
        sql += " AND transcript = ''"
    with connect() as conn:
        conn.execute(sql, (text, call_id))


def get_call(call_id):
    with connect() as conn:
        row = conn.execute(f"{CALL_SELECT} WHERE id = ?", (call_id,)).fetchone()
    return _call_dict(row) if row else None


def insert_calls(items, created_by=None):
    """Store [(workspace_id, call), ...] in one transaction (all or nothing).

    created_by is the id of the user entering the calls (None for API-key uploads).
    Returns one (status, call_id) per item.
    """
    with connect() as conn:
        return [_insert_call(conn, call, ws_id, created_by) for ws_id, call in items]
