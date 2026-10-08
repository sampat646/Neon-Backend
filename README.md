# user-admin-backend

Learning project: Express + PostgreSQL (Neon) user auth backend with JWT + RBAC.

## Folder structure

```
server.js                  # entry point: creates app, listens on PORT
src/
  app.js                   # builds Express app, mounts routers + errorHandler last
  db.js                    # pg.Pool singleton (DATABASE_URL)
  db/
    001_create_users.sql   # users table (email UNIQUE, role user|admin)
    002_create_refresh_tokens.sql  # refresh_tokens per-device sessions
  auth/
    tokens.js              # sign/verify access+refresh JWT, getDeviceInfo
    refresh-store.js       # hashToken (SHA-256), issueRefreshToken + device row
  routes/
    auth.routes.js         # POST /auth/*, GET /auth/sessions
    admin.routes.js        # GET/PATCH /admin/* (requireAuth+requireAdmin)
    system.routes.js       # GET /health, GET /debug/count
  controllers/
    auth.controller.js     # signup, login, refresh (rotation), logout, listSessions
    admin.controller.js    # listUsers, setUserRole (self-demote guard)
  validators/
    auth.validator.js      # requireValidEmail, requireSignup/LoginPassword, cleanName
  errors/
    app-error.js           # AppError + Errors.* factories
  middlewares/
    async-handler.js       # wraps async controllers → next(err)
    error.middleware.js    # AppError → status, 23505 → 409, else 500
    auth.middleware.js     # requireAuth (Bearer), requireAdmin (role check → 403)
postman_collection.json    # importable Postman collection for all endpoints
test-db.js                 # standalone Neon connection smoke test
.env                       # DATABASE_URL, JWT_ACCESS/REFRESH_SECRET, TTLs — never commit
```

## Flow

1. `server.js` → `createApp()` from `src/app.js`
2. `app.js` mounts `systemRouter /`, `authRouter /auth`, `adminRouter /admin`, then `errorHandler`
3. Route → `requireAuth?` → `requireAdmin?` → controller → validator (throws AppError) + `db.query()` → JSON
4. Auth: signup/login return `{user, accessToken (15m), refreshToken (30d)}`. Refresh rotates (old revoked). Logout revokes. Sessions list shows device user-agent + IP.

## Endpoints

| Method | Path | Auth | Body | Success | Errors |
| ------ | ---- | ---- | ---- | ------- | ------ |
| GET | `/health` | no | — | `200 {ok:true, database:"connected"}` | `503` DB down |
| GET | `/debug/count` | no | — | `200 {total}` TEMP, delete before deploy | `500` |
| POST | `/auth/signup` | no | `{email,password,name?}` | `201 {user, accessToken, refreshToken}` | `400 EMAIL_REQUIRED/EMAIL_INVALID/PASSWORD_*`, `409 EMAIL_TAKEN` |
| POST | `/auth/login` | no | `{email,password}` | `200 {user, accessToken, refreshToken}` | `400`, `401 INVALID_CREDENTIALS` (same msg for no-user/wrong-pw + dummy bcrypt timing) |
| POST | `/auth/refresh` | no (refresh JWT in body) | `{refreshToken}` | `200 {user, accessToken, refreshToken}` rotated | `401 INVALID_TOKEN` (bad/expired/revoked/reused) |
| POST | `/auth/logout` | no | `{refreshToken}` | `200 {ok:true}` revokes that device row | always 200 (idempotent) |
| GET | `/auth/sessions` | Bearer access | — | `200 {sessions:[{id,user_agent,ip,created_at,expires_at,revoked_at}]}` | `401 INVALID_TOKEN` |
| GET | `/admin/users` | Bearer admin | — | `200 {users:[{id,email,name,role,created_at}]}` | `401` no/bad token, `403 FORBIDDEN` non-admin |
| PATCH | `/admin/users/:id/role` | Bearer admin | `{role:"admin"\|"user"}` | `200 {user}` promoted/demoted | `400 INVALID_ROLE`, `403` self-demote or non-admin, `404 USER_NOT_FOUND` |

Error shape always: `{ error: { code, message } }`.

Sample bodies:

```jsonc
// signup
{ "email": "test@example.com", "password": "password123", "name": "Test User" }
// login
{ "email": "test@example.com", "password": "password123" }
// refresh / logout
{ "refreshToken": "<from login>" }
// promote
{ "role": "admin" }
```

## How to handle in frontend

Rules: access token in memory only (never localStorage), refresh token in httpOnly cookie (or secure storage on mobile). Silent refresh on 401.

```js
const API = "http://localhost:3000";
let accessToken = null; // memory only

// 1. Login / signup → store both (demo uses memory; production: refresh in httpOnly cookie)
async function login(email, password) {
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error.message); // show data.error.code for i18n
  accessToken = data.accessToken;
  localStorage.setItem("refreshToken", data.refreshToken); // demo only
  localStorage.setItem("user", JSON.stringify(data.user)); // {role} → gate admin UI
  return data.user;
}

// 2. Authenticated call helper with one silent retry via refresh
async function api(path, options = {}) {
  let r = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
  });
  if (r.status === 401 && localStorage.getItem("refreshToken")) {
    const ok = await tryRefresh();
    if (ok) {
      r = await fetch(`${API}${path}`, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${accessToken}` },
      });
    }
  }
  return r;
}

async function tryRefresh() {
  const r = await fetch(`${API}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: localStorage.getItem("refreshToken") }),
  });
  if (!r.ok) { logoutLocal(); return false; } // refresh stolen/expired → force login
  const data = await r.json();
  accessToken = data.accessToken;
  localStorage.setItem("refreshToken", data.refreshToken); // rotation: replace old
  return true;
}

function logoutLocal() {
  accessToken = null;
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  location.href = "/login";
}

async function logout() {
  await fetch(`${API}/auth/logout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: localStorage.getItem("refreshToken") }),
  }).catch(() => {});
  logoutLocal();
}

// 3. Gate admin UI by role from login response (backend still enforces!)
const me = JSON.parse(localStorage.getItem("user") || "null");
if (me?.role === "admin") showAdminPanel(); // calls GET /admin/users, PATCH /admin/users/:id/role

// 4. Show field errors from codes, not just message:
// EMAIL_TAKEN → highlight email, INVALID_CREDENTIALS → generic banner (don't say which field),
// FORBIDDEN → "no permission", INVALID_TOKEN → redirect login.
```

Notes: access token lives ~15m, so refresh happens silently. After admin promotes a user, that user's old access token keeps old role until refresh/re-login — re-fetch or force refresh after role change.

## Setup

```powershell
npm install
# .env: DATABASE_URL=postgresql://... JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... JWT_ACCESS_TTL=15m JWT_REFRESH_TTL=30d
# generate secrets: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" (twice)
psql $env:DATABASE_URL -f src/db/001_create_users.sql
psql $env:DATABASE_URL -f src/db/002_create_refresh_tokens.sql
npm run dev
```

## Test

```powershell
node test-db.js
Invoke-RestMethod http://localhost:3000/health
# or import postman_collection.json into Postman; order: health → signup → login → sessions → refresh → logout → admin/*
```
