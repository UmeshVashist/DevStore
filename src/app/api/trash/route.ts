import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listTrashItems, purgeExpiredTrash } from "@/lib/google-drive";
import { formatDriveError } from "@/lib/google-auth";
import { RETENTION_DAYS } from "@/lib/constants";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await purgeExpiredTrash(userId);
    const items = await listTrashItems(userId);

    return NextResponse.json({ items, retentionDays: RETENTION_DAYS });
  } catch (error) {
    console.error("List trash error:", error);
    return NextResponse.json({ error: formatDriveError(error) }, { status: 500 });
  }
}
