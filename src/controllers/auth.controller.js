import bcrypt from "bcrypt";
import crypto from "crypto";
import { db } from "../db.js";
import { Errors } from "../errors/app-error.js";
import { signAccessToken, verifyRefreshToken } from "../auth/tokens.js";
import { hashToken, issueRefreshToken } from "../auth/refresh-store.js";
import { BCRYPT_COST, requireValidEmail, requireSignupPassword, requireLoginPassword, cleanName } from "../validators/auth.validator.js";

// Dummy hash so login timing is identical whether email exists or not.
const DUMMY_HASH = "$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function toSafeUser(user) {
  const { password_hash: _ph, ...safe } = user;
  return safe;
}

// No try/catch here — asyncHandler + error.middleware.js handle it.
export async function signup(req, res) {
  const { email, password, name } = req.body ?? {};

  const clean = requireValidEmail(email);
  requireSignupPassword(password);

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  const result = await db.query(
    `INSERT INTO users (email, password_hash, name)
     VALUES ($1, $2, $3)
     RETURNING id, email, name, role, created_at`,
    [clean, passwordHash, cleanName(name)]
  );

  const user = result.rows[0];
  const accessToken = signAccessToken(user);
  const { token: refreshToken } = await issueRefreshToken(user.id, req);

  res.status(201).json({ user, accessToken, refreshToken });
}

export async function login(req, res) {
  const { email, password } = req.body ?? {};

  const clean = requireValidEmail(email);
  requireLoginPassword(password);

  const result = await db.query(
    `SELECT id, email, password_hash, name, role, created_at
     FROM users WHERE email = $1`,
    [clean]
  );

  const user = result.rows[0];
  // Always run bcrypt.compare to avoid timing leak revealing if email exists.
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) throw Errors.invalidCredentials();

  const accessToken = signAccessToken(toSafeUser(user));
  const { token: refreshToken } = await issueRefreshToken(user.id, req);

  res.json({ user: toSafeUser(user), accessToken, refreshToken });
}

// POST /auth/refresh { refreshToken } → new accessToken + rotated refreshToken
export async function refresh(req, res) {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken !== "string" || refreshToken === "") throw Errors.invalidToken();

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw Errors.invalidToken();
  }

  // Token must exist, be unexpired and unrevoked in DB.
  const found = await db.query(
    `SELECT id, user_id, revoked_at, expires_at FROM refresh_tokens WHERE token_hash = $1`,
    [hashToken(refreshToken)]
  );
  const row = found.rows[0];
  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) throw Errors.invalidToken();

  // Rotation: revoke old row, issue new row (limits reuse window if token stolen).
  await db.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [row.id]);

  const userRes = await db.query(
    `SELECT id, email, name, role, created_at FROM users WHERE id = $1`,
    [payload.sub]
  );
  if (!userRes.rows[0]) throw Errors.invalidToken();

  const user = userRes.rows[0];
  const accessToken = signAccessToken(user);
  const { token: newRefreshToken } = await issueRefreshToken(user.id, req);

  res.json({ user, accessToken, refreshToken: newRefreshToken });
}

// POST /auth/logout { refreshToken } → revoke that device session
export async function logout(req, res) {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken === "string" && refreshToken !== "") {
    await db.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`, [
      hashToken(refreshToken),
    ]);
  }
  res.json({ ok: true });
}

// GET /auth/sessions — requires auth middleware, lists logged-in devices
export async function listSessions(req, res) {
  const { rows } = await db.query(
    `SELECT id, user_agent, ip, created_at, expires_at, revoked_at
     FROM refresh_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [req.user.sub]
  );
  res.json({ sessions: rows });
}
