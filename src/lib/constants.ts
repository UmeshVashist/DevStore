export const RETENTION_DAYS = parseInt(
  process.env.NEXT_PUBLIC_RETENTION_DAYS || process.env.RETENTION_DAYS || "30",
  10
);

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "DevData";

export const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || "100", 10);

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/octet-stream",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  // Software / Executables
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-apple-diskimage",
  "application/vnd.android.package-archive",
  "application/x-executable",
  // Code & Data
  "application/json",
  "application/xml",
  "text/xml",
  "text/html",
  "text/css",
  "text/javascript",
  "application/javascript",
  "text/typescript",
];

export const FILE_EXTENSIONS = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".zip", ".rar", ".7z", ".exe", ".msi", ".dmg", ".apk",
  ".txt", ".csv", ".json", ".xml", ".html", ".css", ".js", ".ts",
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg",
  ".mp4", ".webm", ".mp3", ".wav",
];
