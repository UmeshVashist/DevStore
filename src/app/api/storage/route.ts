import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStorageQuota } from "@/lib/google-drive";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const quota = await getStorageQuota();
    return NextResponse.json({ quota });
  } catch (error) {
    console.error("Storage API error:", error);
    return NextResponse.json({ error: "Failed to fetch storage info" }, { status: 500 });
  }
}
