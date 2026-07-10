import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { deleteStoredAccount } from "@/lib/google-oauth-store";
import { clearGoogleAuthCache } from "@/lib/google-auth";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const deleted = deleteStoredAccount(email);
    clearGoogleAuthCache();

    if (!deleted) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `Disconnected ${email}` });
  } catch (error) {
    console.error("Disconnect API error:", error);
    return NextResponse.json({ error: "Failed to disconnect account" }, { status: 500 });
  }
}
