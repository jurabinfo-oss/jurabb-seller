# ThriftLoop Backend (MVP)

Python stdlib + SQLite backend for the ThriftLoop demo site.

## Requirements
- Python 3.10+
- No external packages required (uses `sqlite3`, `http.server`)

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

Data is stored in `backend/data/thriftloop.db`. Uploaded photos go to `backend/uploads/`.

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
- `GET /uploads/<filename>` serves uploaded seller/product images

## Still to build/extend
- Product create/edit/delete APIs for sellers + image upload
- Admin seller verification/approval workflow and moderation
- Stronger validation, pagination, search/filters
- Enforce review eligibility (only after delivered order), prevent duplicates
- Payment gateway integration + webhooks
- Notifications (email/SMS/WhatsApp)
- Production hardening (HTTPS, secure CORS origins, rate limits, better session storage, audit logs)
- Frontend integration: replace `localStorage` flows with these APIs

## Frontend integration notes
- Point frontend API base to backend URL (e.g. `http://localhost:3001` in dev, deployed backend URL in prod).
- Send `Authorization: Bearer <token>` after login.
- Update admin invite UI to call `/api/admin/invites` and use returned token.
- Update seller signup to POST multipart form to `/api/seller/signup` with invite token.
- Update buy flow to POST `/api/orders` with customer delivery address/phone.
- Use `/uploads/...` URLs for seller/product photos.
