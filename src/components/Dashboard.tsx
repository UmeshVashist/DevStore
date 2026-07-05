"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { DriveFile, DriveFolder, DriveItem, isDriveFolder } from "@/lib/file-types";
import { Header } from "@/components/Header";
import { FileUploader } from "@/components/FileUploader";
import { FileGrid } from "@/components/FileGrid";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { TabBar, DashboardTab } from "@/components/TabBar";
import { FolderPanel } from "@/components/FolderPanel";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { GoogleDriveBanner } from "@/components/GoogleDriveSetup";
import { FILE_EXTENSIONS } from "@/lib/constants";
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
  const [breadcrumb, setBreadcrumb] = useState<{ id: string; name: string }[]>([]);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [clipboard, setClipboard] = useState<{
    type: "copy" | "cut";
    items: DriveItem[];
  } | null>(null);
  const [hoveredItem, setHoveredItem] = useState<DriveItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const fetchFolders = useCallback(async () => {
    const res = await fetch("/api/folders");
    if (res.ok) {
      const data = await res.json();
      setAllFolders(data.folders || []);
    }
  }, []);

  const fetchItems = useCallback(async (folderId?: string | null) => {
    const url = folderId ? `/api/files?folderId=${folderId}` : "/api/files";
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
    } else {
      const data = await res.json().catch(() => ({}));
      showToast("error", data.error || "Failed to load files");
    }
  }, []);

  const fetchTrash = useCallback(async () => {
    const res = await fetch("/api/trash");
    if (res.ok) {
      const data = await res.json();
      setTrashItems(data.items || data.files || []);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchItems(currentFolderId),
        fetchFolders(),
        fetchTrash(),
      ]);
    } catch {
      showToast("error", "Server not ready. Wait a moment and refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, fetchItems, fetchFolders, fetchTrash]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const uploadFiles = async (
    fileList: FileList | File[],
    folderId: string,
    withRelativePath = false
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

    try {
      for (const file of allowedFiles) {
        let finalFolderId = folderId && folderId !== "root" ? folderId : undefined;
        let finalRelativePath = withRelativePath
          ? (file as File & { webkitRelativePath?: string }).webkitRelativePath
          : undefined;

        if (withRelativePath && finalRelativePath) {
          const parts = finalRelativePath.replace(/\\/g, "/").split("/");
          const filename = parts.pop() || "";
          const dirParts = parts;

          for (let i = dirParts.length; i > 0; i--) {
            const prefixPath = dirParts.slice(0, i).join("/");
            if (resolvedMap.has(prefixPath)) {
              finalFolderId = resolvedMap.get(prefixPath)!;
              finalRelativePath = [...dirParts.slice(i), filename].join("/");
              break;
            }
          }
        }

        let currentFileUploadedBytes = 0;
        const uploadSuccess = await new Promise<{ success: boolean; file?: DriveFile; error?: string }>((resolve) => {
          const xhr = new XMLHttpRequest();
          const formData = new FormData();
          formData.append("file", file);
          if (finalFolderId) {
            formData.append("folderId", finalFolderId);
          }
          if (finalRelativePath) {
            formData.append("relativePath", finalRelativePath);
          }

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

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const resData = JSON.parse(xhr.responseText);
                resolve({ success: true, file: resData.file });
              } catch {
                resolve({ success: true });
              }
            } else {
              try {
                const resData = JSON.parse(xhr.responseText);
                resolve({ success: false, error: resData.error });
              } catch {
                resolve({
                  success: false,
                  error: `Server error (${xhr.status}: ${xhr.statusText || "Upload failed"})`,
                });
              }
            }
          };

          xhr.onerror = () => {
            resolve({ success: false });
          };

          xhr.open("POST", "/api/files");
          xhr.send(formData);
        });

        const remaining = file.size - currentFileUploadedBytes;
        if (remaining > 0) {
          completedBytes += remaining;
        }

        if (uploadSuccess.success) {
          successCount++;
          const uploadedFile = uploadSuccess.file;

          const originalRelativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
          if (withRelativePath && originalRelativePath && uploadedFile?.parentId) {
            const parts = originalRelativePath.replace(/\\/g, "/").split("/");
            parts.pop();
            if (parts.length > 0) {
              const originalDir = parts.join("/");
              resolvedMap.set(originalDir, uploadedFile.parentId);
            }
          }
        } else {
          showToast("error", uploadSuccess.error || `Failed to upload ${file.name}`);
        }

        const percent = Math.min(
          100,
          Math.round((completedBytes / (totalBytes || 1)) * 100)
        );
        setUploadProgress(percent);
      }

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
    } finally {
      setUploading(null);
      setUploadProgress(0);
    }
  };

  const handleUpload = (files: FileList | File[], folderId: string) =>
    uploadFiles(files, folderId, false);

  const handleUploadFolder = (files: FileList | File[], folderId: string) =>
    uploadFiles(files, folderId, true);

  const handleCreateFolder = async (name: string, parentId?: string) => {
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
            headers: { "Content-Type": "application/json" },
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
    link.href = `/api/files/${file.id}`;
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
        link.href = `/api/files/${file.id}`;
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
          const res = await fetch(`/api/files/${item.id}`, { method: "DELETE" });
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
          const res = await fetch(`/api/files/${item.id}/restore`, { method: "POST" });
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
      const res = await fetch(`/api/files/${item.id}`, { method: "DELETE" });
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
      const res = await fetch(`/api/files/${item.id}/restore`, { method: "POST" });
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

  const handleOpenFolder = (folder: DriveFolder) => {
    setCurrentFolderId(folder.id);
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setActiveTab("files");
    setSelectedIds(new Set());
  };

  const handleNavigate = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSelectedIds(new Set());
    if (!folderId) {
      setBreadcrumb([]);
    } else {
      const idx = breadcrumb.findIndex((b) => b.id === folderId);
      setBreadcrumb(idx >= 0 ? breadcrumb.slice(0, idx + 1) : breadcrumb);
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
        <Header />

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
            onPreview={setPreviewFile}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onOpenFolder={handleOpenFolder}
            onCopy={handleCopy}
            onCut={handleCut}
            onHoverItem={setHoveredItem}
            selectedIds={selectedIds}
            onSelectToggle={handleSelectToggle}
            emptyMessage={
              currentFolderId
                ? "This folder is empty."
                : "No files yet. Upload your first file or create a folder!"
            }
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
            onHoverItem={setHoveredItem}
            selectedIds={selectedIds}
            onSelectToggle={handleSelectToggle}
            emptyMessage="No folders yet. Create your first folder above!"
          />
        ) : (
          <FileGrid
            items={trashItems}
            loading={loading}
            onPreview={setPreviewFile}
            onDownload={handleDownload}
            onDelete={handleDelete}
            onRestore={handleRestore}
            isTrash
            selectedIds={selectedIds}
            onSelectToggle={handleSelectToggle}
            emptyMessage="Trash is empty. Deleted files appear here for 30 days."
          />
        )}

        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownload}
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
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass rounded-xl border border-indigo-500/30 px-6 py-4 flex items-center gap-6 shadow-2xl min-w-[320px] max-w-lg"
            >
              <div className="flex items-center gap-3">
                <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-1 rounded-full font-bold">
                  {selectedItems.length} Selected
                </span>
                <button
                  onClick={handleSelectAll}
                  className="text-xs bg-white/10 hover:bg-white/20 text-white/95 px-2.5 py-1 rounded-lg transition-all border border-white/10 font-semibold"
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
              
              <div className="h-6 w-px bg-white/10" />

              <div className="flex items-center gap-3">
                {activeTab === "trash" ? (
                  <>
                    <button
                      onClick={() => handleMultiRestore(selectedItems)}
                      className="p-2 rounded-lg hover:bg-green-500/20 text-green-400 hover:text-green-300 transition-all flex flex-col items-center gap-0.5"
                      title="Restore selected items"
                    >
                      <RotateCcw className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Restore</span>
                    </button>

                    <button
                      onClick={() => handleMultiDelete(selectedItems)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all flex flex-col items-center gap-0.5"
                      title="Delete permanently"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Delete Forever</span>
                    </button>
                  </>
                ) : (
                  <>
                    {selectedItems.some(i => !isDriveFolder(i)) && (
                      <button
                        onClick={() => handleMultiDownload(selectedItems)}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-all flex flex-col items-center gap-0.5"
                        title="Download selected files"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span className="text-[10px] font-medium">Download</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleMultiCopy(selectedItems)}
                      className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-all flex flex-col items-center gap-0.5"
                      title="Copy selected items"
                    >
                      <Copy className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Copy</span>
                    </button>

                    <button
                      onClick={() => handleMultiCut(selectedItems)}
                      className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-all flex flex-col items-center gap-0.5"
                      title="Cut selected items"
                    >
                      <Scissors className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Cut</span>
                    </button>

                    <button
                      onClick={() => handleMultiDelete(selectedItems)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all flex flex-col items-center gap-0.5"
                      title="Delete selected items"
                    >
                      <Trash2 className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Delete</span>
                    </button>
                  </>
                )}
              </div>

              <div className="h-6 w-px bg-white/10" />

              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-white/40 hover:text-white font-medium whitespace-nowrap"
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
            className="fixed bottom-6 left-6 z-40 glass rounded-xl border border-indigo-500/30 px-5 py-4 flex flex-col sm:flex-row items-center gap-4 shadow-2xl min-w-[280px]"
          >
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-indigo-300">
                {clipboard.type === "cut" ? <Scissors className="w-5 h-5 animate-pulse" /> : <Copy className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold">
                  Clipboard ({clipboard.type})
                </p>
                <p className="text-white font-medium text-sm truncate max-w-[180px]" title={clipboard.items.map(i => i.name).join(", ")}>
                  {clipboard.items.length === 1 ? clipboard.items[0].name : `${clipboard.items.length} items`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
              <button
                onClick={handlePaste}
                className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
              >
                Paste Here
              </button>
              <button
                onClick={() => setClipboard(null)}
                className="btn-ghost py-1.5 px-2 text-xs text-white/50 hover:text-white"
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
