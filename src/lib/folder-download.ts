import JSZip from "jszip";
import { DriveItem, isDriveFolder } from "./file-types";

export interface DownloadProgress {
  totalFiles: number;
  downloadedFiles: number;
  currentFileName: string;
  status: "fetching_structure" | "downloading_files" | "zipping" | "done" | "error";
  error?: string;
}

export async function downloadFolderAsZip(
  folderId: string,
  folderName: string,
  driveEmail: string,
  onProgress: (progress: DownloadProgress) => void
): Promise<void> {
  try {
    onProgress({
      totalFiles: 0,
      downloadedFiles: 0,
      currentFileName: "",
      status: "fetching_structure",
    });

    interface FileToDownload {
      id: string;
      name: string;
      relativePath: string;
    }

    const filesToDownload: FileToDownload[] = [];

    // Helper to recursively fetch directory structure
    async function traverse(currentFolderId: string, currentRelativePath: string) {
      const url = `/api/files?folderId=${encodeURIComponent(currentFolderId)}&driveEmail=${encodeURIComponent(driveEmail)}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to list contents of folder ID ${currentFolderId}`);
      }
      const data = await res.json();
      const items: DriveItem[] = data.items || [];

      for (const item of items) {
        if (isDriveFolder(item)) {
          const nextPath = currentRelativePath
            ? `${currentRelativePath}/${item.name}`
            : item.name;
          await traverse(item.id, nextPath);
        } else {
          const filePath = currentRelativePath
            ? `${currentRelativePath}/${item.name}`
            : item.name;
          filesToDownload.push({
            id: item.id,
            name: item.name,
            relativePath: filePath,
          });
        }
      }
    }

    // Begin traversal
    await traverse(folderId, "");

    const totalFiles = filesToDownload.length;
    if (totalFiles === 0) {
      // If folder is empty, create an empty zip containing the folder name
      const zip = new JSZip();
      onProgress({
        totalFiles: 0,
        downloadedFiles: 0,
        currentFileName: "",
        status: "zipping",
      });
      const content = await zip.generateAsync({ type: "blob" });
      triggerBlobDownload(content, `${folderName}.zip`);
      onProgress({
        totalFiles: 0,
        downloadedFiles: 0,
        currentFileName: "",
        status: "done",
      });
      return;
    }

    // Download files and add to JSZip
    const zip = new JSZip();
    let downloadedFiles = 0;

    onProgress({
      totalFiles,
      downloadedFiles,
      currentFileName: "",
      status: "downloading_files",
    });

    // Process files in batches to prevent network congestion / browser memory overload
    const BATCH_SIZE = 4;
    for (let i = 0; i < filesToDownload.length; i += BATCH_SIZE) {
      const batch = filesToDownload.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (file) => {
          onProgress({
            totalFiles,
            downloadedFiles,
            currentFileName: file.relativePath,
            status: "downloading_files",
          });

          const fileUrl = `/api/files/${file.id}?driveEmail=${encodeURIComponent(driveEmail)}`;
          const response = await fetch(fileUrl);
          if (!response.ok) {
            throw new Error(`Failed to download file "${file.name}"`);
          }
          const arrayBuffer = await response.arrayBuffer();

          // JSZip automatically creates intermediate directories for paths containing slashes
          zip.file(file.relativePath, arrayBuffer);

          downloadedFiles++;
          onProgress({
            totalFiles,
            downloadedFiles,
            currentFileName: file.relativePath,
            status: "downloading_files",
          });
        })
      );
    }

    // Generate zip archive
    onProgress({
      totalFiles,
      downloadedFiles,
      currentFileName: "",
      status: "zipping",
    });

    const content = await zip.generateAsync({ type: "blob" });
    triggerBlobDownload(content, `${folderName}.zip`);

    onProgress({
      totalFiles,
      downloadedFiles,
      currentFileName: "",
      status: "done",
    });
  } catch (error) {
    console.error("Folder download error:", error);
    onProgress({
      totalFiles: 0,
      downloadedFiles: 0,
      currentFileName: "",
      status: "error",
      error: error instanceof Error ? error.message : "An error occurred during download",
    });
  }
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
