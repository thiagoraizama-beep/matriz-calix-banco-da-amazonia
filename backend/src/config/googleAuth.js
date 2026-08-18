import { google } from "googleapis";

let authClient = null;

export function getGoogleAuth() {
  if (authClient) return authClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL ou GOOGLE_PRIVATE_KEY ausentes. Configure o .env ou use DATA_SOURCE=mock."
    );
  }

  authClient = new google.auth.JWT(email, null, key, [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
  ]);
  return authClient;
}
