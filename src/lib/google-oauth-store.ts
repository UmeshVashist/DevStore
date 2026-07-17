import fs from "fs";
import path from "path";
import { auth, clerkClient } from "@clerk/nextjs/server";

const TOKEN_FILE = path.join(process.cwd(), ".google-oauth.json");

export interface GoogleOAuthStore {
  refresh_token: string;
  email?: string;
  connected_at: string;
  name?: string;
  expired?: boolean;
}

export interface GoogleOAuthStoreMulti {
  accounts: GoogleOAuthStore[];
}

export function getOAuthRedirectUri(origin?: string): string {
  const base = origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/auth/google/callback`;
}

// In-memory request cache to keep accounts synchronized synchronously
export const accountsCache = new Map<string, GoogleOAuthStore[]>();

export async function fetchAndCacheAccounts(userId: string): Promise<GoogleOAuthStore[]> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const accounts = (user.privateMetadata?.googleAccounts as GoogleOAuthStore[]) || [];
    accountsCache.set(userId, accounts);
    return accounts;
  } catch (err) {
    console.error("Error fetching accounts from Clerk:", err);
    return accountsCache.get(userId) || [];
  }
}

function getLocalFileAccounts(): GoogleOAuthStore[] {
  if (process.env.NODE_ENV === "production") return [];
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const content = fs.readFileSync(TOKEN_FILE, "utf-8").trim();
      if (!content) return [];
      const parsed = JSON.parse(content);
      let fileAccounts: GoogleOAuthStore[] = [];
      
      // Support old single-account format
      if (parsed.refresh_token) {
        fileAccounts = [{
          refresh_token: parsed.refresh_token,
          email: parsed.email,
          name: parsed.name,
          connected_at: parsed.connected_at || new Date().toISOString(),
          expired: parsed.expired
        }];
      } else if (Array.isArray(parsed)) { // Support array directly
        fileAccounts = parsed;
      } else if (parsed && Array.isArray(parsed.accounts)) { // Support new format: { accounts: [...] }
        fileAccounts = parsed.accounts;
      }
      return fileAccounts;
    }
  } catch (err) {
    console.error("Error reading stored accounts file:", err);
  }
  return [];
}

export function getStoredAccounts(userId?: string): GoogleOAuthStore[] {
  let accounts: GoogleOAuthStore[] = [];

  // 1. Try to get from request-scoped in-memory cache
  const resolvedUserId = userId;
  if (resolvedUserId && accountsCache.has(resolvedUserId)) {
    accounts = [...accountsCache.get(resolvedUserId)!];
  }

  // 2. Fallback to local .google-oauth.json file (useful for scripts & local development)
  if (accounts.length === 0 && process.env.NODE_ENV !== "production") {
    accounts = getLocalFileAccounts();
    if (accounts.length > 0 && resolvedUserId) {
      accountsCache.set(resolvedUserId, accounts);
    }
  }

  // 3. Sync expired flag from local file to ensure Clerk rate limits don't mask expiration state locally
  if (process.env.NODE_ENV !== "production" && accounts.length > 0) {
    const localAccounts = getLocalFileAccounts();
    accounts = accounts.map(acc => {
      const localAcc = localAccounts.find(l => l.email?.toLowerCase() === acc.email?.toLowerCase());
      if (localAcc && localAcc.expired) {
        return { ...acc, expired: true };
      }
      return acc;
    });
  }

  return accounts;
}

export function getStoredRefreshToken(email?: string, userId?: string): string | undefined {
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN && !email) {
    return process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  }

  const accounts = getStoredAccounts(userId);
  if (accounts.length === 0) return undefined;

  if (email && email !== "all") {
    const acc = accounts.find(
      (a) => a.email?.toLowerCase() === email.toLowerCase()
    );
    return acc?.refresh_token;
  }

  return accounts[0]?.refresh_token;
}

export function getStoredOAuthInfo(email?: string, userId?: string): GoogleOAuthStore | null {
  if (process.env.GOOGLE_OAUTH_REFRESH_TOKEN && !email) {
    return {
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN,
      connected_at: "env",
    };
  }

  const accounts = getStoredAccounts(userId);
  if (accounts.length === 0) return null;

  if (email && email !== "all") {
    const acc = accounts.find(
      (a) => a.email?.toLowerCase() === email.toLowerCase()
    );
    return acc || null;
  }

  return accounts[0] || null;
}

export async function saveRefreshToken(refreshToken: string, email?: string, userId?: string): Promise<void> {
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    try {
      const authSession = await auth();
      resolvedUserId = authSession.userId || undefined;
    } catch {}
  }

  const accounts = getStoredAccounts(resolvedUserId);
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

  // Update memory cache
  if (resolvedUserId) {
    accountsCache.set(resolvedUserId, accounts);
    
    // Save to Clerk Private Metadata (for cloud/Vercel persistence)
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(resolvedUserId, {
        privateMetadata: {
          googleAccounts: accounts,
        },
      });
      console.log(`Saved token for ${email} to Clerk metadata.`);
    } catch (err) {
      console.error("Failed to save tokens to Clerk metadata:", err);
    }
  }

  // Fallback: Write local file (for local development fallback)
  try {
    const data: GoogleOAuthStoreMulti = { accounts };
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    console.warn("Local token file write skipped (normal on read-only environments like Vercel).");
  }
}

export async function updateStoredAccountName(email: string, name: string, userId?: string): Promise<boolean> {
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    try {
      const authSession = await auth();
      resolvedUserId = authSession.userId || undefined;
    } catch {}
  }

  const accounts = getStoredAccounts(resolvedUserId);
  const existing = accounts.find(
    (acc) =>
      email &&
      acc.email &&
      acc.email.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    existing.name = name;
    
    if (resolvedUserId) {
      accountsCache.set(resolvedUserId, accounts);
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(resolvedUserId, {
          privateMetadata: {
            googleAccounts: accounts,
          },
        });
      } catch (err) {
        console.error("Failed to rename account in Clerk metadata:", err);
      }
    }

    try {
      const data: GoogleOAuthStoreMulti = { accounts };
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch {}
    return true;
  }
  return false;
}

export async function deleteStoredAccount(email: string, userId?: string): Promise<boolean> {
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    try {
      const authSession = await auth();
      resolvedUserId = authSession.userId || undefined;
    } catch {}
  }

  const accounts = getStoredAccounts(resolvedUserId);
  const initialLength = accounts.length;
  const filtered = accounts.filter(
    (acc) => !acc.email || acc.email.toLowerCase() !== email.toLowerCase()
  );

  if (filtered.length === initialLength) {
    return false;
  }

  if (resolvedUserId) {
    accountsCache.set(resolvedUserId, filtered);
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(resolvedUserId, {
        privateMetadata: {
          googleAccounts: filtered,
        },
      });
    } catch (err) {
      console.error("Failed to delete account from Clerk metadata:", err);
    }
  }

  try {
    const data: GoogleOAuthStoreMulti = { accounts: filtered };
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {}
  return true;
}

export async function markAccountExpired(email: string, userId?: string): Promise<boolean> {
  let resolvedUserId = userId;
  if (!resolvedUserId) {
    try {
      const authSession = await auth();
      resolvedUserId = authSession.userId || undefined;
    } catch {}
  }

  const accounts = getStoredAccounts(resolvedUserId);
  const existing = accounts.find(
    (acc) =>
      email &&
      acc.email &&
      acc.email.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    if (existing.expired === true) {
      return true;
    }
    existing.expired = true;
    
    if (resolvedUserId) {
      accountsCache.set(resolvedUserId, accounts);
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(resolvedUserId, {
          privateMetadata: {
            googleAccounts: accounts,
          },
        });
      } catch (err) {
        console.error("Failed to mark account expired in Clerk metadata:", err);
      }
    }

    try {
      const data: GoogleOAuthStoreMulti = { accounts };
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch {}
    return true;
  }
  return false;
}

export function isOAuthConfigured(userId?: string): boolean {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = getStoredRefreshToken(undefined, userId);
  return Boolean(clientId && clientSecret && refreshToken);
}

export function hasOAuthClientCredentials(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
}

export const OAUTH_REDIRECT_COOKIE = "devdata_oauth_redirect";
