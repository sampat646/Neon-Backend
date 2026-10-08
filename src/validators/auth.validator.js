import { Errors } from "../errors/app-error.js";

export const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const BCRYPT_COST = 12;

export function cleanEmail(email) {
  return email.trim().toLowerCase();
}

// Throws AppError on failure, returns cleaned email on success.
export function requireValidEmail(email) {
  if (typeof email !== "string" || email.trim() === "") throw Errors.emailRequired();
  const clean = cleanEmail(email);
  if (clean.length > 254 || !EMAIL_SHAPE.test(clean)) throw Errors.emailInvalid();
  return clean;
}

export function requireSignupPassword(password) {
  if (typeof password !== "string" || password === "") throw Errors.passwordRequired();
  if (password.length < 8) throw Errors.passwordTooShort();
  if (Buffer.byteLength(password, "utf8") > 72) throw Errors.passwordTooLong();
}

export function requireLoginPassword(password) {
  if (typeof password !== "string" || password === "") throw Errors.passwordRequired();
}

export function cleanName(name) {
  return typeof name === "string" && name.trim() !== "" ? name.trim().slice(0, 100) : null;
}
