import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { moveCrossDriveItem } from "@/lib/google-drive";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { itemIds, srcDriveEmail, destDriveEmail, targetFolderId } = body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: "itemIds array is required" }, { status: 400 });
    }

    if (!srcDriveEmail || !destDriveEmail) {
      return NextResponse.json({ error: "srcDriveEmail and destDriveEmail are required" }, { status: 400 });
    }

    if (srcDriveEmail.toLowerCase() === destDriveEmail.toLowerCase()) {
      return NextResponse.json({ error: "Source and destination drives must be different" }, { status: 400 });
    }

    for (const itemId of itemIds) {
      await moveCrossDriveItem(userId, itemId, srcDriveEmail, destDriveEmail, targetFolderId);
    }

    return NextResponse.json({ success: true, message: `Successfully moved ${itemIds.length} items to ${destDriveEmail}` });
  } catch (error) {
    console.error("Cross-drive move error:", error);
    const msg = error instanceof Error ? error.message : "Failed to move items between drives";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
