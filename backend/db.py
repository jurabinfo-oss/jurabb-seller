import sqlite3
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("THRIFTLOOP_DATA_DIR", str(BASE_DIR / "data")))
DB_PATH = Path(os.environ.get("THRIFTLOOP_DB_PATH", str(DATA_DIR / "thriftloop.db")))


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = get_conn()
    cur = conn.cursor()

    cur.executescript(
        """
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
        """
    )

    conn.commit()
    conn.close()
