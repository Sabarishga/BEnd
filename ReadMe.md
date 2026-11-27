# Real-Time News Alerts

A full-stack MERN application that delivers personalised news alerts. Users register, choose the topics they care about, how often they want to hear about them (real-time, hourly or daily) and how (email and/or browser notifications). The server watches the headlines and delivers new stories on schedule. A dashboard keeps a searchable history of every alert.

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Technologies Used](#technologies-used)
4. [How It Works](#how-it-works)
5. [Security](#security)
6. [Project Structure](#project-structure)
7. [Installation](#installation)
8. [Environment Configuration](#environment-configuration)
9. [Checking That Email Works](#checking-that-email-works)
10. [API Documentation](#api-documentation)
11. [Deployment](#deployment)
12. [Known Limitations](#known-limitations)
13. [Author](#author)

---

## Overview

Staying on top of the news usually means checking several sites. This project flips that around: users pick their topics once, and relevant headlines reach them on the schedule and channel they choose.

- Visitors see what the app does and today's top headlines before signing up.
- Logged-in users get a live news feed for their topics that refreshes by itself.
- Alert preferences (topics, frequency, channels) are stored on the server and shown again on every visit.
- Every alert is recorded and can be reviewed on the dashboard.

---

## Features

**Alerts and notifications**
- Two delivery channels, chosen per user: **email** and **browser notifications** (desktop pop-ups while the site is open).
- Three frequencies: **Real-Time** (checked every minute), **Hourly** and **Daily**.
- No repeats: a story already delivered to a user is never sent to them again. Up to 10 new stories per alert.
- **"Send me a test alert now"** button to confirm delivery end to end.
- Alerts go to every subscribed user, whether or not they have the site open.

**Personalisation**
- Seven categories: business, entertainment, general, health, science, sports, technology.
- Preferences are saved on the server and restored on refresh and on every login.
- Turning alerts off keeps your topics for later.

**News feed**
- Merged feed for your saved topics, newest first, with a per-topic filter.
- Refreshes automatically every 5 minutes (and when you return to the tab). Stories that arrive meanwhile are marked **New**; stories published in the last 6 hours are marked **Breaking**.
- Missing or broken images are replaced by a placeholder.

**Dashboard**
- Full alert history with per-category counts, sorting, pagination and the channel each alert used.
- Filters live in the URL, so refresh and the Back button keep them.

**Accounts**
- Register, log in and log out with **JWT authentication**.
- Forgot password with an emailed one-time link (valid for 1 hour), and change password while logged in.
- Changing or resetting a password signs out every other device.

**Reliability**
- One shared news cache for the feed and the alert job, so NewsAPI is called at most once per category every 15 minutes.
- If NewsAPI is down, the feed falls back to stories already stored in MongoDB.
- One failing user or category never stops the others; overlapping job runs are skipped.
- Clear startup checks for missing configuration and a `/api/health` endpoint.

---

## Technologies Used

| Layer | Technology |
|---|---|
| Frontend | React 19 (Vite), React Router 7, Context API + `useReducer`, Tailwind CSS 4, Axios |
| Backend | Node.js, Express 4 |
| Database | MongoDB with Mongoose |
| Auth | JSON Web Tokens (`jsonwebtoken`), bcrypt password hashing |
| Security | Helmet, CORS allow-list, `express-rate-limit` |
| Scheduling | node-cron |
| Email | Gmail API (OAuth 2.0) over HTTPS **or** Gmail SMTP with an app password (Nodemailer) |
| News data | [NewsAPI](https://newsapi.org) top headlines |
| Deployment | Render (backend), Vercel (frontend) |

---

## How It Works

```
 ┌──────────────────────┐   HTTPS + JWT    ┌───────────────────────────────┐
 │  React app (Vercel)  │ ───────────────▶ │  Express API (Render)         │
 │  React Router        │ ◀─────────────── │  helmet · CORS · rate limits  │
 │  AuthContext         │                  │  protect → validate → handler │
 └──────────────────────┘                  │  central error handler        │
           ▲   polls for browser alerts    │                               │
           └────────────────────────────── │  node-cron (every minute):    │
                                           │   1. subscribed users         │
                                           │   2. is their alert due?      │
                                           │   3. fetch news (cached)      │
                                           │   4. drop already-sent        │
                                           │   5. email and/or browser     │
                                           │   6. save history             │
                                           └──────┬─────────────────┬──────┘
                                           ┌──────▼─────┐    ┌──────▼─────┐
                                           │  MongoDB   │    │  NewsAPI   │
                                           └────────────┘    └────────────┘
```

---

## Security

- **Authentication:** login and registration return a signed JWT (default lifetime 30 days, `JWT_EXPIRES_IN`). The frontend sends it as `Authorization: Bearer <token>`.
- **Authorization:** every private route runs the `protect` middleware, which verifies the token and loads the user. Controllers only ever use `req.user`, never an email or id from the request, so users cannot read or change each other's data. `authorize('admin')` guards admin-only routes (creating categories).
- **Session revocation:** each token carries the user's `tokenVersion`. Changing or resetting the password increments it, which invalidates all older tokens.
- **Passwords:** bcrypt (12 rounds). At least 8 characters with a letter and a number; at most 72 bytes (bcrypt's limit). Reset tokens are random, stored only as SHA-256 hashes, single-use and expire after 1 hour. Login and forgot-password give the same answer whether or not an email is registered.
- **Validation:** every request body and query is checked by a small schema validator (`src/utils/rules.js`, `src/middleware/validate.js`). Unknown fields are dropped and invalid input returns `400` with a message per field.
- **Errors:** one central error handler returns `{ success: false, message, errors? }`. Unexpected errors are logged in full but clients only see a generic message.
- **Hardening:** Helmet security headers, CORS limited to `CLIENT_URL`, a 20 kB body limit, rate limits on the API (600 requests / 15 min), auth routes (20 / 15 min) and test alerts (5 / 15 min).
- **Secrets:** read only from environment variables (`src/config/env.js`). `.env` files are gitignored; only `.env.example` templates are committed.

---

## Project Structure

```
Backend/
├── server.js                  # Checks config, connects to MongoDB, starts API + alert job
├── .env.example               # Template for environment variables (no real values)
└── src/
    ├── app.js                 # Express app: security middleware, routes, error handler
    ├── config/
    │   ├── env.js             # Reads and validates environment variables
    │   └── db.js              # MongoDB connection
    ├── constants/newsCategories.js
    ├── Controllers/           # NOTE: capital "C" - folder names are case-sensitive on Linux
    │   ├── authController.js
    │   ├── preferencesController.js
    │   ├── notificationController.js
    │   ├── newsController.js
    │   └── categoryController.js
    ├── middleware/
    │   ├── auth.js            # signToken, protect, authorize
    │   ├── validate.js        # Request validation
    │   ├── errorHandler.js    # 404 + central error handler
    │   └── rateLimiters.js
    ├── jobs/newsJob.js        # Cron job, runs every minute
    ├── models/                # User, Notification, NewsArticle, Category
    ├── routes/                # auth, preferences, notifications, news, categories
    ├── services/
    │   ├── alertService.js    # Decides what to send and delivers it
    │   ├── newsService.js     # NewsAPI client + shared cache
    │   └── emailService.js    # Gmail API / SMTP sender and email templates
    └── utils/                 # AppError, asyncHandler, validation rules

Frontend/
├── .env.example
├── vercel.json                # Sends every path to index.html (client-side routing)
└── src/
    ├── main.jsx               # BrowserRouter + ToastProvider + AuthProvider
    ├── App.jsx                # All routes
    ├── api/
    │   ├── client.js          # Axios instance: token, error messages, 401 handling
    │   └── index.js           # One function per endpoint
    ├── context/
    │   ├── AuthContext.jsx    # Logged-in user + preferences (useReducer)
    │   └── ToastContext.jsx   # App-wide messages
    ├── hooks/
    │   ├── useNewsFeed.js     # Feed loading + auto-refresh + "new" detection
    │   └── useBrowserAlerts.js# Desktop notifications
    ├── components/            # AppLayout, RouteGuards, AlertSettings, NewsFeed, ArticleCard, AuthComponents
    └── pages/                 # Landing, Login, Register, ForgotPassword, ResetPassword,
                               # ChangePassword, Feed, Dashboard, NotFound
```

### Frontend routes

| Path | Access | Page |
|---|---|---|
| `/` | Public | Landing page with live headlines |
| `/login`, `/register`, `/forgot-password` | Logged-out only | Auth pages |
| `/reset-password?email=&token=` | Public | Opened from the reset email |
| `/feed` | Logged in | News feed + alert settings |
| `/dashboard` | Logged in | Alert history |
| `/settings/password` | Logged in | Change password |

---

## Installation

### Prerequisites

- Node.js 24.x and npm
- A MongoDB database (a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster works well)
- A free [NewsAPI](https://newsapi.org) key
- A Gmail account for sending email (see [Email setup](#email-setup))

### 1. Backend

```bash
cd Backend
npm install
cp .env.example .env    
npm run dev            
```

Generate a `JWT_SECRET` with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The API starts on `http://localhost:5000`. On startup the logs show `MongoDB connected`, `[newsJob] scheduled` and `[email] ready (...)`. If something is missing, the server tells you exactly which variable.

### 2. Frontend

```bash
cd Frontend
npm install
cp .env.example .env  
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173`). In development, if `VITE_API_URL` is empty, Vite proxies `/api` to `http://localhost:5000`.

### 3. Try it out

1. Open the site, press **Sign up free** and create an account with **your own real email address**.
2. On the feed page, pick some topics, choose **Real-Time**, keep **Email** ticked and press **Save preferences**.
3. Press **Send me a test alert now**: an email arrives within seconds (check spam).
4. Refresh the page or log out and back in: your choices are still there.
5. Open **Dashboard** to see the history.

---

## Environment Configuration

### Backend (`Backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | API port. Defaults to `5000`. |
| `NODE_ENV` | No | Set to `production` on Render. |
| `MONGODB_URI` | Yes | MongoDB connection string. |
| `JWT_SECRET` | Yes | Random string of at least 32 characters used to sign tokens. |
| `JWT_EXPIRES_IN` | No | Token lifetime, e.g. `30d` (default), `7d` or `12h`. |
| `NEWS_API_KEY` | Yes | Your NewsAPI key. |
| `EMAIL_USER` | Yes | Gmail address that sends the alerts. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` | Option A | Gmail API credentials. **Required on Render's free plan.** |
| `EMAIL_PASS` | Option B | Gmail [app password](https://myaccount.google.com/apppasswords) for SMTP. Works locally; Render's free plan blocks SMTP. |
| `EMAIL_FROM_NAME` | No | Sender name. Defaults to `News Alerts`. |
| `CLIENT_URL` | Yes | Frontend URL(s), comma-separated, no trailing slash. Used for CORS and email links. |
| `NEWS_CACHE_MINUTES` | No | How long fetched news is reused. Defaults to `15`. |
| `NEWS_JOB_DEBUG` | No | `true` logs every decision the alert job makes. |
| `RUN_ALERT_ON_START` | No | `true` runs one alert check when the server starts. |

If the Gmail API variables are set they are used; otherwise `EMAIL_PASS` (SMTP) is used.

### Frontend (`Frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes in production | Backend URL **including `/api`**, e.g. `https://bend-1.onrender.com/api`. Read at build time. |

### Email setup

**Option A: Gmail API (for Render)**

1. In [Google Cloud Console](https://console.cloud.google.com), create a project and enable the **Gmail API**.
2. Configure the OAuth consent screen (External), add your Gmail address as a test user, add the scope `https://www.googleapis.com/auth/gmail.send`, then **publish the app** ("In production"). If it stays in "Testing", the refresh token expires after 7 days and emails stop. The server logs `invalid_grant` when that happens.
3. Under Credentials, create an **OAuth client ID** of type *Web application* with `https://developers.google.com/oauthplayground` as an authorised redirect URI.
4. In the [OAuth Playground](https://developers.google.com/oauthplayground), tick **Use your own OAuth credentials**, authorise the `gmail.send` scope with your Gmail account, and exchange the code for tokens.
5. Put the client ID, secret and **refresh token** into the environment.

**Option B: SMTP app password (local development)**

Turn on 2-Step Verification for the Gmail account, create an app password at <https://myaccount.google.com/apppasswords>, and set it as `EMAIL_PASS`.

---

## Checking That Email Works

1. Open `https://<your-api>/api/health`. It shows `"email": "gmail-api"` or `"smtp"`. `"none"` means the email variables are missing.
2. Check the server logs after a restart: `[email] ready (...)` means the credentials work; `[email] ... check FAILED: ...` shows the reason.
3. Log in with a real address, save preferences and press **Send me a test alert now**.

---

## API Documentation

**Base URL:** `https://bend-1.onrender.com/api` (locally `http://localhost:5000/api`)

Request and response bodies are JSON. Private routes need the header `Authorization: Bearer <token>`.

Errors always look like:

```json
{ "success": false, "message": "Email must be a valid email address", "errors": { "email": "Email must be a valid email address" } }
```

| Status | Meaning |
|---|---|
| 400 | Invalid input (see `errors` for each field) |
| 401 | Missing, invalid or expired token |
| 403 | Logged in but not allowed (e.g. not an admin) |
| 404 | Route or record not found |
| 409 | Duplicate (e.g. email already registered) |
| 429 | Too many requests |
| 502 / 503 | Email or news provider failed / not configured |

Categories: `business`, `entertainment`, `general`, `health`, `science`, `sports`, `technology`. Frequency: `immediate`, `hourly`, `daily`.

### Authentication

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/auth/register` | - | `name` (3-50), `email`, `password` | `201 { token, user }` |
| POST | `/auth/login` | - | `email`, `password` | `{ token, user }` |
| GET | `/auth/me` | Bearer | - | `{ user }` (includes `preferences`) |
| POST | `/auth/logout` | Bearer | optional `allDevices: true` | `{ message }` |
| POST | `/auth/change-password` | Bearer | `currentPassword`, `password` | `{ token, user }` (other devices signed out) |
| POST | `/auth/forgot-password` | - | `email` | `{ message }` (same for unknown emails) |
| POST | `/auth/reset-password` | - | `email`, `token`, `password` | `{ token, user }` |

### Preferences (logged-in user)

| Method | Endpoint | Body | Description |
|---|---|---|---|
| GET | `/preferences` | - | `{ preferences: { categories, frequency, channels: { email, browser }, subscribed, lastSentAt } }` |
| PUT | `/preferences` | `categories` (at least one), `frequency`, optional `channels` | Saves and turns alerts on. Returns the stored preferences. |
| POST | `/preferences/unsubscribe` | - | Turns alerts off, keeps topics. |

### Notifications (logged-in user)

| Method | Endpoint | Query / Body | Description |
|---|---|---|---|
| GET | `/notifications` | `category` (comma-separated), `sort` (`newest`/`oldest`), `from`, `to`, `since` (ISO dates), `page` (default 1), `limit` (default 20, max 100) | Paginated history: `{ notifications, pagination }` |
| GET | `/notifications/summary` | - | Total, last alert time, counts per category |
| DELETE | `/notifications` | - | Clears the user's history |
| POST | `/notifications/test` | - | Delivers an alert now, ignoring the schedule |

### News (public)

| Method | Endpoint | Query | Description |
|---|---|---|---|
| GET | `/news` | `category` (one or comma-separated), `limit` (max 50) | Merged articles, newest first: `{ articles, stale, updatedAt }` |
| GET | `/news/headlines` | - | Six general headlines for the landing page |

### Categories and health

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/categories` | - | Allowed categories |
| POST | `/categories` | Bearer, **admin** | Create a category (`name`, `description`) |
| GET | `/health` | - | `{ status, database, email, newsApi }` |

---

## Deployment

| Part | Platform | Link |
|---|---|---|
| Frontend | Vercel | [https://client-z1m9.vercel.app/](https://client-z1m9.vercel.app/) |
| Backend API | Render | [https://bend-1.onrender.com/](https://bend-1.onrender.com/) |
| Source code Backend | GitHub | [https://github.com/Sabarishga/BEnd](https://github.com/Sabarishga/BEnd) |
| Source code Frontend | GitHub | [https://github.com/Sabarishga/client](https://github.com/Sabarishga/client) |

### Backend on Render

1. Create a **Web Service** from the backend repository. Build command `npm install`, start command `npm start`.
2. In **Environment**, add every required variable from the table above, including **`JWT_SECRET`**, `NODE_ENV=production`, the **Gmail API** variables, and `CLIENT_URL=https://client-z1m9.vercel.app` (no trailing slash).
3. In MongoDB Atlas, allow Render to connect (Network Access).
4. Deploy and check the logs for `MongoDB connected`, `[newsJob] scheduled` and `[email] ready (gmail-api, ...)`, then open `/api/health`.

> Render's free plan puts services to sleep after inactivity, and the alert job only runs while the service is awake. The first request after a sleep can take about 50 seconds. Use a paid instance, or an uptime monitor that pings `/api/health` every few minutes, if alerts must be on time.

### Frontend on Vercel

1. Import the frontend repository. Framework preset: Vite. Build command `npm run build`, output directory `dist`.
2. Add `VITE_API_URL=https://bend-1.onrender.com/api`, then redeploy (Vite reads it at build time).
3. `vercel.json` already sends every path to `index.html`, so refreshing on `/feed` or `/dashboard` works.

### Upgrading from the previous version

- Existing accounts and passwords keep working. Users log in once more to get a token.
- Users whose `subscribed` flag was already `true` now receive alerts even when logged out, which is how a subscription is expected to work.
- The old email-based routes (`/api/subscribe`, `/api/preferences/:email`, `/api/notifications/:email`, `/api/dashboard/*`, `/api/news/featured`) were removed because they exposed other users' data.

---

## Known Limitations

- **News freshness depends on NewsAPI.** The free Developer plan delays articles by about 24 hours (so few stories qualify as "Breaking"), allows 100 requests per day and is meant for development only. With many categories in use, raise `NEWS_CACHE_MINUTES` to stay under the daily limit, or use a paid plan.
- **Browser notifications need an open tab.** They are shown by the web app while it is open. Notifications with the site closed would need a service worker and the Web Push protocol.
- **Tokens are stored in `localStorage`.** This is simple and works across the separate Vercel and Render domains, but a successful XSS attack could read the token. React escapes rendered content, and tokens expire after 30 days and are revoked on password change. HttpOnly cookies on a shared domain would be the next step.
- **Gmail sending limits apply** to the sending account (about 500 emails per day for a normal Gmail account).

### Possible improvements

- Web Push (service worker) so browser alerts also arrive when the site is closed.
- Email verification on sign-up.
- Automated tests with `mongodb-memory-server` in CI.
- Multiple news sources and a source filter.

---

## Author

**Sabarish Ganesh P**

- GitHub: [@Sabarishga](https://github.com/Sabarishga)
- Email: [gsabarish22@gmail.com](mailto:gsabarish22@gmail.com)
