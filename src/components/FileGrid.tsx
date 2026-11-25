"use client";

import { motion } from "framer-motion";
import { FolderOpen, Trash2, Search, FolderSearch, Loader2, X } from "lucide-react";
import { DriveFile, DriveFolder, DriveItem, isDriveFolder } from "@/lib/file-types";
import { FileCard } from "./FileCard";
import { FolderCard } from "./FolderCard";
import { useState } from "react";
import { useRecentActivity } from "@/lib/recent-activity";

interface FileGridProps {
  items: DriveItem[];
  allFolders?: DriveFolder[];
  globalSearchFiles?: DriveFile[] | null;
  searchingFiles?: boolean;
  fileSearch?: string;
  onFileSearchChange?: (value: string) => void;
  folderSearch?: string;
  onFolderSearchChange?: (value: string) => void;
  loading: boolean;
  onPreview: (file: DriveFile) => void;
  onDownload: (item: DriveItem) => void;
  onDelete: (item: DriveItem) => void;
  onRestore?: (item: DriveItem) => void;
  onOpenFolder?: (folder: DriveFolder) => void;
  onCopy?: (item: DriveItem) => void;
  onCut?: (item: DriveItem) => void;
  onRename?: (item: DriveItem) => void;
  onMoveCrossDrive?: (item: DriveItem) => void;
  onHoverItem?: (item: DriveItem | null) => void;
  isTrash?: boolean;
  emptyMessage?: string;
  selectedIds?: Set<string>;
  onSelectToggle?: (item: DriveItem) => void;
  accounts?: Array<{ email: string; name?: string; connectedAt: string }>;
  showDriveBadge?: boolean;
}

export function FileGrid({
  items,
  allFolders,
  globalSearchFiles = null,
  searchingFiles = false,
  fileSearch: controlledFileSearch,
  onFileSearchChange,
  folderSearch: controlledFolderSearch,
  onFolderSearchChange,
  loading,
  onPreview,
  onDownload,
  onDelete,
  onRestore,
  onOpenFolder,
  onCopy,
  onCut,
  onRename,
  onMoveCrossDrive,
  onHoverItem,
  isTrash = false,
  emptyMessage = "No files yet. Upload your first file!",
  selectedIds,
  onSelectToggle,
  accounts = [],
  showDriveBadge = false,
}: FileGridProps) {
  const [localFileSearch, setLocalFileSearch] = useState("");
  const [localFolderSearch, setLocalFolderSearch] = useState("");
  const recentMap = useRecentActivity();

  const fileSearch = controlledFileSearch !== undefined ? controlledFileSearch : localFileSearch;
  const setFileSearch = onFileSearchChange || setLocalFileSearch;
  const folderSearch = controlledFolderSearch !== undefined ? controlledFolderSearch : localFolderSearch;
  const setFolderSearch = onFolderSearchChange || setLocalFolderSearch;

  const fileQuery = fileSearch.trim().toLowerCase();
  const folderQuery = folderSearch.trim().toLowerCase();

  let filtered: DriveItem[];
  if (!fileQuery && !folderQuery) {
    filtered = items;
  } else if (isTrash) {
    filtered = items.filter((item) => {
      const isFolder = isDriveFolder(item);
      if (fileQuery && !folderQuery) {
        return !isFolder && item.name.toLowerCase().includes(fileQuery);
      }
      if (!fileQuery && folderQuery) {
        return isFolder && item.name.toLowerCase().includes(folderQuery);
      }
      return isFolder
        ? item.name.toLowerCase().includes(folderQuery)
        : item.name.toLowerCase().includes(fileQuery);
    });
  } else {
    // Global search across all nested folders and files
    const matchedFiles: DriveItem[] = fileQuery
      ? (globalSearchFiles !== null
          ? globalSearchFiles
          : items.filter((i) => !isDriveFolder(i))
        ).filter((f) => f.name.toLowerCase().includes(fileQuery))
      : [];

    const folderSource: DriveFolder[] = allFolders ?? items.filter(isDriveFolder);
    const matchedFolders: DriveItem[] = folderQuery
      ? folderSource.filter((f) => f.name.toLowerCase().includes(folderQuery))
      : [];

    filtered = [...matchedFolders, ...matchedFiles];
  }

  const anySelected = (selectedIds?.size || 0) > 0;
  const hasAnySearch = Boolean(fileQuery || folderQuery);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
        <p className="text-slate-600 dark:text-white/60 font-semibold">Loading from Google Drive...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Dual Search Bars: 1 for Files/Data (global), 1 for Folders (global) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 dark:text-indigo-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search files / data (all folders)..."
            value={fileSearch}
            onChange={(e) => setFileSearch(e.target.value)}
            className="glass-neo-input w-full pl-11 pr-9 py-2.5 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none border border-slate-200/50 dark:border-white/10 shadow-inner font-semibold"
          />
          {searchingFiles ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
          ) : (
            fileSearch && (
              <button
                type="button"
                onClick={() => setFileSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                title="Clear file search"
              >
                <X className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        <div className="relative">
          <FolderSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 dark:text-purple-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search folders (all levels)..."
            value={folderSearch}
            onChange={(e) => setFolderSearch(e.target.value)}
            className="glass-neo-input w-full pl-11 pr-9 py-2.5 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none border border-slate-200/50 dark:border-white/10 shadow-inner font-semibold"
          />
          {folderSearch && (
            <button
              type="button"
              onClick={() => setFolderSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              title="Clear folder search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {searchingFiles && fileQuery && filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-slate-500 dark:text-white/50 font-semibold text-sm">
            Searching files across all folders...
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-12 text-center"
        >
          {isTrash ? (
            <Trash2 className="w-12 h-12 text-slate-400 dark:text-white/30 mx-auto mb-4" />
          ) : (
            <FolderOpen className="w-12 h-12 text-slate-400 dark:text-white/30 mx-auto mb-4" />
          )}
          <p className="text-slate-500 dark:text-white/50 font-semibold">
            {hasAnySearch ? "No matching items found" : emptyMessage}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item, index) =>
            isDriveFolder(item) ? (
              <FolderCard
                key={item.id}
                folder={item}
                onOpen={onOpenFolder || (() => {})}
                onDelete={isTrash ? undefined : () => onDelete(item)}
                onRestore={onRestore ? () => onRestore(item) : undefined}
                onDownload={onDownload}
                onCopy={onCopy ? () => onCopy(item) : undefined}
                onCut={onCut ? () => onCut(item) : undefined}
                onRename={onRename ? () => onRename(item) : undefined}
                onMoveCrossDrive={onMoveCrossDrive ? () => onMoveCrossDrive(item) : undefined}
                onMouseEnter={() => onHoverItem?.(item)}
                onMouseLeave={() => onHoverItem?.(null)}
                isTrash={isTrash}
                index={index}
                selected={selectedIds?.has(item.id)}
                onSelectToggle={onSelectToggle ? () => onSelectToggle(item) : undefined}
                anySelected={anySelected}
                accounts={accounts}
                showDriveBadge={showDriveBadge}
                recentMap={recentMap}
              />
            ) : (
              <FileCard
                key={item.id}
                file={item}
                onPreview={onPreview}
                onDownload={onDownload}
                onDelete={() => onDelete(item)}
                onRestore={onRestore ? () => onRestore(item) : undefined}
                onCopy={onCopy ? () => onCopy(item) : undefined}
                onCut={onCut ? () => onCut(item) : undefined}
                onRename={onRename ? () => onRename(item) : undefined}
                onMoveCrossDrive={onMoveCrossDrive ? () => onMoveCrossDrive(item) : undefined}
                onMouseEnter={() => onHoverItem?.(item)}
                onMouseLeave={() => onHoverItem?.(null)}
                isTrash={isTrash}
                index={index}
                selected={selectedIds?.has(item.id)}
                onSelectToggle={onSelectToggle ? () => onSelectToggle(item) : undefined}
                anySelected={anySelected}
                accounts={accounts}
                showDriveBadge={showDriveBadge}
                recentMap={recentMap}
              />
            )
          )}
        </div>
      )}
    </div>
  );
}
