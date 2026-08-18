import { google } from "googleapis";
import { getGoogleAuth } from "./googleAuth.js";

let analyticsClientPromise = null;

// Mesma service account/escopo ja usados para Sheets (getGoogleAuth ja solicita
// analytics.readonly) -- so precisa ser adicionada como Viewer na propriedade GA4
// de cada campanha (Property ID cadastrado em campanhas.ga4_property_id).
export function getAnalyticsDataClient() {
  if (!analyticsClientPromise) {
    analyticsClientPromise = google.analyticsdata({ version: "v1beta", auth: getGoogleAuth() });
  }
  return analyticsClientPromise;
}
