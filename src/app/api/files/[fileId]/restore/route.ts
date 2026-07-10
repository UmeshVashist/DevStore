import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { restoreFile, restoreFolder, verifyUserOwnsFile } from "@/lib/google-drive";
import { getDriveClient, DRIVE_OPTS } from "@/lib/google-auth";
import { FOLDER_MIME } from "@/lib/file-types";

type RouteParams = { params: Promise<{ fileId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const driveEmail =
      request.headers.get("x-drive-email") ||
      request.nextUrl.searchParams.get("driveEmail") ||
      undefined;

    const { fileId } = await params;

    const drive = getDriveClient(driveEmail);
    let isFolder = false;
    try {
      const meta = await drive.files.get({ ...DRIVE_OPTS, fileId, fields: "mimeType" });
      isFolder = meta.data.mimeType === FOLDER_MIME;
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (isFolder) {
      const owns = await verifyUserOwnsFile(userId, fileId, driveEmail);
      if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const folder = await restoreFolder(userId, fileId, driveEmail);
      return NextResponse.json({ folder });
    }

    const owns = await verifyUserOwnsFile(userId, fileId, driveEmail);
    if (!owns) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const file = await restoreFile(userId, fileId, driveEmail);

    return NextResponse.json({ file });
  } catch (error) {
    console.error("Restore file error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore file" },
      { status: 500 }
    );
  }
}
