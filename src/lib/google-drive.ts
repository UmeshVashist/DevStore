import { Readable } from "stream";
import { drive_v3 } from "googleapis";
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
  DRIVE_LIST_OPTS,
  formatDriveError,
  getDriveAuthMode,
  getDriveClient,
} from "./google-auth";

// Memory caches to significantly boost performance on Vercel
interface FileCountsCache {
  counts: Record<string, number>;
  timestamp: number;
}
let fileCountsCache: FileCountsCache | null = null;
const COUNTS_CACHE_TTL = 30 * 1000; // 30 seconds

const ancestorRelationCache = new Map<string, { result: boolean; timestamp: number }>();
const RELATION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const folderPathCache = new Map<string, { id: string; timestamp: number }>();
const FOLDER_PATH_CACHE_TTL = 10 * 1000; // 10 seconds
const parentFolderNamesCache = new Map<string, { names: Set<string>; timestamp: number }>();
const PARENT_NAMES_CACHE_TTL = 8 * 1000; // 8 seconds

function clearRelationCache(): void {
  ancestorRelationCache.clear();
  fileCountsCache = null; // Clear file counts cache too to force update on modifications
  folderPathCache.clear();
  parentFolderNamesCache.clear();
}

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
    ...DRIVE_LIST_OPTS,
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
  const cacheKey = `${itemId}:${ancestorId}`;
  const now = Date.now();
  const cached = ancestorRelationCache.get(cacheKey);
  if (cached && (now - cached.timestamp < RELATION_CACHE_TTL)) {
    return cached.result;
  }

  const drive = getDriveClient();
  let currentId: string | null = itemId;

  while (currentId) {
    if (currentId === ancestorId) {
      ancestorRelationCache.set(cacheKey, { result: true, timestamp: now });
      return true;
    }

    try {
      const res = (await drive.files.get({
        ...DRIVE_OPTS,
        fileId: currentId,
        fields: "parents",
      })) as { data: { parents?: string[] | null } };
      const parents = res.data.parents || [];
      if (parents.includes(ancestorId)) {
        ancestorRelationCache.set(cacheKey, { result: true, timestamp: now });
        return true;
      }
      currentId = parents[0] || null;
    } catch {
      ancestorRelationCache.set(cacheKey, { result: false, timestamp: now });
      return false;
    }
  }

  ancestorRelationCache.set(cacheKey, { result: false, timestamp: now });
  return false;
}

export async function verifyUserOwnsFolder(
  userId: string,
  folderId: string
): Promise<boolean> {
  const { filesFolderId, trashFolderId } = await getUserFolders(userId);
  if (folderId === filesFolderId) return true;
  if (folderId === trashFolderId) return true;

  const inFiles = await isUnderFolder(folderId, filesFolderId);
  if (inFiles) return true;

  return isUnderFolder(folderId, trashFolderId);
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

async function getFolderFileCounts(
  drive: drive_v3.Drive,
  folderIds?: string[]
): Promise<Record<string, number>> {
  const now = Date.now();
  
  if (fileCountsCache && (now - fileCountsCache.timestamp < COUNTS_CACHE_TTL)) {
    if (folderIds) {
      const result: Record<string, number> = {};
      for (const id of folderIds) {
        result[id] = fileCountsCache.counts[id] || 0;
      }
      return result;
    }
    return { ...fileCountsCache.counts };
  }

  if (folderIds && folderIds.length > 0 && folderIds.length <= 8) {
    const counts: Record<string, number> = {};
    await Promise.all(
      folderIds.map(async (id) => {
        try {
          const res = await drive.files.list({
            ...DRIVE_LIST_OPTS,
            q: `'${id}' in parents and mimeType != '${FOLDER_MIME}' and trashed=false`,
            fields: "files(id)",
            pageSize: 100,
          });
          counts[id] = res.data.files?.length || 0;
        } catch (err) {
          console.error(`Error counting files for folder ${id}:`, err);
          counts[id] = 0;
        }
      })
    );
    
    if (!fileCountsCache) {
      fileCountsCache = { counts: {}, timestamp: now };
    }
    Object.assign(fileCountsCache.counts, counts);
    
    return counts;
  }

  const counts: Record<string, number> = {};
  try {
    let pageToken: string | undefined = undefined;
    do {
      const params: drive_v3.Params$Resource$Files$List = {
        ...DRIVE_LIST_OPTS,
        q: `mimeType != '${FOLDER_MIME}' and trashed=false`,
        fields: "nextPageToken,files(parents)",
        pageSize: 1000,
        pageToken,
      };
      const res = await drive.files.list(params);
      for (const file of res.data.files || []) {
        const parentId = file.parents?.[0];
        if (parentId) {
          counts[parentId] = (counts[parentId] || 0) + 1;
        }
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
    
    fileCountsCache = {
      counts,
      timestamp: now,
    };
  } catch (err) {
    console.error("Error fetching file counts:", err);
  }

  if (folderIds) {
    const result: Record<string, number> = {};
    for (const id of folderIds) {
      result[id] = counts[id] || 0;
    }
    return result;
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
    ...DRIVE_LIST_OPTS,
    q: `'${parentId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents)",
    orderBy: "folder,name",
    pageSize: 200,
  });

  const subfolderIds = (res.data.files || [])
    .filter((file) => file.mimeType === FOLDER_MIME)
    .map((file) => file.id!);

  const fileCounts = await getFolderFileCounts(drive, subfolderIds);
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
    ...DRIVE_LIST_OPTS,
    q: `'${filesFolderId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: "files(id,name,createdTime,modifiedTime,parents)",
    orderBy: "name",
    pageSize: 200,
  });

  const topLevel = (res.data.files || []).map((f) => mapDriveFolder(f, fileCounts));



  // Recursive fetch: get all folders by searching with filesFolderId as ancestor
  const folders: DriveFolder[] = [...topLevel];
  const seen = new Set(folders.map((f) => f.id));

  async function fetchChildren(parentIds: string[]) {
    for (const pid of parentIds) {
      const childRes = await drive.files.list({
        ...DRIVE_LIST_OPTS,
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

async function getUniqueFilename(
  drive: drive_v3.Drive,
  parentId: string,
  filename: string,
  mimeType: string
): Promise<string> {
  const isFolder = mimeType === FOLDER_MIME;
  let base = filename;
  let ext = "";
  if (!isFolder) {
    const lastDotIdx = filename.lastIndexOf(".");
    if (lastDotIdx !== -1) {
      base = filename.substring(0, lastDotIdx);
      ext = filename.substring(lastDotIdx);
    }
  }

  const now = Date.now();
  const cached = parentFolderNamesCache.get(parentId);
  let existingNames: Set<string>;

  if (cached && (now - cached.timestamp < PARENT_NAMES_CACHE_TTL)) {
    existingNames = cached.names;
  } else {
    const res = await drive.files.list({
      ...DRIVE_LIST_OPTS,
      q: `'${parentId}' in parents and trashed=false`,
      fields: "files(name)",
      pageSize: 1000,
    });
    existingNames = new Set(
      (res.data.files?.map((f) => f.name?.toLowerCase()).filter(Boolean) as string[]) || []
    );
    parentFolderNamesCache.set(parentId, { names: existingNames, timestamp: now });
  }

  let uniqueName = filename;
  let counter = 1;

  while (existingNames.has(uniqueName.toLowerCase())) {
    uniqueName = `${base} (${counter})${ext}`;
    counter++;
  }

  // Update the cached set locally to prevent collisions with other concurrent files
  existingNames.add(uniqueName.toLowerCase());

  return uniqueName;
}

async function createUniqueFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string> {
  const uniqueName = await getUniqueFilename(drive, parentId, name, FOLDER_MIME);
  const folder = await drive.files.create({
    ...DRIVE_OPTS,
    requestBody: {
      name: uniqueName,
      mimeType: FOLDER_MIME,
      parents: [parentId],
    },
    fields: "id",
  });
  return folder.data.id!;
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

  // Check if folder name already exists in target parentId (case-insensitive)
  const res = await drive.files.list({
    ...DRIVE_LIST_OPTS,
    q: `'${parentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: "files(name)",
    pageSize: 1000,
  });

  const folderExists = res.data.files?.some(
    (file) => file.name?.toLowerCase() === trimmed.toLowerCase()
  );

  if (folderExists) {
    throw new Error("This Name folder already created");
  }

  const folderId = await findOrCreateFolder(trimmed, parentId);
  const folderRes = await drive.files.get({
    ...DRIVE_OPTS,
    fileId: folderId,
    fields: "id,name,createdTime,modifiedTime,parents",
  });

  clearRelationCache();
  return mapDriveFolder(folderRes.data);
}

export async function ensureFolderPath(
  userId: string,
  pathParts: string[],
  baseFolderId?: string
): Promise<string> {
  const cacheKey = `${userId}:${baseFolderId || "root"}:${pathParts.join("/")}`;
  const now = Date.now();
  const cached = folderPathCache.get(cacheKey);
  if (cached && (now - cached.timestamp < FOLDER_PATH_CACHE_TTL)) {
    return cached.id;
  }

  const drive = getDriveClient();
  const { filesFolderId } = await getUserFolders(userId);
  let currentId = baseFolderId || filesFolderId;

  if (baseFolderId) {
    const owns = await verifyUserOwnsFolder(userId, baseFolderId);
    if (!owns) throw new Error("Base folder not found");
  }

  let isFirst = true;
  for (const part of pathParts) {
    if (!part || part === ".") continue;
    if (isFirst) {
      // Make the top-level part unique if there's a conflict
      const safeName = escapeQueryValue(part);
      const query = `name='${safeName}' and '${currentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`;
      const res = await drive.files.list({
        ...DRIVE_LIST_OPTS,
        q: query,
        fields: "files(id)",
        pageSize: 1,
      });

      if (res.data.files && res.data.files.length > 0) {
        currentId = await createUniqueFolder(drive, part, currentId);
      } else {
        currentId = await findOrCreateFolder(part, currentId);
      }
      isFirst = false;
    } else {
      currentId = await findOrCreateFolder(part, currentId);
    }
  }

  folderPathCache.set(cacheKey, { id: currentId, timestamp: now });
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
    ...DRIVE_LIST_OPTS,
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

  // Resolve unique name for file uploads
  const uniqueName = await getUniqueFilename(drive, parentId, filename, mimeType);

  try {
    const res = await drive.files.create({
      ...DRIVE_OPTS,
      supportsAllDrives: true,
      requestBody: {
        name: uniqueName,
        parents: [parentId],
      },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents",
    });

    clearRelationCache();
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
    removeParents: parentsRes.data.parents?.join(",") || undefined,
    requestBody: {
      appProperties: {
        deletedAt: new Date().toISOString(),
        originalName: file.name,
        originalParentId: parentsRes.data.parents?.[0] || "",
      },
    },
  });
  clearRelationCache();
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
    removeParents: parentsRes.data.parents?.join(",") || undefined,
    requestBody: {
      appProperties: {
        deletedAt: new Date().toISOString(),
        originalName: (await drive.files.get({ ...DRIVE_OPTS, fileId: folderId, fields: "name" })).data.name || "",
        originalParentId: parentsRes.data.parents?.[0] || "",
        isFolder: "true",
      },
    },
  });
  clearRelationCache();
}

export async function restoreFile(userId: string, fileId: string): Promise<DriveFile> {
  const drive = getDriveClient();
  const { filesFolderId, trashFolderId } = await getUserFolders(userId);

  const res = await drive.files.get({
    ...DRIVE_OPTS,
    fileId,
    fields: "id,name,mimeType,size,createdTime,modifiedTime,appProperties,parents",
  });

  const originalName = res.data.appProperties?.originalName || res.data.name || "restored-file";
  const originalParentId = res.data.appProperties?.originalParentId;
  let restoreParent = filesFolderId;

  if (originalParentId) {
    const ownsParent = await verifyUserOwnsFile(userId, originalParentId);
    if (ownsParent) {
      const isParentInTrash = await isUnderFolder(originalParentId, trashFolderId);
      if (isParentInTrash) {
        await restoreFolder(userId, originalParentId);
      }
      restoreParent = originalParentId;
    }
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

  clearRelationCache();

  const updated = await drive.files.get({
    ...DRIVE_OPTS,
    fileId,
    fields: "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents",
  });

  return mapDriveFile(updated.data);
}

export async function restoreFolder(userId: string, folderId: string): Promise<DriveFolder> {
  const drive = getDriveClient();
  const { filesFolderId, trashFolderId } = await getUserFolders(userId);

  const res = await drive.files.get({
    ...DRIVE_OPTS,
    fileId: folderId,
    fields: "id,name,createdTime,modifiedTime,appProperties,parents",
  });

  const originalName = res.data.appProperties?.originalName || res.data.name || "restored-folder";
  const originalParentId = res.data.appProperties?.originalParentId;
  let restoreParent = filesFolderId;

  if (originalParentId) {
    const ownsParent = await verifyUserOwnsFile(userId, originalParentId);
    if (ownsParent) {
      const isParentInTrash = await isUnderFolder(originalParentId, trashFolderId);
      if (isParentInTrash) {
        await restoreFolder(userId, originalParentId);
      }
      restoreParent = originalParentId;
    }
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

  clearRelationCache();

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
  try {
    await drive.files.delete({ ...DRIVE_OPTS, fileId });
  } catch (err) {
    const error = err as { status?: number; code?: number };
    if (error.status === 403 || error.code === 403) {
      try {
        const file = await drive.files.get({
          ...DRIVE_OPTS,
          fileId,
          fields: "parents",
        });
        const parents = file.data.parents || [];
        if (parents.length > 0) {
          await drive.files.update({
            ...DRIVE_OPTS,
            fileId,
            removeParents: parents.join(","),
          });
        }
      } catch (innerErr) {
        console.error("Failed to remove parents on delete fallback:", innerErr);
        throw err;
      }
    } else {
      throw err;
    }
  }
  clearRelationCache();
}

export async function purgeExpiredTrash(userId: string): Promise<number> {
  const drive = getDriveClient();
  const { trashFolderId } = await getUserFolders(userId);

  const res = await drive.files.list({
    ...DRIVE_LIST_OPTS,
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

  if (purged > 0) {
    clearRelationCache();
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
): Promise<drive_v3.Schema$File> {
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
  clearRelationCache();
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
    ...DRIVE_LIST_OPTS,
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

  clearRelationCache();
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
  clearRelationCache();
}

export async function getStorageQuota(): Promise<{ limit?: string; usage?: string }> {
  try {
    const drive = getDriveClient();
    const res = await drive.about.get({
      fields: "storageQuota",
    });
    return res.data.storageQuota || {};
  } catch (error) {
    console.error("Error fetching storage quota:", error);
    return {};
  }
}

export async function renameItem(
  userId: string,
  itemId: string,
  newName: string
): Promise<void> {
  const drive = getDriveClient();
  const ownsFile = await verifyUserOwnsFile(userId, itemId);
  const ownsFolder = await verifyUserOwnsFolder(userId, itemId);

  if (!ownsFile && !ownsFolder) {
    throw new Error("Item not found or unauthorized");
  }

  await drive.files.update({
    ...DRIVE_OPTS,
    fileId: itemId,
    requestBody: {
      name: newName,
    },
  });
  clearRelationCache();
}

export { getDriveAuthMode };
