# ThriftLoop Backend (MVP)

Python backend for ThriftLoop. Uses SQLite locally and PostgreSQL in production.

## Requirements
- Python 3.10+
- `pip install -r requirements.txt` (installs the PostgreSQL driver when deploying)

## Run locally

```bash
cd backend
python3 server.py
```

Server starts on `http://localhost:3001` by default.

Environment variables:
- `PORT` (default `3001`)
- `THRIFTLOOP_ADMIN_EMAIL` (default `admin@thriftloop.com`)
- `THRIFTLOOP_ADMIN_PASSWORD` (default `admin123`)
- `DATABASE_URL` - Postgres connection string. When set, all data and uploaded
  images are stored in Postgres instead of local files. This is required on Render,
  where Free web services lose their local filesystem on sleep/restart/redeploy.

Without `DATABASE_URL`, data is stored in `backend/data/thriftloop.db` and uploaded
photos go to `backend/uploads/`.

## Implemented API (MVP)

### Health
- `GET /api/health`

### Auth
- `POST /api/auth/login` `{ email, password, role? }` -> `{ token, user }`
- `POST /api/auth/register-customer` `{ email, password, name? }` -> `{ token, user }`
- `GET /api/auth/me` (Bearer token)
- `POST /api/auth/logout`

### Seller invites (admin)
- `GET /api/admin/invites` (admin Bearer token)
- `POST /api/admin/invites` (admin Bearer token) -> creates single-use invite token
- `GET /api/invites/validate?token=...` -> `{ valid: true/false }`

### Seller signup (invite-gated)
- `POST /api/seller/signup` (`multipart/form-data`)
  - fields: `invite_token`, `full_name`, `email`, `phone`, `password`, `city`, `nationality` (must be `Indian`), `handover_address`
  - file: `photo` (required)
  - validates invite server-side, creates seller user/profile, marks invite used

### Products
- `GET /api/products` (public active products, seller info anonymized)
- `GET /api/products/:id`

### Orders (fulfillment: seller hands over to ThriftLoop, ThriftLoop delivers to customer)
- `POST /api/orders` `{ product_id, buyer_delivery_address, buyer_phone, preferred_delivery_time?, note? }`
  - creates order, marks one-of-one product as sold (MVP behavior)
- `GET /api/orders` (Bearer token; scoped by role: admin all, seller own, customer own)
- `POST /api/orders/:id/status` `{ status }` (admin/seller) to update handover/delivery status

### Reviews
- `GET /api/sellers/:sellerUserId/reviews`
- `POST /api/sellers/:sellerUserId/reviews` `{ rating, text, order_id? }`

### Uploads
- `GET /uploads/<filename>` serves uploaded seller/product images (from Postgres when `DATABASE_URL` is set)

## Admin / seller list endpoints
- `GET /api/admin/summary`, `/api/admin/users`, `/api/admin/sellers`, `/api/admin/products`
- `GET /api/seller/products` (own listings)
- `POST /api/seller/products` (multipart: name, category, price, condition, description, image)
- `POST /api/seller/products/:id/status` `{ status: active|sold|hidden }`

## Still to build/extend
- Seller verification/approval workflow and moderation
- Pagination, search and filters
- Review eligibility (only after a delivered order) and duplicate prevention
- Payment gateway integration + webhooks
- Notifications (email/SMS/WhatsApp)
- Production hardening (restrict CORS origins, rate limits, structured session storage, audit logs)

## Frontend integration notes
- Point `js/config.js` to the deployed backend URL.
- Send `Authorization: Bearer <token>` after login.
- All UI lists come from the API; there are no generated demo records.
