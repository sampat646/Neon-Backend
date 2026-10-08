import { db } from "../db.js";
import { Errors } from "../errors/app-error.js";

// GET /admin/users — list users, newest first
export async function listUsers(req, res) {
  const { rows } = await db.query(
    `SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC LIMIT 100`
  );
  res.json({ users: rows });
}

// PATCH /admin/users/:id/role { role: "admin" | "user" }
export async function setUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body ?? {};

  // 1. Validate role value (DB CHECK would reject anyway, but give clean 400)
  if (role !== "user" && role !== "admin") throw Errors.invalidRole();

  // 2. Prevent lockout: admin cannot demote/remove themselves
  if (id === req.user.sub && role !== "admin") {
    throw Errors.forbidden();
  }

  // 3. Parameterized UPDATE — no SQL injection; RETURNING never exposes password_hash
  const { rows } = await db.query(
    `UPDATE users SET role = $2 WHERE id = $1
     RETURNING id, email, name, role, created_at`,
    [id, role]
  );

  if (!rows[0]) throw Errors.userNotFound();
  res.json({ user: rows[0] });
}
