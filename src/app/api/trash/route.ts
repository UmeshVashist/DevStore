import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { listTrashItems, purgeExpiredTrash } from "@/lib/google-drive";
import { formatDriveError } from "@/lib/google-auth";
import { RETENTION_DAYS } from "@/lib/constants";

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

    purgeExpiredTrash(userId, driveEmail).catch((err) => {
      console.error("Background trash purge error:", err);
    });
    const items = await listTrashItems(userId, driveEmail);

    return NextResponse.json({ items, retentionDays: RETENTION_DAYS });
  } catch (error) {
    console.error("List trash error:", error);
    return NextResponse.json({ error: formatDriveError(error) }, { status: 500 });
  }
}
