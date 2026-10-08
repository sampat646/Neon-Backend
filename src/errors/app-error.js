// Central error class: every expected failure (400/401/404/409) is an AppError.
// Unexpected bugs fall through to the 500 handler in error.middleware.js.

export class AppError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}

// Factory helpers — one per error code used in auth.controller.js
export const Errors = {
  emailRequired: () => new AppError("EMAIL_REQUIRED", "Please enter your email.", 400),
  emailInvalid: () => new AppError("EMAIL_INVALID", "Please enter a valid email like name@example.com.", 400),
  passwordRequired: () => new AppError("PASSWORD_REQUIRED", "Please enter a password.", 400),
  passwordTooShort: () => new AppError("PASSWORD_TOO_SHORT", "Password must be at least 8 characters.", 400),
  passwordTooLong: () => new AppError("PASSWORD_TOO_LONG", "Password must be 72 characters or fewer.", 400),
  emailTaken: () => new AppError("EMAIL_TAKEN", "An account with this email already exists.", 409),
  invalidCredentials: () => new AppError("INVALID_CREDENTIALS", "Invalid email or password.", 401),
  invalidToken: () => new AppError("INVALID_TOKEN", "Session expired. Please log in again.", 401),
  forbidden: () => new AppError("FORBIDDEN", "You do not have permission to do this.", 403),
  userNotFound: () => new AppError("USER_NOT_FOUND", "User not found.", 404),
  invalidRole: () => new AppError("INVALID_ROLE", "Role must be 'user' or 'admin'.", 400),
  serverError: () => new AppError("SERVER_ERROR", "Something went wrong on our side. Please try again.", 500),
};
