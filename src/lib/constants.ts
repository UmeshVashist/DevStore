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
  "text/css",
  "text/javascript",
  "application/javascript",
  "text/typescript",
  "text/html",
  "application/internet-shortcut",
];

export const FILE_EXTENSIONS = [
  // Documents
  ".txt", ".doc", ".docx", ".docm", ".dotx", ".dotm", ".dot", ".pdf", ".rtf", ".odt", ".tex", ".md", ".xls", ".xlsx", ".xlsm", ".xlsb", ".xltx", ".xltm", ".xlt", ".csv", ".ods", ".ppt", ".pptx", ".pptm", ".potx", ".potm", ".pot", ".ppsx", ".ppsm", ".pps", ".ppa", ".ppam", ".odp", ".xps", ".mht", ".mhtml", ".prn", ".dif", ".slk", ".xlam", ".xla",
  // Images
  ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tif", ".tiff", ".webp", ".svg", ".ico", ".heic", ".raw", ".psd", ".ai",
  // Audio
  ".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".wma", ".mid",
  // Video
  ".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".3gp", ".mpeg", ".ts",
  // Archives & Disks
  ".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".cab", ".iso", ".img", ".vhd", ".vhdx", ".dmg",
  // System & Executables
  ".exe", ".msi", ".bat", ".cmd", ".com", ".scr", ".ps1", ".dll", ".sys", ".drv",
  // Config & Logs
  ".ini", ".inf", ".reg", ".dat", ".tmp", ".log", ".evtx", ".cfg", ".conf", ".yaml", ".yml", ".toml", ".env", ".properties",
  // Web & Code
  ".css", ".js", ".json", ".xml", ".php", ".asp", ".aspx", ".py", ".java", ".c", ".cpp", ".h", ".hpp", ".cs", ".go", ".rs", ".rb", ".swift", ".kt", ".ts", ".jsx", ".tsx", ".sh", ".html", ".htm", ".url",
  // Database
  ".db", ".sqlite", ".mdb", ".accdb", ".sql",
  // Fonts
  ".ttf", ".otf", ".woff", ".woff2",
  // Email
  ".eml", ".msg", ".pst", ".ost",
  // Certificates
  ".cer", ".crt", ".pem", ".pfx", ".p12",
  // Ebooks
  ".epub", ".mobi", ".azw3"
];
