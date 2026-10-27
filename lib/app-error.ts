export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message)
    this.name = "AppError"
  }
}

export function getErrorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message
  if (err instanceof Error) {
    const msg = err.message

    // Gmail/IMAP/SMTP auth failures
    if (msg.includes("Username and Password not accepted") || msg.includes("BadCredentials")) {
      return "Email or app password is incorrect. For Gmail, use an App Password (not your regular password)."
    }
    if (msg.includes("Invalid login") || msg.includes("Authentication failed")) {
      return "Server rejected the login credentials. Check your username and password."
    }
    if (msg.includes("connect ECONNREFUSED") || msg.includes("connect ETIMEDOUT")) {
      return "Could not connect to the mail server. Check the host and port."
    }
    if (msg.includes("self-signed certificate") || msg.includes("CERT_UNTRUSTED")) {
      return "SSL certificate issue. Try disabling SSL/TLS or using a different port."
    }
    if (msg.includes("suspended")) {
      return msg // Already user-friendly from team.ts
    }
    if (msg.includes("Unauthorized")) {
      return "Session expired. Please sign in again."
    }

    // Fallback: truncate technical details
    const lines = msg.split("\n").filter((l) => l.trim())
    return lines[0] || "An unexpected error occurred."
  }
  return "An unexpected error occurred."
}
