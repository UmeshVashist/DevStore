import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import {
  getDriveAuthMode,
  getServiceAccountEmail,
  isDriveConfigured,
} from "@/lib/google-auth";
import {
  getStoredAccounts,
  hasOAuthClientCredentials,
  fetchAndCacheAccounts,
} from "@/lib/google-oauth-store";

export async function GET() {
  let userId: string | null = null;
  try {
    const authSession = await auth();
    userId = authSession.userId;
  } catch {}

  const isDev = process.env.NODE_ENV === "development";

  if (!userId && !isDev) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (userId) {
    await fetchAndCacheAccounts(userId);
  }

  const accounts = getStoredAccounts(userId || undefined);
  const authMode = getDriveAuthMode(userId || undefined);
  const connected = isDriveConfigured(userId || undefined);

  const formattedAccounts = accounts.map((acc) => ({
    email: acc.email,
    name: acc.name || acc.email,
    connectedAt: acc.connected_at,
  }));

  const primaryEmail =
    authMode === "service_account"
      ? getServiceAccountEmail()
      : accounts[0]?.email || undefined;

  return NextResponse.json({
    connected,
    hasClientCredentials: hasOAuthClientCredentials(),
    authMode,
    email: primaryEmail,
    accounts: formattedAccounts,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
  });
}
