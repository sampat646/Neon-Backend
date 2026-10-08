import { Errors } from "../errors/app-error.js";
import { verifyAccessToken } from "../auth/tokens.js";

// Usage: app.get("/admin/...", requireAuth, ...)
export function requireAuth(req, res, next) {
  const header = req.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) throw Errors.invalidToken();
  try {
    req.user = verifyAccessToken(token); // { sub, role, iat, exp }
    next();
  } catch {
    throw Errors.invalidToken();
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") throw Errors.forbidden();
  next();
}
