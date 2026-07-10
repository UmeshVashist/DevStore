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
  getGoogleAuth,
} from "./google-auth";
import { getStoredAccounts, fetchAndCacheAccounts } from "./google-oauth-store";
import { auth } from "@clerk/nextjs/server";

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

export function clearRelationCache(): void {
  ancestorRelationCache.clear();
  fileCountsCache = null; // Clear file counts cache too to force update on modifications
  folderPathCache.clear();
  parentFolderNamesCache.clear();
}

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function resolveDriveEmail(driveEmail?: string): Promise<string | undefined> {
  try {
    const authSession = await auth();
    if (authSession.userId) {
      await fetchAndCacheAccounts(authSession.userId);
    }
  } catch {}

  if (driveEmail === "all") {
    const accounts = getStoredAccounts();
    if (accounts.length === 0) return undefined;
    if (accounts.length === 1) return accounts[0].email;

    // Check storage quota of each and pick the one with the most free bytes
    let bestEmail = accounts[0].email;
    let maxFree = -1;
    await Promise.all(
      accounts.map(async (acc) => {
        try {
          const drive = getDriveClient(acc.email);
          const about = await drive.about.get({ fields: "storageQuota" });
          const quota = about.data.storageQuota;
          if (quota && quota.limit && quota.usage) {
            const free = parseInt(quota.limit, 10) - parseInt(quota.usage, 10);
            if (free > maxFree) {
              maxFree = free;
              bestEmail = acc.email;
            }
          }
        } catch (err) {
          console.error(`Error querying quota for resolving best drive ${acc.email}:`, err);
        }
      })
    );
    return bestEmail;
  }
  return driveEmail;
}

async function findOrCreateFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
  userId?: string
): Promise<string> {
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
      appProperties: userId ? { userId } : undefined,
    },
    fields: "id",
  });

  return folder.data.id!;
}

async function getUserFolders(userId: string, driveEmail?: string) {
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!rootFolderId) {
    throw new Error("GOOGLE_DRIVE_FOLDER_ID not configured in .env.local");
  }

  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);

  let actualRootId = rootFolderId;
  try {
    await drive.files.get({
      fileId: rootFolderId,
      fields: "id",
    });
  } catch {
    actualRootId = await findOrCreateFolder(drive, "DevData", "root");
  }

  const userFolderId = await findOrCreateFolder(drive, userId, actualRootId, userId);
  const filesFolderId = await findOrCreateFolder(drive, "files", userFolderId, userId);
  const trashFolderId = await findOrCreateFolder(drive, "trash", userFolderId, userId);

  return { filesFolderId, trashFolderId };
}

export async function getUserFilesRoot(userId: string, driveEmail?: string): Promise<string> {
  const { filesFolderId } = await getUserFolders(userId, driveEmail);
  return filesFolderId;
}

async function isUnderFolder(
  itemId: string,
  ancestorId: string,
  driveEmail?: string
): Promise<boolean> {
  const cacheKey = `${itemId}:${ancestorId}`;
  const now = Date.now();
  const cached = ancestorRelationCache.get(cacheKey);
  if (cached && (now - cached.timestamp < RELATION_CACHE_TTL)) {
    return cached.result;
  }

  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
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
  folderId: string,
  driveEmail?: string
): Promise<boolean> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const { filesFolderId, trashFolderId } = await getUserFolders(userId, resolvedEmail);
  if (folderId === filesFolderId) return true;
  if (folderId === trashFolderId) return true;

  try {
    const drive = getDriveClient(resolvedEmail);
    const res = await drive.files.get({
      ...DRIVE_OPTS,
      fileId: folderId,
      fields: "appProperties",
    });
    if (res.data.appProperties?.userId === userId) {
      const now = Date.now();
      ancestorRelationCache.set(`${folderId}:${filesFolderId}`, { result: true, timestamp: now });
      return true;
    }
  } catch (err) {
    console.error("verifyUserOwnsFolder appProperties check failed:", err);
  }

  const inFiles = await isUnderFolder(folderId, filesFolderId, resolvedEmail);
  if (inFiles) return true;

  return isUnderFolder(folderId, trashFolderId, resolvedEmail);
}

function mapDriveFile(
  file: {
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
  },
  driveEmail?: string
): DriveFile {
  const rawName = file.name || "Untitled";
  const name = rawName.replace(/\\/g, "/").split("/").pop() || rawName;
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
    driveEmail,
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
  fileCounts?: Record<string, number>,
  driveEmail?: string
): DriveFolder {
  const rawName = file.name || "Untitled";
  const name = rawName.replace(/\\/g, "/").split("/").pop() || rawName;
  return {
    id: file.id!,
    name,
    createdAt: file.createdTime || new Date().toISOString(),
    modifiedAt: file.modifiedTime || new Date().toISOString(),
    parentId: file.parents?.[0],
    isFolder: true,
    fileCount: fileCounts ? (fileCounts[file.id!] || 0) : 0,
    driveEmail,
  };
}

export async function listBrowseItems(
  userId: string,
  folderId?: string,
  driveEmail?: string
): Promise<DriveItem[]> {
  if (driveEmail === "all") {
    const accounts = getStoredAccounts();
    if (accounts.length === 0) {
      return listSingleBrowseItems(userId, folderId);
    }

    const results = await Promise.all(
      accounts.map(async (acc) => {
        try {
          return await listSingleBrowseItems(userId, folderId, acc.email);
        } catch (err) {
          console.error(`Error listing items for ${acc.email}:`, err);
          return [];
        }
      })
    );

    const merged = results.flat();
    return merged.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  return listSingleBrowseItems(userId, folderId, driveEmail);
}

async function listSingleBrowseItems(
  userId: string,
  folderId?: string,
  driveEmail?: string
): Promise<DriveItem[]> {
  const drive = getDriveClient(driveEmail);
  const { filesFolderId } = await getUserFolders(userId, driveEmail);

  let parentId = filesFolderId;
  if (folderId) {
    const owns = await verifyUserOwnsFolder(userId, folderId, driveEmail);
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
      items.push(mapDriveFolder(file, fileCounts, driveEmail));
    } else {
      items.push(mapDriveFile(file, driveEmail));
    }
  }

  return items;
}

export async function listAllUserFolders(userId: string, driveEmail?: string): Promise<DriveFolder[]> {
  if (driveEmail === "all") {
    const accounts = getStoredAccounts();
    if (accounts.length === 0) {
      return listSingleAllUserFolders(userId);
    }
    const results = await Promise.all(
      accounts.map(async (acc) => {
        try {
          return await listSingleAllUserFolders(userId, acc.email);
        } catch (err) {
          console.error(`Error listing all folders for ${acc.email}:`, err);
          return [];
        }
      })
    );
    const merged = results.flat();
    return merged.sort((a, b) => a.name.localeCompare(b.name));
  }

  return listSingleAllUserFolders(userId, driveEmail);
}

async function listSingleAllUserFolders(userId: string, driveEmail?: string): Promise<DriveFolder[]> {
  const drive = getDriveClient(driveEmail);
  const { filesFolderId } = await getUserFolders(userId, driveEmail);
  const fileCounts = await getFolderFileCounts(drive);

  const res = await drive.files.list({
    ...DRIVE_LIST_OPTS,
    q: `'${filesFolderId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: "files(id,name,createdTime,modifiedTime,parents)",
    orderBy: "name",
    pageSize: 200,
  });

  const topLevel = (res.data.files || []).map((f) => mapDriveFolder(f, fileCounts, driveEmail));

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
        const folder = mapDriveFolder(f, fileCounts, driveEmail);
        if (!seen.has(folder.id)) {
          seen.add(folder.id);
          folders.push(folder);
          newIds.push(folder.id);
        }
      }
      if (newIds.length > 0) await fetchChildren(newIds);
    }
  }

  if (topLevel.length > 0) {
    await fetchChildren(topLevel.map((f) => f.id));
  }

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

  existingNames.add(uniqueName.toLowerCase());
  return uniqueName;
}

async function createUniqueFolder(
  drive: drive_v3.Drive,
  name: string,
  parentId: string,
  userId?: string
): Promise<string> {
  const uniqueName = await getUniqueFilename(drive, parentId, name, FOLDER_MIME);
  const folder = await drive.files.create({
    ...DRIVE_OPTS,
    requestBody: {
      name: uniqueName,
      mimeType: FOLDER_MIME,
      parents: [parentId],
      appProperties: userId ? { userId } : undefined,
    },
    fields: "id",
  });
  return folder.data.id!;
}

export async function createUserFolder(
  userId: string,
  name: string,
  parentFolderId?: string,
  driveEmail?: string
): Promise<DriveFolder> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  const { filesFolderId } = await getUserFolders(userId, resolvedEmail);

  let parentId = filesFolderId;
  if (parentFolderId) {
    const owns = await verifyUserOwnsFolder(userId, parentFolderId, resolvedEmail);
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

  const folderId = await findOrCreateFolder(drive, trimmed, parentId, userId);
  const folderRes = await drive.files.get({
    ...DRIVE_OPTS,
    fileId: folderId,
    fields: "id,name,createdTime,modifiedTime,parents",
  });

  clearRelationCache();
  return mapDriveFolder(folderRes.data, undefined, resolvedEmail);
}

export async function ensureFolderPath(
  userId: string,
  pathParts: string[],
  baseFolderId?: string,
  driveEmail?: string
): Promise<string> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const cacheKey = `${userId}:${baseFolderId || "root"}:${pathParts.join("/")}:${resolvedEmail || "default"}`;
  const now = Date.now();
  const cached = folderPathCache.get(cacheKey);
  if (cached && (now - cached.timestamp < FOLDER_PATH_CACHE_TTL)) {
    return cached.id;
  }

  const drive = getDriveClient(resolvedEmail);
  const { filesFolderId } = await getUserFolders(userId, resolvedEmail);
  let currentId = baseFolderId || filesFolderId;

  if (baseFolderId) {
    const owns = await verifyUserOwnsFolder(userId, baseFolderId, resolvedEmail);
    if (!owns) throw new Error("Base folder not found");
  }

  let isFirst = true;
  for (const part of pathParts) {
    if (!part || part === ".") continue;
    if (isFirst) {
      const safeName = escapeQueryValue(part);
      const query = `name='${safeName}' and '${currentId}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`;
      const res = await drive.files.list({
        ...DRIVE_LIST_OPTS,
        q: query,
        fields: "files(id)",
        pageSize: 1,
      });

      if (res.data.files && res.data.files.length > 0) {
        currentId = await createUniqueFolder(drive, part, currentId, userId);
      } else {
        currentId = await findOrCreateFolder(drive, part, currentId, userId);
      }
      isFirst = false;
    } else {
      currentId = await findOrCreateFolder(drive, part, currentId, userId);
    }
  }

  folderPathCache.set(cacheKey, { id: currentId, timestamp: now });
  return currentId;
}

export async function listUserFiles(
  userId: string,
  folderId?: string,
  driveEmail?: string
): Promise<DriveFile[]> {
  const items = await listBrowseItems(userId, folderId, driveEmail);
  return items.filter((item): item is DriveFile => !item.isFolder);
}

export async function listTrashFiles(userId: string, driveEmail?: string): Promise<DriveFile[]> {
  const items = await listTrashItems(userId, driveEmail);
  return items.filter((item): item is DriveFile => !item.isFolder);
}

export async function listTrashItems(userId: string, driveEmail?: string): Promise<DriveItem[]> {
  if (driveEmail === "all") {
    const accounts = getStoredAccounts();
    if (accounts.length === 0) {
      return listSingleTrashItems(userId);
    }
    const results = await Promise.all(
      accounts.map(async (acc) => {
        try {
          return await listSingleTrashItems(userId, acc.email);
        } catch (err) {
          console.error(`Error listing trash for ${acc.email}:`, err);
          return [];
        }
      })
    );
    const merged = results.flat();
    return merged.sort((a, b) => {
      const timeA = a.deletedAt || a.modifiedAt;
      const timeB = b.deletedAt || b.modifiedAt;
      return timeB.localeCompare(timeA);
    });
  }

  return listSingleTrashItems(userId, driveEmail);
}

async function listSingleTrashItems(userId: string, driveEmail?: string): Promise<DriveItem[]> {
  const drive = getDriveClient(driveEmail);
  const { trashFolderId } = await getUserFolders(userId, driveEmail);

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
        ...mapDriveFolder(file, undefined, driveEmail),
        deletedAt: file.appProperties?.deletedAt,
      });
    } else {
      items.push(mapDriveFile(file, driveEmail));
    }
  }

  return items;
}

export async function uploadFile(
  userId: string,
  filename: string,
  mimeType: string,
  mediaBody: Readable | Buffer,
  parentFolderId?: string,
  driveEmail?: string
): Promise<DriveFile> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  const { filesFolderId } = await getUserFolders(userId, resolvedEmail);

  let parentId = filesFolderId;
  if (parentFolderId) {
    const owns = await verifyUserOwnsFolder(userId, parentFolderId, resolvedEmail);
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
        appProperties: { userId },
      },
      media: {
        mimeType,
        body: mediaBody,
      },
      fields: "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,appProperties",
    });

    clearRelationCache();
    return mapDriveFile(res.data, resolvedEmail);
  } catch (error) {
    throw new Error(formatDriveError(error));
  }
}

export async function uploadFileWithRelativePath(
  userId: string,
  relativePath: string,
  mimeType: string,
  mediaBody: Readable | Buffer,
  baseFolderId?: string,
  driveEmail?: string
): Promise<DriveFile> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const parts = relativePath.replace(/\\/g, "/").split("/");
  const filename = parts.pop() || "file";
  const folderParts = parts;

  const parentId = folderParts.length
    ? await ensureFolderPath(userId, folderParts, baseFolderId, resolvedEmail)
    : baseFolderId || (await getUserFilesRoot(userId, resolvedEmail));

  return uploadFile(userId, filename, mimeType, mediaBody, parentId, resolvedEmail);
}

export async function getFile(
  userId: string,
  fileId: string,
  driveEmail?: string
): Promise<DriveFile | null> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  await getUserFolders(userId, resolvedEmail);

  try {
    const res = await drive.files.get({
      ...DRIVE_OPTS,
      fileId,
      fields: "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,parents,appProperties",
    });
    if (res.data.mimeType === FOLDER_MIME) return null;
    return mapDriveFile(res.data, resolvedEmail);
  } catch {
    return null;
  }
}

export async function getFolderPath(
  userId: string,
  folderId: string,
  driveEmail?: string
): Promise<{ id: string; name: string }[]> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  const { filesFolderId } = await getUserFolders(userId, resolvedEmail);
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

export async function downloadFile(
  userId: string,
  fileId: string,
  driveEmail?: string
): Promise<{ buffer: Buffer; file: DriveFile }> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const file = await getFile(userId, fileId, resolvedEmail);
  if (!file) throw new Error("File not found");

  const drive = getDriveClient(resolvedEmail);
  const res = await drive.files.get(
    { ...DRIVE_OPTS, fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );

  return {
    buffer: Buffer.from(res.data as ArrayBuffer),
    file,
  };
}

export async function deleteFile(userId: string, fileId: string, driveEmail?: string): Promise<void> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  const { trashFolderId } = await getUserFolders(userId, resolvedEmail);

  const file = await getFile(userId, fileId, resolvedEmail);
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

export async function deleteFolder(userId: string, folderId: string, driveEmail?: string): Promise<void> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  const { trashFolderId, filesFolderId } = await getUserFolders(userId, resolvedEmail);

  if (folderId === filesFolderId) throw new Error("Cannot delete root folder");

  const owns = await verifyUserOwnsFolder(userId, folderId, resolvedEmail);
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

export async function restoreFile(userId: string, fileId: string, driveEmail?: string): Promise<DriveFile> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  const { filesFolderId, trashFolderId } = await getUserFolders(userId, resolvedEmail);

  const res = await drive.files.get({
    ...DRIVE_OPTS,
    fileId,
    fields: "id,name,mimeType,size,createdTime,modifiedTime,appProperties,parents",
  });

  const originalName = res.data.appProperties?.originalName || res.data.name || "restored-file";
  const originalParentId = res.data.appProperties?.originalParentId;
  let restoreParent = filesFolderId;

  if (originalParentId) {
    const ownsParent = await verifyUserOwnsFile(userId, originalParentId, resolvedEmail);
    if (ownsParent) {
      const isParentInTrash = await isUnderFolder(originalParentId, trashFolderId, resolvedEmail);
      if (isParentInTrash) {
        await restoreFolder(userId, originalParentId, resolvedEmail);
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

  return mapDriveFile(updated.data, resolvedEmail);
}

export async function restoreFolder(userId: string, folderId: string, driveEmail?: string): Promise<DriveFolder> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  const { filesFolderId, trashFolderId } = await getUserFolders(userId, resolvedEmail);

  const res = await drive.files.get({
    ...DRIVE_OPTS,
    fileId: folderId,
    fields: "id,name,createdTime,modifiedTime,appProperties,parents",
  });

  const originalName = res.data.appProperties?.originalName || res.data.name || "restored-folder";
  const originalParentId = res.data.appProperties?.originalParentId;
  let restoreParent = filesFolderId;

  if (originalParentId) {
    const ownsParent = await verifyUserOwnsFile(userId, originalParentId, resolvedEmail);
    if (ownsParent) {
      const isParentInTrash = await isUnderFolder(originalParentId, trashFolderId, resolvedEmail);
      if (isParentInTrash) {
        await restoreFolder(userId, originalParentId, resolvedEmail);
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

  return mapDriveFolder(updated.data, undefined, resolvedEmail);
}

export async function permanentlyDeleteFile(userId: string, fileId: string, driveEmail?: string): Promise<void> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  await getUserFolders(userId, resolvedEmail);
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

export async function purgeExpiredTrash(userId: string, driveEmail?: string): Promise<number> {
  if (driveEmail === "all") {
    const accounts = getStoredAccounts();
    if (accounts.length === 0) {
      return purgeSingleExpiredTrash(userId);
    }
    const results = await Promise.all(
      accounts.map(async (acc) => {
        try {
          return await purgeSingleExpiredTrash(userId, acc.email);
        } catch (err) {
          console.error(`Error purging trash for ${acc.email}:`, err);
          return 0;
        }
      })
    );
    return results.reduce((acc, val) => acc + val, 0);
  }
  return purgeSingleExpiredTrash(userId, driveEmail);
}

async function purgeSingleExpiredTrash(userId: string, driveEmail?: string): Promise<number> {
  const drive = getDriveClient(driveEmail);
  const { trashFolderId } = await getUserFolders(userId, driveEmail);

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

export async function verifyUserOwnsFile(
  userId: string,
  fileId: string,
  driveEmail?: string
): Promise<boolean> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const { filesFolderId, trashFolderId } = await getUserFolders(userId, resolvedEmail);

  try {
    const drive = getDriveClient(resolvedEmail);
    const res = await drive.files.get({
      ...DRIVE_OPTS,
      fileId: fileId,
      fields: "appProperties",
    });
    if (res.data.appProperties?.userId === userId) {
      const now = Date.now();
      ancestorRelationCache.set(`${fileId}:${filesFolderId}`, { result: true, timestamp: now });
      return true;
    }
  } catch (err) {
    console.error("verifyUserOwnsFile appProperties check failed:", err);
  }

  const inFiles = await isUnderFolder(fileId, filesFolderId, resolvedEmail);
  if (inFiles) return true;

  return isUnderFolder(fileId, trashFolderId, resolvedEmail);
}

export async function copyFile(
  userId: string,
  fileId: string,
  targetFolderId?: string,
  driveEmail?: string
): Promise<drive_v3.Schema$File> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  const { filesFolderId } = await getUserFolders(userId, resolvedEmail);
  const destId = targetFolderId || filesFolderId;

  const ownsFile = await verifyUserOwnsFile(userId, fileId, resolvedEmail);
  if (!ownsFile) throw new Error("File not found");
  const destOwns = await verifyUserOwnsFolder(userId, destId, resolvedEmail);
  if (!destOwns) throw new Error("Destination folder not found");

  const res = await drive.files.copy({
    ...DRIVE_OPTS,
    fileId,
    requestBody: {
      parents: [destId],
      appProperties: { userId },
    },
  });
  clearRelationCache();
  return res.data;
}

export async function copyFolder(
  userId: string,
  folderId: string,
  targetFolderId?: string,
  driveEmail?: string
): Promise<string> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  const { filesFolderId } = await getUserFolders(userId, resolvedEmail);
  const destId = targetFolderId || filesFolderId;

  const ownsFolder = await verifyUserOwnsFolder(userId, folderId, resolvedEmail);
  if (!ownsFolder) throw new Error("Folder not found");
  const destOwns = await verifyUserOwnsFolder(userId, destId, resolvedEmail);
  if (!destOwns) throw new Error("Destination folder not found");

  const srcMeta = await drive.files.get({
    ...DRIVE_OPTS,
    fileId: folderId,
    fields: "name",
  });

  const newFolderId = await findOrCreateFolder(drive, srcMeta.data.name || "Copied Folder", destId, userId);

  const res = await drive.files.list({
    ...DRIVE_LIST_OPTS,
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType)",
    pageSize: 200,
  });

  for (const item of res.data.files || []) {
    if (item.mimeType === FOLDER_MIME) {
      await copyFolder(userId, item.id!, newFolderId, resolvedEmail);
    } else {
      await drive.files.copy({
        ...DRIVE_OPTS,
        fileId: item.id!,
        requestBody: {
          parents: [newFolderId],
          appProperties: { userId },
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
  targetFolderId?: string,
  driveEmail?: string
): Promise<void> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  const { filesFolderId } = await getUserFolders(userId, resolvedEmail);
  const destId = targetFolderId || filesFolderId;

  const destOwns = await verifyUserOwnsFolder(userId, destId, resolvedEmail);
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

export async function getStorageQuota(driveEmail?: string): Promise<{ limit?: string; usage?: string }> {
  try {
    const authSession = await auth();
    if (authSession.userId) {
      await fetchAndCacheAccounts(authSession.userId);
    }
  } catch {}

  if (driveEmail === "all") {
    const accounts = getStoredAccounts();
    if (accounts.length === 0) {
      return getSingleStorageQuota();
    }

    let totalLimit = 0;
    let totalUsage = 0;

    await Promise.all(
      accounts.map(async (acc) => {
        try {
          const quota = await getSingleStorageQuota(acc.email);
          if (quota) {
            totalLimit += parseInt(quota.limit || "0", 10);
            totalUsage += parseInt(quota.usage || "0", 10);
          }
        } catch (err) {
          console.error(`Error querying storage quota for ${acc.email}:`, err);
        }
      })
    );

    return {
      limit: totalLimit.toString(),
      usage: totalUsage.toString(),
    };
  }

  return getSingleStorageQuota(driveEmail);
}

async function getSingleStorageQuota(driveEmail?: string): Promise<{ limit?: string; usage?: string }> {
  try {
    const drive = getDriveClient(driveEmail);
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
  newName: string,
  driveEmail?: string
): Promise<void> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  const ownsFile = await verifyUserOwnsFile(userId, itemId, resolvedEmail);
  const ownsFolder = await verifyUserOwnsFolder(userId, itemId, resolvedEmail);

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

export async function createUploadSession(
  userId: string,
  filename: string,
  mimeType: string,
  fileSize: number,
  parentFolderId?: string,
  origin?: string,
  driveEmail?: string
): Promise<{ uploadUrl: string; uniqueName: string; parentId: string }> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const drive = getDriveClient(resolvedEmail);
  const { filesFolderId } = await getUserFolders(userId, resolvedEmail);

  let parentId = filesFolderId;
  if (parentFolderId) {
    const owns = await verifyUserOwnsFolder(userId, parentFolderId, resolvedEmail);
    if (!owns) throw new Error("Destination folder not found");
    parentId = parentFolderId;
  }

  // Resolve unique name for file uploads
  const uniqueName = await getUniqueFilename(drive, parentId, filename, mimeType);

  // Get the authorization token
  const auth = getGoogleAuth(resolvedEmail);
  const tokenInfo = await auth.getAccessToken();
  const accessToken = tokenInfo.token;

  if (!accessToken) {
    throw new Error("Failed to retrieve Google API access token");
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": mimeType || "application/octet-stream",
    "X-Upload-Content-Length": fileSize.toString(),
  };

  if (origin) {
    headers["Origin"] = origin;
  }

  // Initiate resumable upload session
  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: uniqueName,
        parents: [parentId],
        appProperties: { userId },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to initiate Google Drive upload session: ${response.statusText} - ${errorText}`);
  }

  const uploadUrl = response.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Google Drive did not return a session upload URL in the Location header");
  }

  return { uploadUrl, uniqueName, parentId };
}

export async function createUploadSessionWithRelativePath(
  userId: string,
  relativePath: string,
  mimeType: string,
  fileSize: number,
  baseFolderId?: string,
  origin?: string,
  driveEmail?: string
): Promise<{ uploadUrl: string; uniqueName: string; parentId: string }> {
  const resolvedEmail = await resolveDriveEmail(driveEmail);
  const parts = relativePath.replace(/\\/g, "/").split("/");
  const filename = parts.pop() || "file";
  const folderParts = parts;

  const parentId = folderParts.length
    ? await ensureFolderPath(userId, folderParts, baseFolderId, resolvedEmail)
    : baseFolderId || (await getUserFilesRoot(userId, resolvedEmail));

  return createUploadSession(userId, filename, mimeType, fileSize, parentId, origin, resolvedEmail);
}

export { getDriveAuthMode };
