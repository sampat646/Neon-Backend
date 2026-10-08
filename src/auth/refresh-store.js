import crypto from "crypto";
import { db } from "../db.js";
import { signRefreshToken, getDeviceInfo } from "../auth/tokens.js";

// Store SHA-256 of JWT so DB never holds a usable token.
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Creates refresh JWT + DB row with device info. Returns { token, row }.
export async function issueRefreshToken(userId, req) {
  const jti = crypto.randomUUID();
  const token = signRefreshToken(userId, jti);
  const { userAgent, ip } = getDeviceInfo(req);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30d, matches JWT_REFRESH_TTL

  const { rows } = await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
    [userId, hashToken(token), userAgent, ip, expiresAt.toISOString()]
  );
  return { token, row: rows[0] };
}
