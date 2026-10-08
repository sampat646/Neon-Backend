import jwt from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL = process.env.JWT_ACCESS_TTL ?? "15m";
const REFRESH_TTL = process.env.JWT_REFRESH_TTL ?? "30d";

if (!ACCESS_SECRET || !REFRESH_SECRET) {
  throw new Error("Missing JWT_ACCESS_SECRET / JWT_REFRESH_SECRET in .env");
}

// Short-lived proof of login. Payload: { sub: userId, role }. Sent as Bearer header.
export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

// Long-lived token to get new access tokens. Payload: { sub: userId, jti: tokenId }.
export function signRefreshToken(userId, jti) {
  return jwt.sign({ sub: userId, jti }, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

// Device info from request: user-agent + IP. Store with refresh token for "logged-in devices" view.
export function getDeviceInfo(req) {
  const userAgent = req.get("user-agent")?.slice(0, 500) ?? null;
  const ip = (req.ip ?? req.socket?.remoteAddress ?? null)?.slice(0, 100) ?? null;
  return { userAgent, ip };
}
