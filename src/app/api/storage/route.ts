import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStorageQuota } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const driveEmail =
      request.headers.get("x-drive-email") ||
      request.nextUrl.searchParams.get("driveEmail") ||
      undefined;

    const quota = await getStorageQuota(driveEmail);
    return NextResponse.json({ quota });
  } catch (error) {
    console.error("Storage API error:", error);
    return NextResponse.json({ error: "Failed to fetch storage info" }, { status: 500 });
  }
}
