import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getDriveAuthMode,
  getServiceAccountEmail,
  isDriveConfigured,
} from "@/lib/google-auth";
import {
  getStoredOAuthInfo,
  hasOAuthClientCredentials,
} from "@/lib/google-oauth-store";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const info = getStoredOAuthInfo();
  const authMode = getDriveAuthMode();
  const connected = isDriveConfigured();

  return NextResponse.json({
    connected,
    hasClientCredentials: hasOAuthClientCredentials(),
    authMode,
    email: authMode === "service_account" ? getServiceAccountEmail() : info?.email,
    connectedAt: authMode === "service_account" ? "env" : info?.connected_at,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
  });
}
