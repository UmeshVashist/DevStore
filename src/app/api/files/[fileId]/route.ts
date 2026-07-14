import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getFile,
  downloadFile,
  deleteFile,
  deleteFolder,
  permanentlyDeleteFile,
  verifyUserOwnsFile,
  verifyUserOwnsFolder,
  listTrashItems,
  renameItem,
} from "@/lib/google-drive";
import { fetchAndCacheAccounts } from "@/lib/google-oauth-store";

type RouteParams = { params: Promise<{ fileId: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
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

    const { fileId } = await params;
    const owns = await verifyUserOwnsFile(userId, fileId, driveEmail);
    if (!owns) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const preview = request.nextUrl.searchParams.get("preview") === "true";
    const meta = request.nextUrl.searchParams.get("meta") === "true";

    if (meta) {
      const file = await getFile(userId, fileId, driveEmail);
      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }
      return NextResponse.json({ file });
    }

    const { buffer, file } = await downloadFile(userId, fileId, driveEmail);

    const disposition = preview ? "inline" : "attachment";

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `${disposition}; filename="${encodeURIComponent(file.name)}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Get file error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get file" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { fileId } = await params;
    const ownsFile = await verifyUserOwnsFile(userId, fileId, driveEmail);
    const ownsFolder = await verifyUserOwnsFolder(userId, fileId, driveEmail);

    if (!ownsFile && !ownsFolder) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const trashItems = await listTrashItems(userId, driveEmail);
    const isInTrash = trashItems.some((f) => f.id === fileId);

    if (ownsFolder) {
      if (isInTrash) {
        await permanentlyDeleteFile(userId, fileId, driveEmail);
      } else {
        await deleteFolder(userId, fileId, driveEmail);
      }
    } else if (isInTrash) {
      await permanentlyDeleteFile(userId, fileId, driveEmail);
    } else {
      await deleteFile(userId, fileId, driveEmail);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete file" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const { fileId } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    await renameItem(userId, fileId, name.trim(), driveEmail);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rename error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rename" },
      { status: 500 }
    );
  }
}
