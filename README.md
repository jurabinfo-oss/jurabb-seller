# ThriftLoop - Thrift Store E-Commerce Website

A modern, professional UI/UX thrift store website for selling pre-loved kurtis and ladies' socks with three distinct dashboards.

## Features

### 🛍️ Storefront
- **Modern Homepage** - Clean hero section with a refined pink accent
- **Product Catalog** - Browse kurtis and ladies' socks
- **Shopping Cart** - Add items to cart with sidebar functionality
- **Category Filtering** - Filter by Kurtis, Socks, or All
- **Responsive Design** - Mobile-friendly interface

### 👨‍💼 Seller Dashboard
- **Overview** - Sales stats, orders, earnings at a glance
- **Product Management** - Add, edit, and manage listings
- **Order Management** - Track and update order status
- **Shipping** - Add tracking numbers and courier details
- **Earnings** - View transaction history and analytics
- **Anonymous Profile** - Seller identity hidden from buyers

### 👑 Admin Dashboard
- **Platform Overview** - Total users, sellers, products, revenue
- **User Management** - Manage customers
- **Seller Management** - Monitor all sellers
- **Product Moderation** - Approve/reject listings
- **Order Monitoring** - View all platform orders
- **Reports & Flags** - Handle user reports
- **Privacy Settings** - Maintain buyer-seller anonymity

### 🛒 Customer Dashboard
- **Profile Management** - Update personal information
- **Order History** - Track all orders with status
- **Wishlist** - Save favorite items
- **Address Management** - Manage shipping addresses
- **Anonymous Shopping** - Identity hidden from sellers

## Privacy Features
- **Buyer-Seller Anonymity** - Buyers and sellers cannot see each other's personal information
- **Anonymous IDs** - Displayed as "Anonymous" throughout the platform
- **Admin Access** - Only admins can view full details for platform safety

## Tech Stack
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with CSS variables, soft shadows, transitions
- **Vanilla JavaScript** - No frameworks, pure JS
- **Python backend (MVP)** - `backend/` uses Python stdlib + SQLite (no external packages)
- **Font Awesome** - Icons
- **Google Fonts (Poppins)** - Typography

## Backend (MVP)

The `backend/` folder contains a Python + SQLite API for real accounts, admin-managed
seller invites, invite-gated seller signup with photo upload, products, orders, and reviews.

```bash
cd backend
python3 server.py
```

- API: `http://localhost:3001`
- Admin (auto-created on first run): `admin@thriftloop.com` / `admin123`
  (override with `THRIFTLOOP_ADMIN_EMAIL` / `THRIFTLOOP_ADMIN_PASSWORD`)
- Data: `backend/data/thriftloop.db`
- Uploaded seller photos: `backend/uploads/`

See `backend/README.md` for the full API list.

### Frontend ↔ backend
- `js/config.js` sets `window.THRIFTLOOP_API_BASE` (default `http://localhost:3001`).
- `js/api.js` provides a small fetch wrapper + Bearer token helpers.
- Admin invites and seller signup use the backend when reachable and fall back to
  the offline `localStorage` demo when the backend is not reachable.

## Getting Started

1. Start the backend (optional, for real accounts/invites):
   ```bash
   cd backend && python3 server.py
   ```
2. Serve the frontend from the project root:
   ```bash
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000`.

## File Structure
```
SweetSite/
├── index.html          # Main storefront
├── js/
│   ├── app.js          # Storefront JavaScript
│   ├── api.js          # Backend API client helper
│   └── config.js       # API base URL config
├── css/
│   └── style.css       # Main styles
├── backend/
│   ├── server.py       # Python HTTP API
│   ├── db.py           # SQLite schema/connection
│   ├── auth.py         # Password hashing/session helpers
│   ├── data/           # SQLite database (created on run)
│   └── uploads/        # Uploaded seller photos
├── pages/
│   ├── admin/          # Admin dashboard
│   ├── seller/         # Seller dashboard + signup
│   └── customer/       # Customer dashboard
└── README.md
```

## Demo Credentials (for testing)
- **Admin**: Use Admin tab in login modal
- **Seller**: Use Seller tab in login modal  
- **Customer**: Use Customer tab in login modal

## Design Highlights
- **Clean Light Theme** - Bright white background with blush and berry-pink accents
- **Minimal, Professional UI** - Soft borders, restrained shadows and generous spacing
- **Cohesive Palette** - Two pinks, white and soft ink applied across every page
- **Card-based Layout** - Clean, modern card designs
- **Accessible Contrast** - Readable text and buttons throughout
- **Mobile Responsive** - Works on all device sizes

---

Built with ❤️ for sustainable fashion
