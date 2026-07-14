import fs from "fs";
import path from "path";
import { Auth, google, drive_v3 } from "googleapis";
import {
  getOAuthRedirectUri,
  getStoredRefreshToken,
  hasOAuthClientCredentials,
  isOAuthConfigured,
} from "./google-oauth-store";

export type DriveAuthMode = "oauth" | "service_account";

const CREDENTIALS_FILE = path.join(process.cwd(), "credentials.json");
const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

function readServiceAccountFromFile(): ServiceAccountCredentials | null {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE)) return null;

    const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8")) as {
      type?: string;
      client_email?: string;
      private_key?: string;
    };

    if (data.type !== "service_account" || !data.client_email || !data.private_key) {
      return null;
    }

    return {
      client_email: data.client_email,
      private_key: data.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

function readServiceAccountFromEnv(): ServiceAccountCredentials | null {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) return null;

  return { client_email: clientEmail, private_key: privateKey };
}

export function getServiceAccountEmail(): string | undefined {
  return (
    readServiceAccountFromEnv()?.client_email ||
    readServiceAccountFromFile()?.client_email
  );
}

export function hasServiceAccountCredentials(): boolean {
  return Boolean(readServiceAccountFromEnv() || readServiceAccountFromFile());
}

export function isDriveConfigured(userId?: string): boolean {
  return isOAuthConfigured(userId) || hasServiceAccountCredentials();
}

function getServiceAccountAuth() {
  const creds = readServiceAccountFromEnv() || readServiceAccountFromFile();

  if (!creds) {
    throw new Error(
      "Service account credentials missing. Add credentials.json or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY in .env.local"
    );
  }

  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: DRIVE_SCOPES,
  });
}

export function getDriveAuthMode(userId?: string): DriveAuthMode {
  if (isOAuthConfigured(userId)) return "oauth";
  if (hasServiceAccountCredentials()) return "service_account";
  return "oauth";
}

const cachedAuths = new Map<string, Auth.OAuth2Client | Auth.JWT>();
const cachedDrives = new Map<string, drive_v3.Drive>();

export function clearGoogleAuthCache(): void {
  cachedAuths.clear();
  cachedDrives.clear();
}

export function getGoogleAuth(driveEmail?: string, userId?: string): Auth.OAuth2Client | Auth.JWT {
  const cacheKey = `${driveEmail || "default"}-${userId || "default"}`;
  if (cachedAuths.has(cacheKey)) {
    return cachedAuths.get(cacheKey)!;
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = getStoredRefreshToken(driveEmail, userId);

  if (clientId && clientSecret && refreshToken) {
    const oauth2 = new google.auth.OAuth2(
      clientId,
      clientSecret,
      getOAuthRedirectUri()
    );
    oauth2.setCredentials({ refresh_token: refreshToken });
    cachedAuths.set(cacheKey, oauth2);
    return oauth2;
  }

  if (hasServiceAccountCredentials()) {
    const auth = getServiceAccountAuth();
    cachedAuths.set(cacheKey, auth);
    return auth;
  }

  if (hasOAuthClientCredentials()) {
    throw new Error(
      "Personal Gmail par upload ke liye ek baar /setup/drive se apna Gmail connect karein."
    );
  }

  throw new Error(
    "Google Drive not configured. Add OAuth credentials or service account in .env.local"
  );
}

export const DRIVE_OPTS = {
  supportsAllDrives: true,
};

export const DRIVE_LIST_OPTS = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
};

export function getDriveClient(driveEmail?: string, userId?: string): drive_v3.Drive {
  const cacheKey = `${driveEmail || "default"}-${userId || "default"}`;
  if (cachedDrives.has(cacheKey)) {
    return cachedDrives.get(cacheKey)!;
  }
  const drive = google.drive({ version: "v3", auth: getGoogleAuth(driveEmail, userId) });
  cachedDrives.set(cacheKey, drive);
  return drive;
}

export function formatDriveError(error: unknown): string {
  const err = error as {
    message?: string;
    code?: number;
    errors?: Array<{ message?: string; reason?: string }>;
  };

  const message = err?.message || "Unknown Google Drive error";
  const reason = err?.errors?.[0]?.reason || "";

  if (
    message.includes("storage quota") ||
    reason === "storageQuotaExceeded" ||
    message.includes("Service Accounts do not have storage quota")
  ) {
    return (
      "Personal Gmail (@gmail.com) par service account se file upload nahi hoti. " +
      "Ek baar /setup/drive par jaa kar apna Gmail connect karein — uske baad auto chalega."
    );
  }

  if (err.code === 404 || reason === "notFound") {
    return "Google Drive folder not found. Check GOOGLE_DRIVE_FOLDER_ID in .env.local.";
  }

  if (err.code === 403 || reason === "insufficientPermissions") {
    return "Google Drive permission denied. Share the root folder with the service account email.";
  }

  return message;
}

export { isOAuthConfigured, hasOAuthClientCredentials, getStoredRefreshToken };
