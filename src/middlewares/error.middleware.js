import { AppError } from "../errors/app-error.js";

// Maps Postgres unique-violation on users.email → 409 EMAIL_TAKEN.
// Everything else: AppError → its own status, unknown Error → 500.
export function mapDbError(err) {
  if (err?.code === "23505" && err?.constraint === "users_email_key") {
    return { code: "EMAIL_TAKEN", message: "An account with this email already exists.", status: 409 };
  }
  return null;
}

// Must have 4 args (err, req, res, next) or Express ignores it.
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json(err.toJSON());
  }

  const dbError = mapDbError(err);
  if (dbError) {
    return res.status(dbError.status).json({ error: { code: dbError.code, message: dbError.message } });
  }

  console.error(`${req.method} ${req.path} failed:`, err.message);
  res.status(500).json({
    error: { code: "SERVER_ERROR", message: "Something went wrong on our side. Please try again." },
  });
}
