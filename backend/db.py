import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("THRIFTLOOP_DATA_DIR", str(BASE_DIR / "data")))
DB_PATH = Path(os.environ.get("THRIFTLOOP_DB_PATH", str(DATA_DIR / "thriftloop.db")))

# Render Postgres (or any managed Postgres) uses DATABASE_URL.
# If it is present we use Postgres; otherwise local development keeps using SQLite.
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("THRIFTLOOP_DATABASE_URL")
USING_POSTGRES = bool(DATABASE_URL)

if USING_POSTGRES:
    import psycopg2
    from psycopg2 import Binary
    from psycopg2.extras import RealDictCursor


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _postgres_dsn(url):
    parsed = urlparse(url)
    scheme = "postgresql" if parsed.scheme in {"postgres", "postgresql"} else parsed.scheme
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    host = (parsed.hostname or "").lower()
    if "sslmode" not in query and host not in {"localhost", "127.0.0.1", "::1"}:
        query["sslmode"] = "require"
    return urlunparse((
        scheme,
        parsed.netloc,
        parsed.path,
        parsed.params,
        urlencode(query),
        parsed.fragment,
    ))


PG_DSN = _postgres_dsn(DATABASE_URL) if USING_POSTGRES else None


class CursorWrapper:
    """Small adapter so the same SQL works with sqlite3 (?) and psycopg2 (%s)."""

    def __init__(self, cursor, postgres):
        self._cursor = cursor
        self._postgres = postgres
        self.lastrowid = None

    def execute(self, sql, params=None):
        if self._postgres:
            sql = sql.replace("?", "%s")
            insert_match = re.match(r"^\s*INSERT\s+INTO\s+([a-zA-Z_][\w]*)", sql, re.IGNORECASE)
            needs_returning = False
            if insert_match:
                table = insert_match.group(1).lower()
                # These tables do not have an `id` column.
                if table not in {"sessions", "uploads"} and "RETURNING" not in sql.upper():
                    sql = sql.rstrip().rstrip(";") + " RETURNING id"
                    needs_returning = True
            self._cursor.execute(sql, params)
            if needs_returning:
                row = self._cursor.fetchone()
                self.lastrowid = row["id"] if row else None
        else:
            self._cursor.execute(sql, params or ())
            self.lastrowid = self._cursor.lastrowid
        return self

    def executemany(self, sql, seq_of_params):
        if self._postgres:
            sql = sql.replace("?", "%s")
        self._cursor.executemany(sql, seq_of_params)
        return self

    def executescript(self, sql_script):
        # sqlite3-only; used by init_db() in local development.
        self._cursor.executescript(sql_script)
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def close(self):
        self._cursor.close()

    @property
    def rowcount(self):
        return self._cursor.rowcount

    @property
    def description(self):
        return self._cursor.description


class ConnectionWrapper:
    def __init__(self, conn, postgres):
        self._conn = conn
        self._postgres = postgres

    def cursor(self):
        if self._postgres:
            cur = self._conn.cursor(cursor_factory=RealDictCursor)
        else:
            cur = self._conn.cursor()
        return CursorWrapper(cur, self._postgres)

    def execute(self, sql, params=None):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()


def get_conn():
    if USING_POSTGRES:
        conn = psycopg2.connect(PG_DSN, connect_timeout=10)
        return ConnectionWrapper(conn, True)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return ConnectionWrapper(conn, False)


SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','seller','customer')),
    name TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seller_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','used','revoked','expired')),
    created_by INTEGER,
    created_at TEXT NOT NULL,
    used_at TEXT,
    used_by_user_id INTEGER,
    expires_at TEXT,
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(used_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS seller_profiles (
    user_id INTEGER PRIMARY KEY,
    seller_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    nationality TEXT NOT NULL,
    handover_address TEXT NOT NULL,
    photo_path TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','approved','rejected','suspended')),
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    condition TEXT,
    description TEXT,
    image_path TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','sold','hidden')),
    created_at TEXT NOT NULL,
    FOREIGN KEY(seller_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_code TEXT UNIQUE NOT NULL,
    product_id INTEGER NOT NULL,
    buyer_user_id INTEGER,
    seller_user_id INTEGER NOT NULL,
    buyer_name TEXT,
    buyer_phone TEXT NOT NULL,
    buyer_delivery_address TEXT NOT NULL,
    preferred_delivery_time TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'requested',
    amount REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(buyer_user_id) REFERENCES users(id),
    FOREIGN KEY(seller_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_user_id INTEGER NOT NULL,
    buyer_user_id INTEGER,
    order_id INTEGER,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(seller_user_id) REFERENCES users(id),
    FOREIGN KEY(buyer_user_id) REFERENCES users(id),
    FOREIGN KEY(order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS uploads (
    path TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    data BLOB NOT NULL,
    created_at TEXT NOT NULL
);
"""


POSTGRES_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','seller','customer')),
    name TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seller_invites (
    id SERIAL PRIMARY KEY,
    token TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','used','revoked','expired')),
    created_by INTEGER,
    created_at TEXT NOT NULL,
    used_at TEXT,
    used_by_user_id INTEGER,
    expires_at TEXT,
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(used_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS seller_profiles (
    user_id INTEGER PRIMARY KEY,
    seller_code TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL,
    nationality TEXT NOT NULL,
    handover_address TEXT NOT NULL,
    photo_path TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('pending','approved','rejected','suspended')),
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    seller_user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    condition TEXT,
    description TEXT,
    image_path TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','sold','hidden')),
    created_at TEXT NOT NULL,
    FOREIGN KEY(seller_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_code TEXT UNIQUE NOT NULL,
    product_id INTEGER NOT NULL,
    buyer_user_id INTEGER,
    seller_user_id INTEGER NOT NULL,
    buyer_name TEXT,
    buyer_phone TEXT NOT NULL,
    buyer_delivery_address TEXT NOT NULL,
    preferred_delivery_time TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'requested',
    amount REAL NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(product_id) REFERENCES products(id),
    FOREIGN KEY(buyer_user_id) REFERENCES users(id),
    FOREIGN KEY(seller_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    seller_user_id INTEGER NOT NULL,
    buyer_user_id INTEGER,
    order_id INTEGER,
    rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(seller_user_id) REFERENCES users(id),
    FOREIGN KEY(buyer_user_id) REFERENCES users(id),
    FOREIGN KEY(order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS uploads (
    path TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    data BYTEA NOT NULL,
    created_at TEXT NOT NULL
);
"""


def init_db():
    if USING_POSTGRES:
        conn = get_conn()
        cur = conn.cursor()
        for statement in POSTGRES_SCHEMA.split(";"):
            statement = statement.strip()
            if statement:
                cur.execute(statement)
        conn.commit()
        conn.close()
        return

    os.makedirs(DATA_DIR, exist_ok=True)
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript(SQLITE_SCHEMA)
    conn.commit()
    conn.close()


def store_upload(path, data, content_type="application/octet-stream"):
    """Persist uploaded images in Postgres when using DATABASE_URL."""
    if not USING_POSTGRES:
        return
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO uploads (path,content_type,data,created_at) VALUES (?,?,?,?)",
        (path, content_type, Binary(data), _now_iso()),
    )
    conn.commit()
    conn.close()


def read_upload(path):
    if not USING_POSTGRES:
        return None
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT content_type,data FROM uploads WHERE path = ?", (path,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None
