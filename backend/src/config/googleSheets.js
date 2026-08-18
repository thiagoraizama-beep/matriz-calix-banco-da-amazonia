import { google } from "googleapis";
import { getGoogleAuth } from "./googleAuth.js";

let sheetsClientPromise = null;

export function getSheetsClient() {
  if (!sheetsClientPromise) {
    sheetsClientPromise = google.sheets({ version: "v4", auth: getGoogleAuth() });
  }
  return sheetsClientPromise;
}
