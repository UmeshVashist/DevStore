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
} from "@/lib/google-oauth-store";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = getStoredAccounts();
  const authMode = getDriveAuthMode();
  const connected = isDriveConfigured();

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
