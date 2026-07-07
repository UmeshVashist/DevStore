import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ALLOWED_MIME_TYPES, FILE_EXTENSIONS, MAX_FILE_SIZE_MB } from "@/lib/constants";
import {
  createUploadSession,
  createUploadSessionWithRelativePath,
} from "@/lib/google-drive";
import { formatDriveError } from "@/lib/google-auth";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { filename, mimeType, size, folderId, relativePath } = body;

    if (!filename || typeof filename !== "string") {
      return NextResponse.json({ error: "No filename provided" }, { status: 400 });
    }

    if (typeof size !== "number" || size < 0) {
      return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
    }

    const limitBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (size > limitBytes) {
      return NextResponse.json(
        { error: `File size exceeds the limit of ${MAX_FILE_SIZE_MB}MB` },
        { status: 413 }
      );
    }

    const cleanFilename = filename.replace(/\\/g, "/").split("/").pop()?.trim() || filename.trim();
    const ext = cleanFilename.includes(".")
      ? "." + cleanFilename.split(".").pop()?.toLowerCase().trim()
      : "";

    const isAllowed =
      ALLOWED_MIME_TYPES.includes(mimeType) ||
      (ext && FILE_EXTENSIONS.includes(ext)) ||
      mimeType === "" ||
      mimeType === "application/octet-stream";

    if (!isAllowed) {
      return NextResponse.json(
        { error: `File type not allowed: ${ext || mimeType}` },
        { status: 400 }
      );
    }

    const targetFolderId = folderId && folderId !== "root" ? folderId : undefined;

    let session;
    if (relativePath) {
      session = await createUploadSessionWithRelativePath(
        userId,
        relativePath,
        mimeType,
        size,
        targetFolderId
      );
    } else {
      session = await createUploadSession(
        userId,
        filename,
        mimeType,
        size,
        targetFolderId
      );
    }

    return NextResponse.json({ uploadUrl: session.uploadUrl }, { status: 200 });
  } catch (error) {
    console.error("Upload session creation error:", error);
    return NextResponse.json({ error: formatDriveError(error) }, { status: 500 });
  }
}
