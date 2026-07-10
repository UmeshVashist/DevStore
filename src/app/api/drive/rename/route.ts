import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { updateStoredAccountName, fetchAndCacheAccounts } from "@/lib/google-oauth-store";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await fetchAndCacheAccounts(userId);

    const { email, name } = await request.json();
    if (!email || !name) {
      return NextResponse.json({ error: "Missing email or name" }, { status: 400 });
    }

    const success = await updateStoredAccountName(email, name, userId);
    if (!success) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rename account error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rename account" },
      { status: 500 }
    );
  }
}
