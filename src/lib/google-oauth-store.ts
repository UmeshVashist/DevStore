import fs from "fs";
import path from "path";

const TOKEN_FILE = path.join(process.cwd(), ".google-oauth.json");

export interface GoogleOAuthStore {
  refresh_token: string;
  email?: string;
  connected_at: string;
}

export function getOAuthRedirectUri(origin?: string): string {
  const base = origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

export function getStoredRefreshToken(): string | undefined {
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    return process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  }

  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8")) as GoogleOAuthStore;
      return data.refresh_token;
    }
  } catch {
    // ignore read errors
  }

  return undefined;
}

export function getStoredOAuthInfo(): GoogleOAuthStore | null {
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    return {
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      connected_at: "env",
    };
  }

  try {
    if (fs.existsSync(TOKEN_FILE)) {
      return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8")) as GoogleOAuthStore;
    }
  } catch {
    return null;
  }

  return null;
}

export function saveRefreshToken(refreshToken: string, email?: string): void {
  const data: GoogleOAuthStore = {
    refresh_token: refreshToken,
    email,
    connected_at: new Date().toISOString(),
  };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function isOAuthConfigured(): boolean {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = getStoredRefreshToken();
  return Boolean(clientId && clientSecret && refreshToken);
}

export function hasOAuthClientCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
}

export const OAUTH_REDIRECT_COOKIE = "devdata_oauth_redirect";
