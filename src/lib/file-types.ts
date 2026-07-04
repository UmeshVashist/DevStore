export type FileCategory =
  | "pdf"
  | "word"
  | "excel"
  | "ppt"
  | "archive"
  | "software"
  | "image"
  | "video"
  | "audio"
  | "text"
  | "folder"
  | "other";

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface DriveFolder {
  id: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  parentId?: string;
  deletedAt?: string;
  isFolder: true;
  fileCount?: number;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  modifiedAt: string;
  webViewLink?: string;
  webContentLink?: string;
  deletedAt?: string;
  category: FileCategory;
  parentId?: string;
  isFolder?: false;
}

export type DriveItem = DriveFile | DriveFolder;

export function isDriveFolder(item: DriveItem): item is DriveFolder {
  return item.isFolder === true;
}

const EXT_MAP: Record<string, FileCategory> = {
  pdf: "pdf",
  doc: "word",
  docx: "word",
  xls: "excel",
  xlsx: "excel",
  ppt: "ppt",
  pptx: "ppt",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  exe: "software",
  msi: "software",
  dmg: "software",
  apk: "software",
  deb: "software",
  rpm: "software",
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  mp4: "video",
  webm: "video",
  avi: "video",
  mov: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  txt: "text",
  csv: "text",
  json: "text",
  xml: "text",
  html: "text",
  css: "text",
  js: "text",
  ts: "text",
};

export function getFileCategory(filename: string, mimeType?: string): FileCategory {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (EXT_MAP[ext]) return EXT_MAP[ext];

  if (mimeType) {
    if (mimeType.includes("pdf")) return "pdf";
    if (mimeType.includes("word") || mimeType.includes("document")) return "word";
    if (mimeType.includes("sheet") || mimeType.includes("excel")) return "excel";
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "ppt";
    if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed"))
      return "archive";
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    if (mimeType.startsWith("text/")) return "text";
  }

  return "other";
}

export function canPreview(category: FileCategory, mimeType: string): boolean {
  if (category === "pdf") return true;
  if (category === "image") return true;
  if (category === "text") return true;
  if (category === "video") return true;
  if (category === "audio") return true;
  if (mimeType === "application/pdf") return true;
  return false;
}

export function getPreviewType(category: FileCategory, mimeType: string): "pdf" | "image" | "text" | "video" | "audio" | "office" | "none" {
  if (category === "pdf" || mimeType === "application/pdf") return "pdf";
  if (category === "image") return "image";
  if (category === "text") return "text";
  if (category === "video") return "video";
  if (category === "audio") return "audio";
  if (["word", "excel", "ppt"].includes(category)) return "office";
  return "none";
}
