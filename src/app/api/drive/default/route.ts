import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { fetchAndCacheAccounts, setDefaultAccount } from "@/lib/google-oauth-store";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await fetchAndCacheAccounts(userId);

    const body = await request.json().catch(() => ({}));
    const email: string | null = body.email ? String(body.email) : null;

    const success = await setDefaultAccount(email, userId);
    if (!success) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      defaultDriveEmail: email,
    });
  } catch (error) {
    console.error("Set default drive error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to set default drive" },
      { status: 500 }
    );
  }
}
