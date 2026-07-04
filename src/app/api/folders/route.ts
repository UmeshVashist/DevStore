import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createUserFolder, listAllUserFolders } from "@/lib/google-drive";
import { formatDriveError } from "@/lib/google-auth";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const folders = await listAllUserFolders(userId);
    return NextResponse.json({ folders });
  } catch (error) {
    console.error("List folders error:", error);
    return NextResponse.json({ error: formatDriveError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = body.name as string;
    const parentId = body.parentId as string | undefined;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    const folder = await createUserFolder(userId, name.trim(), parentId);
    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    console.error("Create folder error:", error);
    return NextResponse.json({ error: formatDriveError(error) }, { status: 500 });
  }
}
