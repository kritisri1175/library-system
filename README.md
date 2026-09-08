# 📚 Library Book Issue & Return Management System

A full-stack library management system with QR-code based issuing/returning,
student & admin portals, fine tracking, notifications, and an admin analytics
dashboard with downloadable reports.

**Stack:** Node.js + Express + SQLite (backend, self-contained — no external
DB server to install) and React + Vite + Tailwind (frontend). QR scanning
uses the device camera via `html5-qrcode`; QR generation uses `qrcode`.

---

## 1. Project layout

```
library-system/
  backend/     Express API + SQLite database (data/library.db, auto-created)
  frontend/    React app (Vite)
```

## 2. Requirements

- Node.js 18+ and npm
- A webcam (for the QR scan station) — or use a phone/webcam-connected laptop
  at the librarian's desk. Camera access requires HTTPS or `localhost`, both
  of which the dev servers below satisfy.

## 3. Backend setup

```bash
cd backend
npm install
cp .env.example .env      # edit values if you like (JWT secret, fine rate, etc.)
npm run seed               # loads 6 sample titles with multiple copies
npm start                   # runs on http://localhost:5000
```

On first boot the server automatically creates the SQLite schema and seeds a
default **admin** account from your `.env`:

```
ADMIN_EMAIL=admin@library.local
ADMIN_PASSWORD=Admin@123
```

Change these in `.env` before first run in any real deployment.

Key `.env` settings:

| Variable | Meaning |
|---|---|
| `BORROW_PERIOD_DAYS` | Default loan length in days (also editable live from Admin → Settings via API) |
| `FINE_PER_DAY` | Fine charged per day overdue |
| `JWT_SECRET` | Change this to a long random string |

## 4. Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev                 # runs on http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:5000`, so just open
`http://localhost:5173`.

## 5. Using the system

1. **Register a student** at `/register`. A QR ID card is generated
   immediately — download or screenshot it (also viewable anytime from the
   student's dashboard).
2. **Log in as admin** (seeded credentials above) and go to **Manage Books**
   to add titles (each gets N physical copies, each with its own QR).
   Click **Manage copies → QR** on any copy to view/download/print its
   label.
3. Go to **Scan Station** (`/admin/scan`):
   - *Issue*: scan the student's ID QR, then scan the book copy's QR.
   - *Return*: scan the book copy's QR directly.
   Both give an instant on-screen confirmation.
4. **Admin Dashboard** (`/admin`) shows live stats, most-borrowed titles,
   most active borrowers, category breakdown, and a 30-day issue trend chart.
5. **Transactions** (`/admin/transactions`) lists every loan with filters
   (status/category/date range) and lets you mark fines as paid.
6. **Reports** (`/admin/reports`) downloads CSV or PDF for: all
   transactions, overdue books, currently-issued books, and fines — all
   respecting the filters you set on that page.
7. Students track everything from **My Dashboard**: currently borrowed books
   with a due-date countdown, full history (downloadable as CSV), fine
   summary, and notifications (due-soon reminders / overdue alerts, generated
   by a daily cron sweep that also runs once at server boot).

## 6. Notes & extension points

- **Notifications** are currently in-app only (`notifications` table) and
  logged to the console; wiring real email requires filling in the SMTP
  values in `.env` and adding a `nodemailer` call where notifications are
  created in `server.js` / `routes/transactions.js`.
- **Book cover images** are simple URLs (see `seed.js` for examples pulling
  from Open Library covers) — swap in your own image upload flow if needed
  (a `multer` dependency is already included for this).
- **Auth** is JWT-based with a single `users` table distinguishing
  `role = 'student' | 'admin'`. Add more admin accounts by inserting directly
  or extending `/api/auth/register` with an admin-only variant.
- The SQLite file lives at `backend/data/library.db`. Delete it (server
  stopped) to reset all data, then re-run `npm run seed`.
- Fine and overdue status are recalculated live on every dashboard/report
  request and by the daily cron job — there's no need to run anything
  manually to "close the day."

## 7. Default login recap

| Role | Email | Password |
|---|---|---|
| Admin | value of `ADMIN_EMAIL` in `.env` (default `admin@library.local`) | value of `ADMIN_PASSWORD` (default `Admin@123`) |
| Student | whatever you register with | whatever you register with |
