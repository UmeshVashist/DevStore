"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DriveFile, DriveFolder, DriveItem, isDriveFolder } from "@/lib/file-types";
import { Header } from "@/components/Header";
import { FileUploader } from "@/components/FileUploader";
import { FileGrid } from "@/components/FileGrid";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { RenameModal } from "@/components/RenameModal";
import { TabBar, DashboardTab } from "@/components/TabBar";
import { FolderPanel } from "@/components/FolderPanel";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { GoogleDriveBanner } from "@/components/GoogleDriveSetup";
import { FILE_EXTENSIONS, MAX_FILE_SIZE_MB } from "@/lib/constants";
import { AlertCircle, CheckCircle2, Scissors, Copy, Trash2, RotateCcw } from "lucide-react";

export function Dashboard() {
  const [items, setItems] = useState<DriveItem[]>([]);
  const [allFolders, setAllFolders] = useState<DriveFolder[]>([]);
  const [trashItems, setTrashItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<"files" | "folder" | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<DashboardTab>("files");
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string; driveEmail?: string }[]>([]);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [clipboard, setClipboard] = useState<{
    type: "copy" | "cut";
    items: DriveItem[];
  } | null>(null);
  const [hoveredItem, setHoveredItem] = useState<DriveItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renamingItem, setRenamingItem] = useState<DriveItem | null>(null);

  // Multiple Google Drives support states
  const [accounts, setAccounts] = useState<Array<{ email: string; connectedAt: string }>>([]);
  const [activeDriveEmail, setActiveDriveEmail] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("devdata_active_drive") || "all";
    }
    return "all";
  });
  const [currentFolderDriveEmail, setCurrentFolderDriveEmail] = useState<string | undefined>(undefined);

  const handleSelectToggle = useCallback((item: DriveItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const currentItems =
      activeTab === "files"
        ? items
        : activeTab === "folders"
        ? allFolders.filter((f) => !allFolders.some((p) => p.id === f.parentId))
        : trashItems;

    const allIds = currentItems.map((item) => item.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));

    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  }, [activeTab, items, allFolders, trashItems, selectedIds]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), type === "error" ? 8000 : 4000);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/drive/status");
      if (res.ok) {
        const data = await res.json();
        if (data.accounts) {
          setAccounts(data.accounts);
        }
      }
    } catch (err) {
      console.error("Error fetching status", err);
    }
  }, []);

  const handleActiveDriveChange = useCallback((email: string) => {
    setActiveDriveEmail(email);
    localStorage.setItem("devdata_active_drive", email);
    setSelectedIds(new Set());
    // Also reset folder navigation if we change active drive to avoid mixups
    setCurrentFolderId(null);
    setCurrentFolderDriveEmail(undefined);
    setBreadcrumb([]);
  }, []);

  const fetchFolders = useCallback(async () => {
    let url = "/api/folders";
    if (activeDriveEmail) {
      url += `?driveEmail=${encodeURIComponent(activeDriveEmail)}`;
    }
    const res = await fetch(url, {
      headers: activeDriveEmail ? { "x-drive-email": activeDriveEmail } : {},
    });
    if (res.ok) {
      const data = await res.json();
      setAllFolders(data.folders || []);
    }
  }, [activeDriveEmail]);

  const fetchItems = useCallback(async (folderId?: string | null, driveEmail?: string) => {
    const targetEmail = driveEmail || activeDriveEmail;
    let url = folderId ? `/api/files?folderId=${folderId}` : "/api/files";
    if (targetEmail) {
      url += (url.includes("?") ? "&" : "?") + `driveEmail=${encodeURIComponent(targetEmail)}`;
    }
    const res = await fetch(url, {
      headers: targetEmail ? { "x-drive-email": targetEmail } : {},
    });
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
    } else {
      const data = await res.json().catch(() => ({}));
      showToast("error", data.error || "Failed to load files");
    }
  }, [activeDriveEmail]);

  const fetchTrash = useCallback(async () => {
    let url = "/api/trash";
    if (activeDriveEmail) {
      url += `?driveEmail=${encodeURIComponent(activeDriveEmail)}`;
    }
    const res = await fetch(url, {
      headers: activeDriveEmail ? { "x-drive-email": activeDriveEmail } : {},
    });
    if (res.ok) {
      const data = await res.json();
      setTrashItems(data.items || data.files || []);
    }
  }, [activeDriveEmail]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchItems(currentFolderId, currentFolderDriveEmail),
        fetchFolders(),
        fetchTrash(),
        fetchStatus(),
      ]);
    } catch {
      showToast("error", "Server not ready. Wait a moment and refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, currentFolderDriveEmail, fetchItems, fetchFolders, fetchTrash, fetchStatus]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const uploadFiles = async (
    fileList: FileList | File[],
    folderId: string,
    withRelativePath = false,
    uploadTargetEmail?: string
  ) => {
    setUploading(withRelativePath ? "folder" : "files");
    setUploadProgress(0);
    let successCount = 0;
    const resolvedMap = new Map<string, string>();
    const filesArray = Array.from(fileList);
    let skippedCount = 0;
    const allowedFiles = filesArray.filter((file) => {
      const filename = file.name.trim();
      const ext = filename.includes(".")
        ? "." + filename.split(".").pop()?.toLowerCase().trim()
        : "";
      const isAllowed = ext && FILE_EXTENSIONS.includes(ext);
      if (!isAllowed) {
        skippedCount++;
        return false;
      }
      const maxFileSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
      if (file.size > maxFileSizeBytes) {
        showToast("error", `${file.name} is too large. Maximum allowed size is ${MAX_FILE_SIZE_MB}MB.`);
        return false;
      }
      return true;
    });

    if (allowedFiles.length === 0) {
      if (skippedCount > 0) {
        showToast("error", `${skippedCount} file(s) skipped (unsupported format)`);
      }
      setUploading(null);
      setUploadProgress(0);
      return;
    }

    const totalBytes = allowedFiles.reduce((acc, f) => acc + f.size, 0);
    let completedBytes = 0;

    const targetEmail = currentFolderDriveEmail || uploadTargetEmail || activeDriveEmail;

    try {
      if (withRelativePath) {
        const folderPaths = new Set<string>();
        for (const file of allowedFiles) {
          const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
          if (relPath) {
            const parts = relPath.replace(/\\/g, "/").split("/");
            parts.pop(); // filename
            if (parts.length > 0) {
              for (let i = 1; i <= parts.length; i++) {
                folderPaths.add(parts.slice(0, i).join("/"));
              }
            }
          }
        }

        const sortedFolderPaths = Array.from(folderPaths).sort((a, b) => {
          const depthA = a.split("/").length;
          const depthB = b.split("/").length;
          return depthA - depthB || a.localeCompare(b);
        });

        for (const path of sortedFolderPaths) {
          const parts = path.split("/");
          const lastPart = parts.pop()!;
          const parentPath = parts.join("/");
          const parentFolderId = parentPath
            ? resolvedMap.get(parentPath)
            : (folderId && folderId !== "root" ? folderId : undefined);

          const res = await fetch("/api/folders/ensure", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "x-drive-email": targetEmail || ""
            },
            body: JSON.stringify({
              relativePath: lastPart,
              baseFolderId: parentFolderId,
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Failed to create folder structure: ${lastPart}`);
          }

          const { folderId: createdFolderId } = await res.json();
          resolvedMap.set(path, createdFolderId);
        }
      }

      const CONCURRENCY_LIMIT = 4;
      let nextIndex = 0;

      const worker = async () => {
        while (nextIndex < allowedFiles.length) {
          const currentIndex = nextIndex++;
          const file = allowedFiles[currentIndex];

          let finalFolderId = folderId && folderId !== "root" ? folderId : undefined;
          let finalRelativePath = withRelativePath
            ? (file as File & { webkitRelativePath?: string }).webkitRelativePath
            : undefined;

          if (withRelativePath && finalRelativePath) {
            const parts = finalRelativePath.replace(/\\/g, "/").split("/");
            parts.pop(); // filename
            const dirPath = parts.join("/");
            if (resolvedMap.has(dirPath)) {
              finalFolderId = resolvedMap.get(dirPath)!;
              finalRelativePath = undefined;
            }
          }

          let currentFileUploadedBytes = 0;
          const uploadSuccess = await new Promise<{ success: boolean; file?: DriveFile; error?: string }>(async (resolve) => {
            try {
              // 1. Get upload session URL from our server
              const sessionRes = await fetch("/api/files/upload-session", {
                method: "POST",
                headers: { 
                  "Content-Type": "application/json",
                  "x-drive-email": targetEmail || ""
                },
                body: JSON.stringify({
                  filename: file.name,
                  mimeType: file.type || "application/octet-stream",
                  size: file.size,
                  folderId: finalFolderId,
                  relativePath: finalRelativePath,
                }),
              });

              if (!sessionRes.ok) {
                const data = await sessionRes.json().catch(() => ({}));
                resolve({
                  success: false,
                  error: data.error || `Failed to initiate session for ${file.name}`,
                });
                return;
              }

              const { uploadUrl } = await sessionRes.json();
              if (!uploadUrl) {
                resolve({
                  success: false,
                  error: `Server did not return an upload session URL for ${file.name}`,
                });
                return;
              }

              // 2. Upload file directly to Google Drive uploadUrl via PUT
              const xhr = new XMLHttpRequest();
              
              xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                  const diff = event.loaded - currentFileUploadedBytes;
                  currentFileUploadedBytes = event.loaded;
                  completedBytes += diff;
                  const percent = Math.min(
                    99,
                    Math.round((completedBytes / (totalBytes || 1)) * 100)
                  );
                  setUploadProgress(percent);
                }
              };

              xhr.onload = async () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try {
                    const resData = JSON.parse(xhr.responseText);
                    const fileId = resData.id;
                    if (!fileId) {
                      resolve({ success: true });
                      return;
                    }

                    // 3. Fetch full metadata from our server for the dashboard
                    const metaRes = await fetch(`/api/files/${fileId}?meta=true`, {
                      headers: { "x-drive-email": targetEmail || "" }
                    });
                    if (metaRes.ok) {
                      const metaData = await metaRes.json();
                      resolve({ success: true, file: metaData.file });
                    } else {
                      // Fallback: return minimal mapped object if metadata endpoint failed
                      resolve({
                        success: true,
                        file: {
                          id: fileId,
                          name: file.name,
                          mimeType: file.type || "application/octet-stream",
                          size: file.size,
                          createdAt: new Date().toISOString(),
                          modifiedAt: new Date().toISOString(),
                          category: "other",
                          isFolder: false,
                        } as DriveFile,
                      });
                    }
                  } catch {
                    resolve({ success: true });
                  }
                } else {
                  try {
                    const resData = JSON.parse(xhr.responseText);
                    resolve({ success: false, error: resData.error || "Google Drive upload error" });
                  } catch {
                    resolve({
                      success: false,
                      error: `Google Drive upload error (${xhr.status}: ${xhr.statusText || "Upload failed"})`,
                    });
                  }
                }
              };

              xhr.onerror = () => {
                resolve({ success: false, error: "Network error uploading to Google Drive" });
              };

              xhr.open("PUT", uploadUrl);
              xhr.setRequestHeader("Content-Range", `bytes 0-${file.size - 1}/${file.size}`);
              xhr.send(file);

            } catch (err) {
              resolve({
                success: false,
                error: err instanceof Error ? err.message : "Error initiating upload",
              });
            }
          });

          const remaining = file.size - currentFileUploadedBytes;
          if (remaining > 0) {
            completedBytes += remaining;
          }

          if (uploadSuccess.success) {
            successCount++;
          } else {
            showToast("error", uploadSuccess.error || `Failed to upload ${file.name}`);
          }

          const percent = Math.min(
            100,
            Math.round((completedBytes / (totalBytes || 1)) * 100)
          );
          setUploadProgress(percent);
        }
      };

      const workers: Promise<void>[] = [];
      const limit = Math.min(CONCURRENCY_LIMIT, allowedFiles.length);
      for (let i = 0; i < limit; i++) {
        workers.push(worker());
      }
      await Promise.all(workers);

      if (successCount > 0) {
        let msg = `${successCount} file(s) uploaded successfully`;
        if (skippedCount > 0) {
          msg += ` (${skippedCount} unsupported file(s) skipped)`;
        }
        showToast("success", msg);
        await fetchAll();
      } else if (skippedCount > 0) {
        showToast("error", `${skippedCount} file(s) skipped (unsupported format)`);
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to upload folder");
    } finally {
      setUploading(null);
      setUploadProgress(0);
    }
  };

  const handleUpload = (files: FileList | File[], folderId: string, driveEmail?: string) =>
    uploadFiles(files, folderId, false, driveEmail);

  const handleUploadFolder = (files: FileList | File[], folderId: string, driveEmail?: string) =>
    uploadFiles(files, folderId, true, driveEmail);

  const handleCreateFolder = async (name: string, parentId?: string) => {
    const targetEmail = currentFolderDriveEmail || activeDriveEmail;
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-drive-email": targetEmail || ""
      },
      body: JSON.stringify({
        name,
        parentId: parentId !== undefined ? parentId : (currentFolderId || undefined),
      }),
    });

    if (res.ok) {
      showToast("success", `Folder "${name}" created`);
      await fetchAll();
    } else {
      const data = await res.json();
      showToast("error", data.error || "Failed to create folder");
    }
  };

  const handleCopy = useCallback((item: DriveItem) => {
    setClipboard({
      type: "copy",
      items: [item],
    });
    showToast("success", `Copied "${item.name}" to clipboard`);
  }, []);

  const handleCut = useCallback((item: DriveItem) => {
    setClipboard({
      type: "cut",
      items: [item],
    });
    showToast("success", `Cut "${item.name}" to clipboard`);
  }, []);

  const handleMultiCopy = (selectedItems: DriveItem[]) => {
    setClipboard({
      type: "copy",
      items: selectedItems,
    });
    showToast("success", `Copied ${selectedItems.length} items to clipboard`);
    setSelectedIds(new Set());
  };

  const handleMultiCut = (selectedItems: DriveItem[]) => {
    setClipboard({
      type: "cut",
      items: selectedItems,
    });
    showToast("success", `Cut ${selectedItems.length} items to clipboard`);
    setSelectedIds(new Set());
  };

  const handlePaste = useCallback(async () => {
    if (!clipboard) return;
    setLoading(true);
    let successCount = 0;

    await Promise.all(
      clipboard.items.map(async (item) => {
        try {
          const res = await fetch("/api/files/paste", {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "x-drive-email": item.driveEmail || ""
            },
            body: JSON.stringify({
              action: clipboard.type,
              itemId: item.id,
              itemType: isDriveFolder(item) ? "folder" : "file",
              targetFolderId: currentFolderId || "root",
            }),
          });
          if (res.ok) {
            successCount++;
          }
        } catch (err) {
          console.error("Paste error:", err);
        }
      })
    );

    setLoading(false);
    if (successCount > 0) {
      showToast("success", `Pasted ${successCount} item(s) successfully`);
      if (clipboard.type === "cut") {
        setClipboard(null);
      }
      await fetchAll();
    } else {
      showToast("error", "Paste failed");
    }
  }, [clipboard, currentFolderId, fetchAll]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl) {
        if (e.key === "c" || e.key === "C") {
          if (hoveredItem) {
            e.preventDefault();
            handleCopy(hoveredItem);
          }
        } else if (e.key === "x" || e.key === "X") {
          if (hoveredItem) {
            e.preventDefault();
            handleCut(hoveredItem);
          }
        } else if (e.key === "v" || e.key === "V") {
          if (clipboard) {
            e.preventDefault();
            handlePaste();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hoveredItem, clipboard, handleCopy, handleCut, handlePaste]);

  const handleDownload = (file: DriveFile) => {
    const link = document.createElement("a");
    link.href = `/api/files/${file.id}?driveEmail=${encodeURIComponent(file.driveEmail || "")}`;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMultiDownload = (selectedItems: DriveItem[]) => {
    const files = selectedItems.filter((item) => !isDriveFolder(item)) as DriveFile[];
    if (files.length === 0) {
      showToast("error", "Only files can be downloaded. Select files to download.");
      return;
    }

    files.forEach((file, index) => {
      setTimeout(() => {
        const link = document.createElement("a");
        link.href = `/api/files/${file.id}?driveEmail=${encodeURIComponent(file.driveEmail || "")}`;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 400);
    });

    showToast("success", `Downloading ${files.length} file(s)`);
    setSelectedIds(new Set());
  };

  const handleMultiDelete = async (selectedItems: DriveItem[]) => {
    const isTrash = activeTab === "trash";
    const message = isTrash
      ? `Permanently delete ${selectedItems.length} items? This cannot be undone.`
      : `Move ${selectedItems.length} items to trash? You can restore within 30 days.`;

    if (!confirm(message)) return;

    setLoading(true);
    let successCount = 0;

    await Promise.all(
      selectedItems.map(async (item) => {
        try {
          const res = await fetch(`/api/files/${item.id}`, { 
            method: "DELETE",
            headers: { "x-drive-email": item.driveEmail || "" }
          });
          if (res.ok) {
            successCount++;
          }
        } catch (err) {
          console.error("Delete error:", err);
        }
      })
    );

    setLoading(false);
    if (successCount > 0) {
      showToast("success", isTrash ? `Permanently deleted ${successCount} item(s)` : `Moved ${successCount} item(s) to trash`);
      setSelectedIds(new Set());
      await fetchAll();
    } else {
      showToast("error", "Failed to delete items");
    }
  };

  const handleMultiRestore = async (selectedItems: DriveItem[]) => {
    setLoading(true);
    let successCount = 0;

    await Promise.all(
      selectedItems.map(async (item) => {
        try {
          const res = await fetch(`/api/files/${item.id}/restore`, { 
            method: "POST",
            headers: { "x-drive-email": item.driveEmail || "" }
          });
          if (res.ok) {
            successCount++;
          }
        } catch (err) {
          console.error("Restore error:", err);
        }
      })
    );

    setLoading(false);
    if (successCount > 0) {
      showToast("success", `Restored ${successCount} item(s) successfully`);
      setSelectedIds(new Set());
      await fetchAll();
      setActiveTab("files");
    } else {
      showToast("error", "Failed to restore items");
    }
  };

  const handleDelete = async (item: DriveItem) => {
    const isTrash = activeTab === "trash";
    const message = isTrash
      ? `Permanently delete "${item.name}"? This cannot be undone.`
      : `Move "${item.name}" to trash? You can restore within 30 days.`;

    if (!confirm(message)) return;

    try {
      const res = await fetch(`/api/files/${item.id}`, { 
        method: "DELETE",
        headers: { "x-drive-email": item.driveEmail || "" }
      });
      if (res.ok) {
        showToast("success", isTrash ? "Permanently deleted" : "Moved to trash");
        await fetchAll();
      } else {
        showToast("error", "Failed to delete");
      }
    } catch {
      showToast("error", "Failed to delete");
    }
  };

  const handleRestore = async (item: DriveItem) => {
    try {
      const res = await fetch(`/api/files/${item.id}/restore`, { 
        method: "POST",
        headers: { "x-drive-email": item.driveEmail || "" }
      });
      if (res.ok) {
        showToast("success", `"${item.name}" restored successfully`);
        await fetchAll();
        setActiveTab("files");
      } else {
        showToast("error", "Failed to restore");
      }
    } catch {
      showToast("error", "Failed to restore");
    }
  };

  const handleRename = useCallback(async (item: DriveItem, newName: string) => {
    try {
      const res = await fetch(`/api/files/${item.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "x-drive-email": item.driveEmail || ""
        },
        body: JSON.stringify({ name: newName }),
      });

      if (res.ok) {
        showToast("success", `Renamed successfully to "${newName}"`);
        await fetchAll();
      } else {
        const data = await res.json();
        showToast("error", data.error || "Failed to rename");
        throw new Error(data.error || "Failed to rename");
      }
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to rename");
      throw err;
    }
  }, [fetchAll]);

  const handlePreview = useCallback(async (file: DriveFile) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "html" || ext === "htm" || ext === "url") {
      if (ext === "url") {
        try {
          const res = await fetch(`/api/files/${file.id}?driveEmail=${encodeURIComponent(file.driveEmail || "")}`);
          if (res.ok) {
            const text = await res.text();
            const match = text.match(/URL=(.+)/i);
            if (match && match[1]) {
              window.open(match[1].trim(), "_blank");
              return;
            }
          }
        } catch (err) {
          console.error("Failed to parse URL file:", err);
        }
        window.open(`/api/files/${file.id}?preview=true&driveEmail=${encodeURIComponent(file.driveEmail || "")}`, "_blank");
      } else {
        window.open(`/api/files/${file.id}?preview=true&driveEmail=${encodeURIComponent(file.driveEmail || "")}`, "_blank");
      }
    } else {
      setPreviewFile(file);
    }
  }, []);

  const handleOpenFolder = (folder: DriveFolder) => {
    setCurrentFolderId(folder.id);
    setCurrentFolderDriveEmail(folder.driveEmail);
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name, driveEmail: folder.driveEmail }]);
    setActiveTab("files");
    setSelectedIds(new Set());
  };

  const handleNavigate = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
    if (!folderId) {
      setBreadcrumb([]);
      setCurrentFolderDriveEmail(undefined);
    } else {
      const idx = breadcrumb.findIndex((b) => b.id === folderId);
      if (idx >= 0) {
        setCurrentFolderDriveEmail(breadcrumb[idx].driveEmail);
        setBreadcrumb(breadcrumb.slice(0, idx + 1));
      } else {
        setBreadcrumb(breadcrumb);
      }
    }
  };

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    setSelectedIds(new Set());
  };

  const fileCount = items.filter((i) => !isDriveFolder(i)).length;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Header
          activeDrive={activeDriveEmail}
          onActiveDriveChange={handleActiveDriveChange}
          accounts={accounts}
        />

        <GoogleDriveBanner />

        {activeTab === "files" && (
          <div className="relative z-40">
            <FileUploader
              folders={allFolders}
              onUpload={handleUpload}
              onUploadFolder={handleUploadFolder}
              uploadingType={uploading}
              uploadProgress={uploadProgress}
              defaultFolderId={currentFolderId}
              accounts={accounts}
              activeDriveEmail={activeDriveEmail}
            />
          </div>
        )}

        {activeTab === "folders" && (
          <div className="relative z-40">
            <FolderPanel
              folders={allFolders}
              uploading={uploading !== null}
              onCreateFolder={handleCreateFolder}
              onUploadFolder={handleUploadFolder}
              onRefresh={fetchAll}
            />
          </div>
        )}

        <TabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          fileCount={fileCount}
          folderCount={allFolders.filter((f) => !allFolders.some((p) => p.id === f.parentId)).length}
          trashCount={trashItems.length}
        />

        {activeTab === "files" && breadcrumb.length > 0 && (
          <BreadcrumbNav path={breadcrumb} onNavigate={handleNavigate} />
        )}

        {activeTab === "files" ? (
          <FileGrid
            items={items}
            loading={loading}
            onPreview={handlePreview}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onOpenFolder={handleOpenFolder}
            onCopy={handleCopy}
            onCut={handleCut}
            onRename={setRenamingItem}
            onHoverItem={setHoveredItem}
            selectedIds={selectedIds}
            onSelectToggle={handleSelectToggle}
            emptyMessage={
              currentFolderId
                ? "This folder is empty."
                : "No files yet. Upload your first file or create a folder!"
            }
            accounts={accounts}
            showDriveBadge={activeDriveEmail === "all"}
          />
        ) : activeTab === "folders" ? (
          <FileGrid
            items={allFolders.filter((f) => !allFolders.some((p) => p.id === f.parentId))}
            loading={loading}
            onPreview={() => {}}
            onDownload={() => {}}
            onDelete={handleDelete}
            onOpenFolder={(folder) => {
              handleOpenFolder(folder);
            }}
            onCopy={handleCopy}
            onCut={handleCut}
            onRename={setRenamingItem}
            onHoverItem={setHoveredItem}
            selectedIds={selectedIds}
            onSelectToggle={handleSelectToggle}
            emptyMessage="No folders yet. Create your first folder above!"
            accounts={accounts}
            showDriveBadge={activeDriveEmail === "all"}
          />
        ) : (
          <FileGrid
            items={trashItems}
            loading={loading}
            onPreview={handlePreview}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onRestore={handleRestore}
            isTrash
            selectedIds={selectedIds}
            onSelectToggle={handleSelectToggle}
            emptyMessage="Trash is empty. Deleted files appear here for 30 days."
            accounts={accounts}
            showDriveBadge={activeDriveEmail === "all"}
          />
        )}

        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownload}
        />

        <RenameModal
          item={renamingItem}
          onClose={() => setRenamingItem(null)}
          onRename={(newName) => handleRename(renamingItem!, newName)}
        />

        {/* Floating Multi-Select Action Bar */}
        {(() => {
          const selectedItems = (
            activeTab === "files"
              ? items
              : activeTab === "folders"
              ? allFolders
              : trashItems
          ).filter((item) => selectedIds.has(item.id));

          if (selectedItems.length === 0) return null;

          return (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-neo-out rounded-2xl border border-slate-200/50 dark:border-white/10 px-6 py-4 flex items-center gap-6 shadow-2xl min-w-[320px] max-w-lg"
            >
              <div className="flex items-center gap-3">
                <span className="bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 text-xs px-2.5 py-1 rounded-full font-bold">
                  {selectedItems.length} Selected
                </span>
                <button
                  onClick={handleSelectAll}
                  className="glass-neo-btn text-xs px-2.5 py-1.5 border border-slate-200/50 dark:border-white/10 rounded-lg text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white"
                >
                  {selectedItems.length === (
                    activeTab === "files"
                      ? items.length
                      : activeTab === "folders"
                      ? allFolders.filter((f) => !allFolders.some((p) => p.id === f.parentId)).length
                      : trashItems.length
                  ) ? "Deselect All" : "Select All"}
                </button>
              </div>
              
              <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

              <div className="flex items-center gap-2 flex-wrap justify-center">
                {activeTab === "trash" ? (
                  <>
                    <button
                      onClick={() => handleMultiRestore(selectedItems)}
                      className="glass-neo-btn px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 border border-slate-200/50 dark:border-white/10 text-xs font-bold shadow-neumorph-btn"
                      title="Restore selected items"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Restore</span>
                    </button>
                    <button
                      onClick={() => handleMultiDelete(selectedItems)}
                      className="glass-neo-btn px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-slate-200/50 dark:border-white/10 text-xs font-bold shadow-neumorph-btn"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Forever</span>
                    </button>
                  </>
                ) : (
                  <>
                    {selectedItems.some(i => !isDriveFolder(i)) && (
                      <button
                        onClick={() => handleMultiDownload(selectedItems)}
                        className="glass-neo-btn px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white border border-slate-200/50 dark:border-white/10 text-xs font-bold shadow-neumorph-btn"
                        title="Download selected files"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Download</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleMultiCopy(selectedItems)}
                      className="glass-neo-btn px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white border border-slate-200/50 dark:border-white/10 text-xs font-bold shadow-neumorph-btn"
                      title="Copy selected items"
                    >
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </button>
                    <button
                      onClick={() => handleMultiCut(selectedItems)}
                      className="glass-neo-btn px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white border border-slate-200/50 dark:border-white/10 text-xs font-bold shadow-neumorph-btn"
                      title="Cut selected items"
                    >
                      <Scissors className="w-4 h-4" />
                      <span>Cut</span>
                    </button>
                    <button
                      onClick={() => handleMultiDelete(selectedItems)}
                      className="glass-neo-btn px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-slate-200/50 dark:border-white/10 text-xs font-bold shadow-neumorph-btn"
                      title="Delete selected items"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
              </div>

              <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

              <button
                onClick={() => setSelectedIds(new Set())}
                className="glass-neo-btn text-xs px-3 py-1.5 border border-slate-200/50 dark:border-white/10 rounded-lg text-slate-500 hover:text-slate-700 dark:text-white/50 dark:hover:text-white font-bold shadow-neumorph-btn"
              >
                Cancel
              </button>
            </motion.div>
          );
        })()}

        {clipboard && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="fixed bottom-6 left-6 z-40 glass-neo-out rounded-2xl border border-slate-200/50 dark:border-white/10 px-5 py-4 flex flex-col sm:flex-row items-center gap-4 shadow-2xl min-w-[280px]"
          >
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300">
                {clipboard.type === "cut" ? <Scissors className="w-5 h-5 animate-pulse" /> : <Copy className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                  Clipboard ({clipboard.type})
                </p>
                <p className="text-slate-800 dark:text-white font-bold text-sm truncate max-w-[180px]" title={clipboard.items.map(i => i.name).join(", ")}>
                  {clipboard.items.length === 1 ? clipboard.items[0].name : `${clipboard.items.length} items`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 border-slate-200/40 dark:border-white/5 pt-2 sm:pt-0">
              <button
                onClick={handlePaste}
                className="btn-primary py-2 px-4 text-xs font-bold rounded-xl shadow-neumorph-btn hover:shadow-neumorph-out transition-all text-white"
              >
                Paste Here
              </button>
              <button
                onClick={() => setClipboard(null)}
                className="glass-neo-btn py-2 px-3 text-xs font-semibold rounded-xl border border-slate-200/50 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className={`fixed bottom-6 right-6 z-50 glass rounded-xl px-5 py-3 flex items-center gap-3 shadow-xl max-w-sm ${
              toast.type === "success" ? "border-green-500/30" : "border-red-500/30"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <span className="text-white text-sm">{toast.message}</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
