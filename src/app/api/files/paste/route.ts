import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { copyFile, copyFolder, moveItem } from "@/lib/google-drive";
import { fetchAndCacheAccounts } from "@/lib/google-oauth-store";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await fetchAndCacheAccounts(userId);

    const driveEmail =
      request.headers.get("x-drive-email") ||
      request.nextUrl.searchParams.get("driveEmail") ||
      undefined;

    const body = await request.json();
    const { action, itemId, itemType, targetFolderId } = body as {
      action: "copy" | "cut";
      itemId: string;
      itemType: "file" | "folder";
      targetFolderId?: string; // undefined or "root" means root files folder
    };

    if (!action || !itemId || !itemType) {
      return NextResponse.json(
        { error: "action, itemId, and itemType are required" },
        { status: 400 }
      );
    }

    const cleanTargetId = targetFolderId === "root" ? undefined : targetFolderId;

    if (action === "cut") {
      // Move item
      await moveItem(userId, itemId, cleanTargetId, driveEmail);
      return NextResponse.json({ success: true, message: "Item moved successfully" });
    } else if (action === "copy") {
      // Copy item
      if (itemType === "folder") {
        await copyFolder(userId, itemId, cleanTargetId, driveEmail);
      } else {
        await copyFile(userId, itemId, cleanTargetId, driveEmail);
      }
      return NextResponse.json({ success: true, message: "Item copied successfully" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Paste operation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to perform paste operation" },
      { status: 500 }
    );
  }
}
