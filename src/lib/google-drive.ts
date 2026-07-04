import { Readable } from "stream";
import { RETENTION_DAYS } from "./constants";
import {
  DriveFile,
  DriveFolder,
  DriveItem,
  FOLDER_MIME,
  getFileCategory,
} from "./file-types";
import {
  DRIVE_OPTS,
  formatDriveError,
  getDriveAuthMode,
  getDriveClient,
} from "./google-auth";

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findOrCreateFolder(
  name: string,
  parentId: string
): Promise<string> {
  const drive = getDriveClient();
  const safeName = escapeQueryValue(name);
  const query = `name='${safeName}' and '${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`;

  const res = await drive.files.list({
    ...DRIVE_OPTS,
    q: query,
    fields: "files(id)",
    pageSize: 1,
  });

  if (res.data.files?.[0]?.id) {
    return res.data.files[0].id;
  }

  const folder = await drive.files.create({
    ...DRIVE_OPTS,
    requestBody: {
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: "id",
  });

  return folder.data.id!;
}

async function getUserFolders(userId: string) {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!rootFolderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID not configured in .env.local");
  }

  const userFolderId = await findOrCreateFolder(userId, rootFolderId);
  const filesFolderId = await findOrCreateFolder("files", userFolderId);
  const trashFolderId = await findOrCreateFolder("trash", userFolderId);

  return { filesFolderId, trashFolderId };
}

export async function getUserFilesRoot(userId: string): Promise<string> {
  const { filesFolderId } = await getUserFolders(userId);
  return filesFolderId;
}

async function isUnderFolder(
  itemId: string,
  ancestorId: string
): Promise<boolean> {
  const drive = getDriveClient();
  let currentId: string | null = itemId;

  while (currentId) {
    if (currentId === ancestorId) return true;

    try {
      const res = (await drive.files.get({
        ...DRIVE_OPTS,
        fileId: currentId,
        fields: "parents",
      })) as { data: { parents?: string[] | null } };
      const parents = res.data.parents || [];
      if (parents.includes(ancestorId)) return true;
      currentId = parents[0] || null;
    } catch {
      return false;
    }
  }

  return false;
}

export async function verifyUserOwnsFolder(
  userId: string,
  folderId: string
): Promise<boolean> {
  const { filesFolderId } = await getUserFolders(userId);
  if (folderId === filesFolderId) return true;
  return isUnderFolder(folderId, filesFolderId);
}

function mapDriveFile(file: {
  id?: string | null;
  name?: string | null;
  mimeType?: string | null;
  size?: string | null;
  createdTime?: string | null;
  modifiedTime?: string | null;
  webViewLink?: string | null;
  webContentLink?: string | null;
  appProperties?: Record<string, string> | null;
  parents?: string[] | null;
}): DriveFile {
  const name = file.name || "Untitled";
  const mimeType = file.mimeType || "application/octet-stream";

  return {
    id: file.id!,
    name,
    mimeType,
    size: parseInt(file.size || "0", 10),
    createdAt: file.createdTime || new Date().toISOString(),
    modifiedAt: file.modifiedTime || new Date().toISOString(),
    webViewLink: file.webViewLink || undefined,
    webContentLink: file.webContentLink || undefined,
    deletedAt: file.appProperties?.deletedAt,
    parentId: file.parents?.[0],
    category: getFileCategory(name, mimeType),
    isFolder: false,
  };
}

async function getFolderFileCounts(drive: any): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  try {
    let pageToken: string | undefined = undefined;
    do {
      const res = await drive.files.list({
        ...DRIVE_OPTS,
        q: `mimeType != '${FOLDER_MIME}' and trashed=false`,
        fields: "nextPageToken,files(parents)",
        pageSize: 1000,
        pageToken,
      });
      for (const file of res.data.files || []) {
        const parentId = file.parents?.[0];
        if (parentId) {
          counts[parentId] = (counts[parentId] || 0) + 1;
        }
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  } catch (err) {
    console.error("Error fetching file counts:", err);
  }
  return counts;
}

function mapDriveFolder(
  file: {
    id?: string | null;
    name?: string | null;
    createdTime?: string | null;
    modifiedTime?: string | null;
    parents?: string[] | null;
  },
  fileCounts?: Record<string, number>
): DriveFolder {
  return {
    id: file.id!,
    name: file.name || "Untitled",
    createdAt: file.createdTime || new Date().toISOString(),
    modifiedAt: file.modifiedTime || new Date().toISOString(),
    parentId: file.parents?.[0],
    isFolder: true,
    fileCount: fileCounts ? (fileCounts[file.id!] || 0) : 0,
  };
}

export async function listBrowseItems(
  userId: string,
  folderId?: string
): Promise<DriveItem[]> {
  const drive = getDriveClient();
  const { filesFolderId } = await getUserFolders(userId);

  let parentId = filesFolderId;
  if (folderId) {
    const owns = await verifyUserOwnsFolder(userId, folderId);
    if (!owns) throw new Error("Folder not found");
    parentId = folderId;
  }

  const res = await drive.files.list({
    ...DRIVE_OPTS,
    q: `'${parentId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents)",
    orderBy: "folder,name",
    pageSize: 200,
  });

  const fileCounts = await getFolderFileCounts(drive);
  const items: DriveItem[] = [];

  for (const file of res.data.files || []) {
    if (file.mimeType === FOLDER_MIME) {
      items.push(mapDriveFolder(file, fileCounts));
    } else {
      items.push(mapDriveFile(file));
    }
  }

  return items.sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function listAllUserFolders(userId: string): Promise<DriveFolder[]> {
  const drive = getDriveClient();
  const { filesFolderId } = await getUserFolders(userId);
  const fileCounts = await getFolderFileCounts(drive);

  const res = await drive.files.list({
    ...DRIVE_OPTS,
    q: `'${filesFolderId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: "files(id,name,createdTime,modifiedTime,parents)",
    orderBy: "name",
    pageSize: 200,
  });

  const topLevel = (res.data.files || []).map((f) => mapDriveFolder(f, fileCounts));

  // Also collect nested folders (one level deep search via all folders under files root tree)
  const allRes = await drive.files.list({
    ...DRIVE_OPTS,
    q: `mimeType='${FOLDER_MIME}' and trashed=false and '${filesFolderId}' in parents`,
    fields: "files(id,name,createdTime,modifiedTime,parents)",
    pageSize: 200,
  });

  // Recursive fetch: get all folders by searching with filesFolderId as ancestor
  const folders: DriveFolder[] = [...topLevel];
  const seen = new Set(folders.map((f) => f.id));

  async function fetchChildren(parentIds: string[]) {
    for (const pid of parentIds) {
      const childRes = await drive.files.list({
        ...DRIVE_OPTS,
        q: `'${pid}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
        fields: "files(id,name,createdTime,modifiedTime,parents)",
        pageSize: 200,
      });
      const newIds: string[] = [];
      for (const f of childRes.data.files || []) {
        const folder = mapDriveFolder(f, fileCounts);
        if (!seen.has(folder.id)) {
          seen.add(folder.id);
          folders.push(folder);
          newIds.push(folder.id);
        }
      }
      if (newIds.length > 0) await fetchChildren(newIds);
    }
  }

  await fetchChildren(topLevel.map((f) => f.id));

  return folders.sort((a, b) => a.name.localeCompare(b.name));
}

export async function createUserFolder(
  userId: string,
  name: string,
  parentFolderId?: string
): Promise<DriveFolder> {
  const drive = getDriveClient();
  const { filesFolderId } = await getUserFolders(userId);

  let parentId = filesFolderId;
  if (parentFolderId) {
    const owns = await verifyUserOwnsFolder(userId, parentFolderId);
    if (!owns) throw new Error("Parent folder not found");
    parentId = parentFolderId;
  }

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Folder name is required");

  const folderId = await findOrCreateFolder(trimmed, parentId);
  const res = await drive.files.get({
    ...DRIVE_OPTS,
    fileId: folderId,
    fields: "id,name,createdTime,modifiedTime,parents",
  });

  return mapDriveFolder(res.data);
}

export async function ensureFolderPath(
  userId: string,
  pathParts: string[],
  baseFolderId?: string
): Promise<string> {
  const { filesFolderId } = await getUserFolders(userId);
  let currentId = baseFolderId || filesFolderId;

  if (baseFolderId) {
    const owns = await verifyUserOwnsFolder(userId, baseFolderId);
    if (!owns) throw new Error("Base folder not found");
  }

  for (const part of pathParts) {
    if (!part || part === ".") continue;
    currentId = await findOrCreateFolder(part, currentId);
  }

  return currentId;
}

export async function listUserFiles(userId: string, folderId?: string): Promise<DriveFile[]> {
  const items = await listBrowseItems(userId, folderId);
  return items.filter((item): item is DriveFile => !item.isFolder);
}

export async function listTrashFiles(userId: string): Promise<DriveFile[]> {
  const items = await listTrashItems(userId);
  return items.filter((item): item is DriveFile => !item.isFolder);
}

export async function listTrashItems(userId: string): Promise<DriveItem[]> {
  const drive = getDriveClient();
  const { trashFolderId } = await getUserFolders(userId);

  const res = await drive.files.list({
    ...DRIVE_OPTS,
    q: `'${trashFolderId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,size,createdTime,modifiedTime,appProperties,webViewLink,webContentLink,parents)",
    orderBy: "modifiedTime desc",
    pageSize: 200,
  });

  const items: DriveItem[] = [];

  for (const file of res.data.files || []) {
    if (file.mimeType === FOLDER_MIME) {
      items.push({
        ...mapDriveFolder(file),
        deletedAt: file.appProperties?.deletedAt,
      });
    } else {
      items.push(mapDriveFile(file));
    }
  }

  return items;
}

export async function uploadFile(
  userId: string,
  filename: string,
  mimeType: string,
  buffer: Buffer,
  parentFolderId?: string
): Promise<DriveFile> {
  const drive = getDriveClient();
  const { filesFolderId } = await getUserFolders(userId);

  let parentId = filesFolderId;
  if (parentFolderId) {
    const owns = await verifyUserOwnsFolder(userId, parentFolderId);
    if (!owns) throw new Error("Destination folder not found");
    parentId = parentFolderId;
  }

  try {
    const res = await drive.files.create({
      ...DRIVE_OPTS,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      requestBody: {
        name: filename,
        parents: [parentId],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents",
    });

    return mapDriveFile(res.data);
  } catch (error) {
    throw new Error(formatDriveError(error));
  }
}

export async function uploadFileWithRelativePath(
  userId: string,
  relativePath: string,
  mimeType: string,
  buffer: Buffer,
  baseFolderId?: string
): Promise<DriveFile> {
  const parts = relativePath.replace(/\\/g, "/").split("/");
  const filename = parts.pop() || "file";
  const folderParts = parts;

  const parentId = folderParts.length
    ? await ensureFolderPath(userId, folderParts, baseFolderId)
    : baseFolderId || (await getUserFilesRoot(userId));

  return uploadFile(userId, filename, mimeType, buffer, parentId);
}

export async function getFile(userId: string, fileId: string): Promise<DriveFile | null> {
  const drive = getDriveClient();
  await getUserFolders(userId);

  try {
    const res = await drive.files.get({
      ...DRIVE_OPTS,
      fileId,
      fields: "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,appProperties",
    });
    if (res.data.mimeType === FOLDER_MIME) return null;
    return mapDriveFile(res.data);
  } catch {
    return null;
  }
}

export async function getFolderPath(
  userId: string,
  folderId: string
): Promise<{ id: string; name: string }[]> {
  const drive = getDriveClient();
  const { filesFolderId } = await getUserFolders(userId);
  const path: { id: string; name: string }[] = [];
  let currentId: string | null = folderId;

  while (currentId && currentId !== filesFolderId) {
    const res = (await drive.files.get({
      ...DRIVE_OPTS,
      fileId: currentId,
      fields: "id,name,parents",
    })) as { data: { id: string; name?: string | null; parents?: string[] | null } };
    path.unshift({ id: res.data.id!, name: res.data.name || "Folder" });
    currentId = res.data.parents?.[0] || null;
    if (currentId === filesFolderId) break;
  }

  return path;
}

export async function downloadFile(userId: string, fileId: string): Promise<{ buffer: Buffer; file: DriveFile }> {
  const file = await getFile(userId, fileId);
  if (!file) throw new Error("File not found");

  const drive = getDriveClient();
  const res = await drive.files.get(
    { ...DRIVE_OPTS, fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return {
    buffer: Buffer.from(res.data as ArrayBuffer),
    file,
  };
}

export async function deleteFile(userId: string, fileId: string): Promise<void> {
  const drive = getDriveClient();
  const { trashFolderId } = await getUserFolders(userId);

  const file = await getFile(userId, fileId);
  if (!file) throw new Error("File not found");

  const parentsRes = await drive.files.get({
    ...DRIVE_OPTS,
    fileId,
    fields: "parents",
  });

  await drive.files.update({
    ...DRIVE_OPTS,
    fileId,
    addParents: trashFolderId,
    removeParents: parentsRes.data.parents?.join(",") || "",
    requestBody: {
      appProperties: {
        deletedAt: new Date().toISOString(),
        originalName: file.name,
        originalParentId: parentsRes.data.parents?.[0] || "",
      },
    },
  });
}

export async function deleteFolder(userId: string, folderId: string): Promise<void> {
  const drive = getDriveClient();
  const { trashFolderId, filesFolderId } = await getUserFolders(userId);

  if (folderId === filesFolderId) throw new Error("Cannot delete root folder");

  const owns = await verifyUserOwnsFolder(userId, folderId);
  if (!owns) throw new Error("Folder not found");

  const parentsRes = await drive.files.get({
    ...DRIVE_OPTS,
    fileId: folderId,
    fields: "parents",
  });

  await drive.files.update({
    ...DRIVE_OPTS,
    fileId: folderId,
    addParents: trashFolderId,
    removeParents: parentsRes.data.parents?.join(",") || "",
    requestBody: {
      appProperties: {
        deletedAt: new Date().toISOString(),
        originalName: (await drive.files.get({ ...DRIVE_OPTS, fileId: folderId, fields: "name" })).data.name || "",
        originalParentId: parentsRes.data.parents?.[0] || "",
        isFolder: "true",
      },
    },
  });
}

export async function restoreFile(userId: string, fileId: string): Promise<DriveFile> {
  const drive = getDriveClient();
  const { filesFolderId } = await getUserFolders(userId);

  const res = await drive.files.get({
    ...DRIVE_OPTS,
    fileId,
    fields: "id,name,mimeType,size,createdTime,modifiedTime,appProperties,parents",
  });

  const originalName = res.data.appProperties?.originalName || res.data.name || "restored-file";
  const originalParentId = res.data.appProperties?.originalParentId;
  let restoreParent = filesFolderId;

  if (originalParentId) {
    const parentExists = await verifyUserOwnsFolder(userId, originalParentId);
    if (parentExists) restoreParent = originalParentId;
  }

  await drive.files.update({
    ...DRIVE_OPTS,
    fileId,
    addParents: restoreParent,
    removeParents: res.data.parents?.join(",") || "",
    requestBody: {
      name: originalName,
      appProperties: {},
    },
  });

  const updated = await drive.files.get({
    ...DRIVE_OPTS,
    fileId,
    fields: "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents",
  });

  return mapDriveFile(updated.data);
}

export async function restoreFolder(userId: string, folderId: string): Promise<DriveFolder> {
  const drive = getDriveClient();
  const { filesFolderId } = await getUserFolders(userId);

  const res = await drive.files.get({
    ...DRIVE_OPTS,
    fileId: folderId,
    fields: "id,name,createdTime,modifiedTime,appProperties,parents",
  });

  const originalName = res.data.appProperties?.originalName || res.data.name || "restored-folder";
  const originalParentId = res.data.appProperties?.originalParentId;
  let restoreParent = filesFolderId;

  if (originalParentId) {
    const parentExists = await verifyUserOwnsFolder(userId, originalParentId);
    if (parentExists) restoreParent = originalParentId;
  }

  await drive.files.update({
    ...DRIVE_OPTS,
    fileId: folderId,
    addParents: restoreParent,
    removeParents: res.data.parents?.join(",") || "",
    requestBody: {
      name: originalName,
      appProperties: {},
    },
  });

  const updated = await drive.files.get({
    ...DRIVE_OPTS,
    fileId: folderId,
    fields: "id,name,createdTime,modifiedTime,parents",
  });

  return mapDriveFolder(updated.data);
}

export async function permanentlyDeleteFile(userId: string, fileId: string): Promise<void> {
  const drive = getDriveClient();
  await getUserFolders(userId);
  await drive.files.delete({ ...DRIVE_OPTS, fileId });
}

export async function purgeExpiredTrash(userId: string): Promise<number> {
  const drive = getDriveClient();
  const { trashFolderId } = await getUserFolders(userId);

  const res = await drive.files.list({
    ...DRIVE_OPTS,
    q: `'${trashFolderId}' in parents and trashed=false`,
    fields: "files(id,appProperties)",
    pageSize: 200,
  });

  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let purged = 0;

  for (const file of res.data.files || []) {
    const deletedAt = file.appProperties?.deletedAt
      ? new Date(file.appProperties.deletedAt).getTime()
      : 0;
    if (deletedAt > 0 && deletedAt < cutoff) {
      await drive.files.delete({ ...DRIVE_OPTS, fileId: file.id! });
      purged++;
    }
  }

  return purged;
}

export async function verifyUserOwnsFile(userId: string, fileId: string): Promise<boolean> {
  const { filesFolderId, trashFolderId } = await getUserFolders(userId);

  const inFiles = await isUnderFolder(fileId, filesFolderId);
  if (inFiles) return true;

  return isUnderFolder(fileId, trashFolderId);
}

export async function copyFile(
  userId: string,
  fileId: string,
  targetFolderId?: string
): Promise<any> {
  const drive = getDriveClient();
  const { filesFolderId } = await getUserFolders(userId);
  const destId = targetFolderId || filesFolderId;

  const ownsFile = await verifyUserOwnsFile(userId, fileId);
  if (!ownsFile) throw new Error("File not found");
  const destOwns = await verifyUserOwnsFolder(userId, destId);
  if (!destOwns) throw new Error("Destination folder not found");

  const res = await drive.files.copy({
    ...DRIVE_OPTS,
    fileId,
    requestBody: {
      parents: [destId],
    },
  });
  return res.data;
}

export async function copyFolder(
  userId: string,
  folderId: string,
  targetFolderId?: string
): Promise<string> {
  const drive = getDriveClient();
  const { filesFolderId } = await getUserFolders(userId);
  const destId = targetFolderId || filesFolderId;

  const ownsFolder = await verifyUserOwnsFolder(userId, folderId);
  if (!ownsFolder) throw new Error("Folder not found");
  const destOwns = await verifyUserOwnsFolder(userId, destId);
  if (!destOwns) throw new Error("Destination folder not found");

  const srcMeta = await drive.files.get({
    ...DRIVE_OPTS,
    fileId: folderId,
    fields: "name",
  });

  const newFolderId = await findOrCreateFolder(srcMeta.data.name || "Copied Folder", destId);

  const res = await drive.files.list({
    ...DRIVE_OPTS,
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType)",
    pageSize: 200,
  });

  for (const item of res.data.files || []) {
    if (item.mimeType === FOLDER_MIME) {
      await copyFolder(userId, item.id!, newFolderId);
    } else {
      await drive.files.copy({
        ...DRIVE_OPTS,
        fileId: item.id!,
        requestBody: {
          parents: [newFolderId],
        },
      });
    }
  }

  return newFolderId;
}

export async function moveItem(
  userId: string,
  itemId: string,
  targetFolderId?: string
): Promise<void> {
  const drive = getDriveClient();
  const { filesFolderId } = await getUserFolders(userId);
  const destId = targetFolderId || filesFolderId;

  const destOwns = await verifyUserOwnsFolder(userId, destId);
  if (!destOwns) throw new Error("Destination folder not found");

  const file = await drive.files.get({
    ...DRIVE_OPTS,
    fileId: itemId,
    fields: "parents",
  });
  
  const previousParents = (file.data.parents || []).join(",");

  await drive.files.update({
    ...DRIVE_OPTS,
    fileId: itemId,
    addParents: destId,
    removeParents: previousParents || undefined,
    fields: "id, parents",
  });
}

export { getDriveAuthMode };
