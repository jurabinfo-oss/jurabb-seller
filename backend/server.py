import json
import os
import re
import secrets
from datetime import datetime, timezone
from decimal import Decimal
from email.parser import BytesParser
from email.policy import default as email_default
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from pathlib import Path

from db import (
    get_conn, init_db, BASE_DIR,
    USING_POSTGRES, store_upload, read_upload,
)
from auth import hash_password, verify_password, create_session_token, session_expiry, now_iso, is_expired

UPLOAD_DIR = Path(os.environ.get("THRIFTLOOP_UPLOAD_DIR", str(BASE_DIR / "uploads")))
os.makedirs(UPLOAD_DIR, exist_ok=True)

ADMIN_EMAIL = os.environ.get("THRIFTLOOP_ADMIN_EMAIL", "admin@thriftloop.com")
ADMIN_PASSWORD = os.environ.get("THRIFTLOOP_ADMIN_PASSWORD", "admin123")


def json_response(handler, status, data):
    body = json.dumps(
        data,
        default=lambda o: float(o) if isinstance(o, Decimal) else str(o),
    ).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
    handler.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
    handler.end_headers()
    handler.wfile.write(body)


def read_json(handler):
    length = int(handler.headers.get("Content-Length", "0") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    if not raw:
        return {}
    return json.loads(raw.decode("utf-8"))


def get_bearer_token(handler):
    auth = handler.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth.split(" ", 1)[1].strip()
    return None


def get_current_user(handler):
    token = get_bearer_token(handler)
    if not token:
        return None
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT s.token, s.expires_at, u.id, u.email, u.role, u.name
        FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
        """,
        (token,),
    )
    row = cur.fetchone()
    if not row:
        conn.close()
        return None
    if is_expired(row["expires_at"]):
        cur.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        return None
    user = dict(row)
    # attach seller profile if any
    if user["role"] == "seller":
        cur.execute("SELECT * FROM seller_profiles WHERE user_id = ?", (user["id"],))
        sp = cur.fetchone()
        user["seller_profile"] = dict(sp) if sp else None
    conn.close()
    return user


def require_role(handler, roles):
    user = get_current_user(handler)
    if not user:
        json_response(handler, 401, {"error": "Unauthorized"})
        return None
    if user["role"] not in roles:
        json_response(handler, 403, {"error": "Forbidden"})
        return None
    return user


def ensure_admin_user():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT id, role FROM users WHERE email = ?", (ADMIN_EMAIL.lower(),))
    row = cur.fetchone()
    if not row:
        cur.execute(
            "INSERT INTO users (email,password_hash,role,name,created_at) VALUES (?,?,?,?,?)",
            (ADMIN_EMAIL.lower(), hash_password(ADMIN_PASSWORD), "admin", "Admin", now_iso()),
        )
    else:
        # The env var is authoritative, so changing THRIFTLOOP_ADMIN_PASSWORD
        # in the host (e.g. Render) actually resets the admin password.
        cur.execute(
            "UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?",
            (hash_password(ADMIN_PASSWORD), row["id"]),
        )
    conn.commit()
    conn.close()


def parse_multipart(handler):
    """Parse multipart/form-data without the deprecated cgi module."""
    ctype = handler.headers.get("Content-Type", "")
    length = int(handler.headers.get("Content-Length", "0") or 0)
    body = handler.rfile.read(length) if length > 0 else b""
    if "multipart/form-data" not in ctype:
        return {}, {}

    raw = b"Content-Type: " + ctype.encode("utf-8") + b"\r\nMIME-Version: 1.0\r\n\r\n" + body
    msg = BytesParser(policy=email_default).parsebytes(raw)
    fields = {}
    files = {}

    for part in msg.iter_parts():
        name = part.get_param("name", header="content-disposition")
        if not name:
            continue
        payload = part.get_payload(decode=True) or b""
        filename = part.get_filename()
        if filename:
            files[name] = {
                "filename": filename,
                "data": payload,
                "content_type": part.get_content_type(),
            }
        else:
            charset = part.get_content_charset() or "utf-8"
            fields[name] = payload.decode(charset, errors="replace")

    return fields, files


def save_upload_bytes(data, filename, prefix="file", content_type=None):
    if not data or not filename:
        return None
    base = os.path.basename(filename)
    safe = re.sub(r"[^a-zA-Z0-9._-]", "_", base)
    name = f"{prefix}_{secrets.token_hex(8)}_{safe}"
    public_path = f"/uploads/{name}"

    if USING_POSTGRES:
        # Free Render web services have an ephemeral filesystem. Store the
        # image in Postgres so it survives sleep/restart/redeploy.
        ctype = content_type or "application/octet-stream"
        store_upload(public_path, data, ctype)
    else:
        path = UPLOAD_DIR / name
        with open(path, "wb") as f:
            f.write(data)

    return public_path


class Handler(BaseHTTPRequestHandler):
    server_version = "ThriftLoopBackend/0.1"

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/api/health":
            return json_response(self, 200, {"ok": True, "time": now_iso()})

        if path.startswith("/uploads/"):
            return self.serve_upload(path)

        if path == "/api/auth/me":
            user = get_current_user(self)
            if not user:
                return json_response(self, 401, {"error": "Unauthorized"})
            user.pop("token", None)
            user.pop("expires_at", None)
            return json_response(self, 200, {"user": user})

        if path == "/api/admin/invites":
            user = require_role(self, ["admin"])
            if not user:
                return
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("SELECT * FROM seller_invites ORDER BY created_at DESC")
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return json_response(self, 200, {"invites": rows})

        if path == "/api/invites/validate":
            token = (qs.get("token") or [""])[0].strip()
            if not token:
                return json_response(self, 400, {"valid": False, "error": "Missing token"})
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("SELECT * FROM seller_invites WHERE token = ?", (token,))
            row = cur.fetchone()
            conn.close()
            if not row or row["status"] != "active":
                return json_response(self, 200, {"valid": False})
            return json_response(self, 200, {"valid": True, "token": token})

        if path == "/api/products":
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(
                """
                SELECT p.*, u.email as seller_email, sp.seller_code, sp.full_name as seller_full_name, sp.photo_path as seller_photo
                FROM products p
                JOIN users u ON u.id = p.seller_user_id
                LEFT JOIN seller_profiles sp ON sp.user_id = p.seller_user_id
                WHERE p.status = 'active'
                ORDER BY p.created_at DESC
                """
            )
            rows = []
            for r in cur.fetchall():
                d = dict(r)
                # anonymize for public
                d["seller"] = {"seller_code": d.pop("seller_code", None), "photo_path": d.pop("seller_photo", None)}
                d.pop("seller_email", None)
                d.pop("seller_full_name", None)
                rows.append(d)
            conn.close()
            return json_response(self, 200, {"products": rows})

        if m := re.match(r"^/api/products/(\d+)$", path):
            pid = int(m.group(1))
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(
                """
                SELECT p.*, sp.seller_code, sp.photo_path as seller_photo
                FROM products p LEFT JOIN seller_profiles sp ON sp.user_id = p.seller_user_id
                WHERE p.id = ?
                """,
                (pid,),
            )
            r = cur.fetchone()
            conn.close()
            if not r:
                return json_response(self, 404, {"error": "Not found"})
            d = dict(r)
            d["seller"] = {"seller_code": d.pop("seller_code", None), "photo_path": d.pop("seller_photo", None)}
            return json_response(self, 200, {"product": d})

        if path == "/api/orders":
            user = require_role(self, ["admin", "seller", "customer"])
            if not user:
                return
            conn = get_conn()
            cur = conn.cursor()
            base = """
                SELECT o.*, p.name AS product_name, sp.seller_code
                FROM orders o
                LEFT JOIN products p ON p.id = o.product_id
                LEFT JOIN seller_profiles sp ON sp.user_id = o.seller_user_id
            """
            if user["role"] == "admin":
                cur.execute(base + " ORDER BY o.created_at DESC")
            elif user["role"] == "seller":
                cur.execute(base + " WHERE o.seller_user_id = ? ORDER BY o.created_at DESC", (user["id"],))
            else:
                cur.execute(base + " WHERE o.buyer_user_id = ? ORDER BY o.created_at DESC", (user["id"],))
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return json_response(self, 200, {"orders": rows})

        if path == "/api/admin/summary":
            user = require_role(self, ["admin"])
            if not user:
                return
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) AS n FROM users WHERE role='customer'")
            customers = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(*) AS n FROM seller_profiles")
            sellers = cur.fetchone()["n"]
            cur.execute("SELECT COUNT(*) AS n FROM products WHERE status='active'")
            active_products = cur.fetchone()["n"]
            cur.execute("SELECT COALESCE(SUM(amount),0) AS total FROM orders")
            order_value = cur.fetchone()["total"]
            cur.execute("""
                SELECT o.*, p.name AS product_name, sp.seller_code
                FROM orders o
                LEFT JOIN products p ON p.id=o.product_id
                LEFT JOIN seller_profiles sp ON sp.user_id=o.seller_user_id
                ORDER BY o.created_at DESC LIMIT 5
            """)
            recent_orders = [dict(r) for r in cur.fetchall()]
            cur.execute("SELECT * FROM seller_profiles ORDER BY created_at DESC LIMIT 5")
            new_sellers = [dict(r) for r in cur.fetchall()]
            conn.close()
            return json_response(self, 200, {
                "summary": {
                    "customers": customers,
                    "sellers": sellers,
                    "active_products": active_products,
                    "order_value": order_value,
                },
                "recent_orders": recent_orders,
                "new_sellers": new_sellers,
            })

        if path == "/api/admin/users":
            user = require_role(self, ["admin"])
            if not user:
                return
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("SELECT id,email,role,name,created_at FROM users ORDER BY created_at DESC")
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return json_response(self, 200, {"users": rows})

        if path == "/api/admin/sellers":
            user = require_role(self, ["admin"])
            if not user:
                return
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("""
                SELECT sp.*,
                    (SELECT COUNT(*) FROM products p WHERE p.seller_user_id = sp.user_id) AS product_count,
                    (SELECT COUNT(*) FROM orders o WHERE o.seller_user_id = sp.user_id) AS order_count
                FROM seller_profiles sp ORDER BY sp.created_at DESC
            """)
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return json_response(self, 200, {"sellers": rows})

        if path == "/api/admin/products":
            user = require_role(self, ["admin"])
            if not user:
                return
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("""
                SELECT p.*, sp.seller_code, sp.full_name AS seller_name
                FROM products p LEFT JOIN seller_profiles sp ON sp.user_id = p.seller_user_id
                ORDER BY p.created_at DESC
            """)
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return json_response(self, 200, {"products": rows})

        if path == "/api/seller/products":
            user = require_role(self, ["seller"])
            if not user:
                return
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("SELECT * FROM products WHERE seller_user_id = ? ORDER BY created_at DESC", (user["id"],))
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return json_response(self, 200, {"products": rows})

        if m := re.match(r"^/api/sellers/(\d+)/reviews$", path):
            sid = int(m.group(1))
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("SELECT id,rating,text,created_at FROM reviews WHERE seller_user_id = ? ORDER BY created_at DESC", (sid,))
            rows = [dict(r) for r in cur.fetchall()]
            conn.close()
            return json_response(self, 200, {"reviews": rows})

        return json_response(self, 404, {"error": "Not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/auth/login":
            data = read_json(self)
            email = (data.get("email") or "").strip().lower()
            password = data.get("password") or ""
            role = data.get("role")
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("SELECT * FROM users WHERE email = ?", (email,))
            u = cur.fetchone()
            if not u or not verify_password(password, u["password_hash"]):
                conn.close()
                return json_response(self, 401, {"error": "Invalid credentials"})
            if role and u["role"] != role and not (role == "admin" and u["role"] == "admin"):
                conn.close()
                return json_response(self, 401, {"error": "Invalid credentials for role"})
            token = create_session_token()
            cur.execute(
                "INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)",
                (token, u["id"], now_iso(), session_expiry()),
            )
            conn.commit()
            user = dict(u)
            user.pop("password_hash", None)
            if user["role"] == "seller":
                cur.execute("SELECT * FROM seller_profiles WHERE user_id = ?", (u["id"],))
                sp = cur.fetchone()
                user["seller_profile"] = dict(sp) if sp else None
            conn.close()
            return json_response(self, 200, {"token": token, "user": user})

        if path == "/api/auth/register-customer":
            data = read_json(self)
            email = (data.get("email") or "").strip().lower()
            password = data.get("password") or ""
            name = (data.get("name") or "").strip() or email.split("@")[0]
            if not email or not password:
                return json_response(self, 400, {"error": "Email and password required"})
            conn = get_conn()
            cur = conn.cursor()
            try:
                cur.execute(
                    "INSERT INTO users (email,password_hash,role,name,created_at) VALUES (?,?,?,?,?)",
                    (email, hash_password(password), "customer", name, now_iso()),
                )
                uid = cur.lastrowid
                token = create_session_token()
                cur.execute(
                    "INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)",
                    (token, uid, now_iso(), session_expiry()),
                )
                conn.commit()
            except Exception as e:
                conn.close()
                return json_response(self, 400, {"error": "Could not create account", "detail": str(e)})
            cur.execute("SELECT id,email,role,name,created_at FROM users WHERE id = ?", (uid,))
            user = dict(cur.fetchone())
            conn.close()
            return json_response(self, 201, {"token": token, "user": user})

        if path == "/api/auth/logout":
            token = get_bearer_token(self)
            if token:
                conn = get_conn()
                conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
                conn.commit()
                conn.close()
            return json_response(self, 200, {"ok": True})

        if path == "/api/admin/invites":
            user = require_role(self, ["admin"])
            if not user:
                return
            token = secrets.token_urlsafe(18)
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO seller_invites (token,status,created_by,created_at) VALUES (?,?,?,?)",
                (token, "active", user["id"], now_iso()),
            )
            conn.commit()
            cur.execute("SELECT * FROM seller_invites WHERE token = ?", (token,))
            invite = dict(cur.fetchone())
            conn.close()
            return json_response(self, 201, {"invite": invite})

        if path == "/api/seller/signup":
            # multipart form: invite_token + fields + photo
            ctype = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in ctype:
                return json_response(self, 400, {"error": "Expected multipart/form-data"})
            fields, files = parse_multipart(self)
            invite_token = (fields.get("invite_token") or "").strip()
            full_name = (fields.get("full_name") or "").strip()
            email = (fields.get("email") or "").strip().lower()
            phone = (fields.get("phone") or "").strip()
            password = fields.get("password") or ""
            city = (fields.get("city") or "").strip()
            nationality = (fields.get("nationality") or "Indian").strip()
            handover_address = (fields.get("handover_address") or "").strip()
            photo = files.get("photo")

            if not invite_token:
                return json_response(self, 400, {"error": "Invite token required"})
            if not all([full_name, email, phone, password, city, nationality, handover_address]):
                return json_response(self, 400, {"error": "Missing required fields"})
            if nationality.lower() != "indian":
                return json_response(self, 400, {"error": "Nationality must be Indian"})
            if not photo or not photo.get("data"):
                return json_response(self, 400, {"error": "Real photo is required"})

            conn = get_conn()
            cur = conn.cursor()
            cur.execute("SELECT * FROM seller_invites WHERE token = ? AND status = 'active'", (invite_token,))
            invite = cur.fetchone()
            if not invite:
                conn.close()
                return json_response(self, 400, {"error": "Invalid or used invite"})
            cur.execute("SELECT id FROM users WHERE email = ?", (email,))
            if cur.fetchone():
                conn.close()
                return json_response(self, 400, {"error": "Email already registered"})

            try:
                cur.execute(
                    "INSERT INTO users (email,password_hash,role,name,created_at) VALUES (?,?,?,?,?)",
                    (email, hash_password(password), "seller", full_name, now_iso()),
                )
                uid = cur.lastrowid
                photo_path = save_upload_bytes(
                    photo["data"], photo["filename"],
                    prefix=f"seller_{uid}",
                    content_type=photo.get("content_type"),
                )
                seller_code = "SELL-" + secrets.token_hex(4).upper()
                cur.execute(
                    """INSERT INTO seller_profiles
                       (user_id,seller_code,full_name,phone,city,nationality,handover_address,photo_path,verification_status,created_at)
                       VALUES (?,?,?,?,?,?,?,?,?,?)""",
                    (uid, seller_code, full_name, phone, city, "Indian", handover_address, photo_path, "pending", now_iso()),
                )
                cur.execute(
                    "UPDATE seller_invites SET status='used', used_at=?, used_by_user_id=? WHERE id=?",
                    (now_iso(), uid, invite["id"]),
                )
                token = create_session_token()
                cur.execute(
                    "INSERT INTO sessions (token,user_id,created_at,expires_at) VALUES (?,?,?,?)",
                    (token, uid, now_iso(), session_expiry()),
                )
                conn.commit()
                cur.execute("SELECT id,email,role,name,created_at FROM users WHERE id=?", (uid,))
                user = dict(cur.fetchone())
                cur.execute("SELECT * FROM seller_profiles WHERE user_id=?", (uid,))
                user["seller_profile"] = dict(cur.fetchone())
            except Exception as e:
                conn.rollback()
                conn.close()
                return json_response(self, 500, {"error": "Signup failed", "detail": str(e)})
            conn.close()
            return json_response(self, 201, {"token": token, "user": user})

        if path == "/api/orders":
            # allow guest checkout for demo too? better require customer auth if available, but accept body
            data = read_json(self)
            user = get_current_user(self)
            product_id = data.get("product_id")
            buyer_delivery_address = (data.get("buyer_delivery_address") or "").strip()
            buyer_phone = (data.get("buyer_phone") or "").strip()
            preferred_delivery_time = data.get("preferred_delivery_time")
            note = (data.get("note") or "").strip()
            if not product_id or not buyer_delivery_address or not buyer_phone:
                return json_response(self, 400, {"error": "product_id, buyer_delivery_address, buyer_phone required"})
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("SELECT * FROM products WHERE id = ? AND status='active'", (product_id,))
            p = cur.fetchone()
            if not p:
                conn.close()
                return json_response(self, 404, {"error": "Product not available"})
            order_code = "ORD-" + secrets.token_hex(4).upper()
            cur.execute(
                """INSERT INTO orders
                   (order_code,product_id,buyer_user_id,seller_user_id,buyer_name,buyer_phone,buyer_delivery_address,preferred_delivery_time,note,status,amount,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    order_code, p["id"], (user["id"] if user and user["role"] == "customer" else None),
                    p["seller_user_id"], (user.get("name") if user else None), buyer_phone,
                    buyer_delivery_address, preferred_delivery_time, note,
                    "requested", p["price"], now_iso(), now_iso(),
                ),
            )
            # mark one-of-one item as sold in demo logic? keep simple: set sold
            cur.execute("UPDATE products SET status='sold' WHERE id=?", (p["id"],))
            conn.commit()
            oid = cur.lastrowid
            cur.execute("SELECT * FROM orders WHERE id=?", (oid,))
            order = dict(cur.fetchone())
            conn.close()
            return json_response(self, 201, {"order": order})

        if m := re.match(r"^/api/orders/(\d+)/status$", path):
            user = require_role(self, ["admin", "seller"])
            if not user:
                return
            oid = int(m.group(1))
            data = read_json(self)
            status = (data.get("status") or "").strip()
            if not status:
                return json_response(self, 400, {"error": "status required"})
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("SELECT * FROM orders WHERE id=?", (oid,))
            o = cur.fetchone()
            if not o:
                conn.close()
                return json_response(self, 404, {"error": "Not found"})
            if user["role"] == "seller" and o["seller_user_id"] != user["id"]:
                conn.close()
                return json_response(self, 403, {"error": "Forbidden"})
            cur.execute("UPDATE orders SET status=?, updated_at=? WHERE id=?", (status, now_iso(), oid))
            conn.commit()
            cur.execute("SELECT * FROM orders WHERE id=?", (oid,))
            order = dict(cur.fetchone())
            conn.close()
            return json_response(self, 200, {"order": order})

        if m := re.match(r"^/api/sellers/(\d+)/reviews$", path):
            sid = int(m.group(1))
            data = read_json(self)
            user = get_current_user(self)
            rating = int(data.get("rating") or 0)
            text = (data.get("text") or "").strip()
            if rating < 1 or rating > 5 or not text:
                return json_response(self, 400, {"error": "rating 1-5 and text required"})
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO reviews (seller_user_id,buyer_user_id,order_id,rating,text,created_at) VALUES (?,?,?,?,?,?)",
                (sid, (user["id"] if user else None), data.get("order_id"), rating, text, now_iso()),
            )
            conn.commit()
            rid = cur.lastrowid
            cur.execute("SELECT id,seller_user_id,rating,text,created_at FROM reviews WHERE id=?", (rid,))
            rev = dict(cur.fetchone())
            conn.close()
            return json_response(self, 201, {"review": rev})

        if path == "/api/seller/products":
            user = require_role(self, ["seller"])
            if not user:
                return
            ctype = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in ctype:
                return json_response(self, 400, {"error": "Expected multipart/form-data"})
            fields, files = parse_multipart(self)
            name = (fields.get("name") or "").strip()
            category = (fields.get("category") or "").strip().lower()
            price_raw = (fields.get("price") or "").strip()
            condition = (fields.get("condition") or "").strip()
            description = (fields.get("description") or "").strip()
            allowed = {"kurtis", "socks", "panties", "bra", "suit", "underwear"}
            try:
                price = float(price_raw)
            except (TypeError, ValueError):
                return json_response(self, 400, {"error": "Valid price required"})
            if not name or category not in allowed or price <= 0:
                return json_response(self, 400, {"error": "Name, valid category and price required"})
            image = files.get("image")
            image_path = save_upload_bytes(
                image["data"], image["filename"],
                prefix="product",
                content_type=image.get("content_type"),
            ) if image else None
            conn = get_conn()
            cur = conn.cursor()
            cur.execute(
                """INSERT INTO products (seller_user_id,name,category,price,condition,description,image_path,status,created_at)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (user["id"], name, category, price, condition or None, description or None,
                 image_path, "active", now_iso()),
            )
            conn.commit()
            pid = cur.lastrowid
            cur.execute("SELECT * FROM products WHERE id=?", (pid,))
            product = dict(cur.fetchone())
            conn.close()
            return json_response(self, 201, {"product": product})

        if m := re.match(r"^/api/seller/products/(\d+)/status$", path):
            user = require_role(self, ["seller"])
            if not user:
                return
            pid = int(m.group(1))
            data = read_json(self)
            status = (data.get("status") or "").strip().lower()
            if status not in {"active", "sold", "hidden"}:
                return json_response(self, 400, {"error": "Invalid status"})
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("UPDATE products SET status=? WHERE id=? AND seller_user_id=?", (status, pid, user["id"]))
            if cur.rowcount == 0:
                conn.close()
                return json_response(self, 404, {"error": "Product not found"})
            conn.commit()
            cur.execute("SELECT * FROM products WHERE id=?", (pid,))
            product = dict(cur.fetchone())
            conn.close()
            return json_response(self, 200, {"product": product})

        return json_response(self, 404, {"error": "Not found"})

    def serve_upload(self, path):
        # path like /uploads/filename
        if USING_POSTGRES:
            record = read_upload(path)
            if not record:
                return json_response(self, 404, {"error": "Not found"})
            data = bytes(record["data"])
            ctype = record["content_type"] or "application/octet-stream"
        else:
            name = path.rsplit("/", 1)[-1]
            fs_path = UPLOAD_DIR / name
            try:
                fs_path = fs_path.resolve()
                if UPLOAD_DIR.resolve() not in fs_path.parents:
                    return json_response(self, 403, {"error": "Forbidden"})
                if not fs_path.exists() or not fs_path.is_file():
                    return json_response(self, 404, {"error": "Not found"})
                data = fs_path.read_bytes()
                ext = fs_path.suffix.lower()
                ctype = {
                    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
                    ".gif": "image/gif", ".webp": "image/webp",
                }.get(ext, "application/octet-stream")
            except Exception:
                return json_response(self, 404, {"error": "Not found"})

        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)


def run(host="0.0.0.0", port=3001):
    init_db()
    ensure_admin_user()
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"ThriftLoop backend running on http://{host}:{port}")
    print(f"Admin: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
    httpd.serve_forever()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3001"))
    run(port=port)
