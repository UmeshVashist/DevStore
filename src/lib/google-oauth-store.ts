import fs from "fs";
import path from "path";

const TOKEN_FILE = path.join(process.cwd(), ".google-oauth.json");

export interface GoogleOAuthStore {
  refresh_token: string;
  email?: string;
  connected_at: string;
  name?: string;
}

export interface GoogleOAuthStoreMulti {
  accounts: GoogleOAuthStore[];
}

export function getOAuthRedirectUri(origin?: string): string {
  const base = origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

export function getStoredAccounts(): GoogleOAuthStore[] {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const content = fs.readFileSync(TOKEN_FILE, "utf-8").trim();
      if (!content) return [];
      const parsed = JSON.parse(content);
      
      // Support old single-account format
      if (parsed.refresh_token) {
        return [{
          refresh_token: parsed.refresh_token,
          email: parsed.email,
          name: parsed.name,
          connected_at: parsed.connected_at || new Date().toISOString()
        }];
      }
      
      // Support array directly
      if (Array.isArray(parsed)) {
        return parsed;
      }
      
      // Support new format: { accounts: [...] }
      if (parsed && Array.isArray(parsed.accounts)) {
        return parsed.accounts;
      }
    }
  } catch (err) {
    console.error("Error reading stored accounts:", err);
  }
  return [];
}

export function getStoredRefreshToken(email?: string): string | undefined {
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN && !email) {
    return process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  }

  const accounts = getStoredAccounts();
  if (accounts.length === 0) return undefined;

  if (email && email !== "all") {
    const acc = accounts.find(
      (a) => a.email?.toLowerCase() === email.toLowerCase()
    );
    return acc?.refresh_token;
  }

  return accounts[0]?.refresh_token;
}

export function getStoredOAuthInfo(email?: string): GoogleOAuthStore | null {
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN && !email) {
    return {
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      connected_at: "env",
    };
  }

  const accounts = getStoredAccounts();
  if (accounts.length === 0) return null;

  if (email && email !== "all") {
    const acc = accounts.find(
      (a) => a.email?.toLowerCase() === email.toLowerCase()
    );
    return acc || null;
  }

  return accounts[0] || null;
}

export function saveRefreshToken(refreshToken: string, email?: string): void {
  const accounts = getStoredAccounts();
  const existingIndex = accounts.findIndex(
    (acc) =>
      email &&
      acc.email &&
      acc.email.toLowerCase() === email.toLowerCase()
  );

  const existingAccount = existingIndex >= 0 ? accounts[existingIndex] : null;

  const newAccount: GoogleOAuthStore = {
    refresh_token: refreshToken,
    email,
    name: existingAccount?.name || undefined,
    connected_at: existingAccount?.connected_at || new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    accounts[existingIndex] = newAccount;
  } else {
    accounts.push(newAccount);
  }

  const data: GoogleOAuthStoreMulti = { accounts };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function updateStoredAccountName(email: string, name: string): boolean {
  const accounts = getStoredAccounts();
  const existing = accounts.find(
    (acc) =>
      email &&
      acc.email &&
      acc.email.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    existing.name = name;
    const data: GoogleOAuthStoreMulti = { accounts };
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), "utf-8");
    return true;
  }
  return false;
}

export function deleteStoredAccount(email: string): boolean {
  const accounts = getStoredAccounts();
  const initialLength = accounts.length;
  const filtered = accounts.filter(
    (acc) => !acc.email || acc.email.toLowerCase() !== email.toLowerCase()
  );

  if (filtered.length === initialLength) {
    return false;
  }

  const data: GoogleOAuthStoreMulti = { accounts: filtered };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), "utf-8");
  return true;
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
