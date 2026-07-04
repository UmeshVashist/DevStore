import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { MAX_FILE_SIZE_MB, ALLOWED_MIME_TYPES, FILE_EXTENSIONS } from "@/lib/constants";
import {
  listBrowseItems,
  uploadFile,
  uploadFileWithRelativePath,
  purgeExpiredTrash,
} from "@/lib/google-drive";
import { formatDriveError } from "@/lib/google-auth";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await purgeExpiredTrash(userId);
    const folderId = request.nextUrl.searchParams.get("folderId") || undefined;
    const items = await listBrowseItems(userId, folderId);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("List files error:", error);
    return NextResponse.json({ error: formatDriveError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderId = (formData.get("folderId") as string) || undefined;
    const relativePath = (formData.get("relativePath") as string) || undefined;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const maxSize = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Max size is ${MAX_FILE_SIZE_MB}MB` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;
    const mimeType = file.type || "application/octet-stream";

    const ext = filename.includes(".")
      ? "." + filename.split(".").pop()?.toLowerCase()
      : "";

    const isAllowed =
      ALLOWED_MIME_TYPES.includes(mimeType) ||
      (ext && FILE_EXTENSIONS.includes(ext)) ||
      mimeType === "" ||
      mimeType === "application/octet-stream";

    if (!isAllowed) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    const targetFolderId = folderId && folderId !== "root" ? folderId : undefined;

    let uploaded;
    if (relativePath) {
      uploaded = await uploadFileWithRelativePath(
        userId,
        relativePath,
        mimeType,
        buffer,
        targetFolderId
      );
    } else {
      uploaded = await uploadFile(userId, filename, mimeType, buffer, targetFolderId);
    }

    return NextResponse.json({ file: uploaded }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: formatDriveError(error) }, { status: 500 });
  }
}
