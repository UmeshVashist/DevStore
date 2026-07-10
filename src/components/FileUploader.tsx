"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileUp, FolderUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DriveFolder } from "@/lib/file-types";
import { FolderSelector } from "./FolderSelector";

interface FileUploaderProps {
  folders: DriveFolder[];
  onUpload: (files: FileList | File[], folderId: string, driveEmail?: string) => Promise<void>;
  onUploadFolder: (files: FileList | File[], folderId: string, driveEmail?: string) => Promise<void>;
  uploadingType: "files" | "folder" | null;
  uploadProgress: number;
  defaultFolderId?: string | null;
  accounts?: Array<{ email: string; name?: string; connectedAt: string }>;
  activeDriveEmail?: string;
}

// Helper to recursively read all entries of a directory reader
async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const allEntries: FileSystemEntry[] = [];
  const readBatch = (): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
      reader.readEntries((results) => {
        if (results.length === 0) {
          resolve(allEntries);
        } else {
          allEntries.push(...results);
          readBatch().then(resolve, reject);
        }
      }, reject);
    });
  };
  return readBatch();
}

// Recursive helper to traverse directories and build list of files with webkitRelativePath
async function getFilesFromEntry(entry: FileSystemEntry, path = ""): Promise<File[]> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    return new Promise((resolve, reject) => {
      fileEntry.file((file: File) => {
        const relativePath = path ? `${path}/${file.name}` : file.name;
        Object.defineProperty(file, "webkitRelativePath", {
          value: relativePath,
          writable: true,
          configurable: true,
          enumerable: true
        });
        resolve([file]);
      }, reject);
    });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    try {
      const entries = await readAllEntries(reader);
      const files: File[] = [];
      const currentPath = path ? `${path}/${entry.name}` : entry.name;
      for (const childEntry of entries) {
        const childFiles = await getFilesFromEntry(childEntry, currentPath);
        files.push(...childFiles);
      }
      return files;
    } catch (err) {
      console.error("Error reading directory entries:", err);
      return [];
    }
  }
  return [];
}

export function FileUploader({
  folders,
  onUpload,
  onUploadFolder,
  uploadingType,
  uploadProgress,
  defaultFolderId,
  accounts = [],
  activeDriveEmail = "all",
}: FileUploaderProps) {
  const [dragOverFiles, setDragOverFiles] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("root");

  // Local target drive state for root uploads
  const [uploadDrive, setUploadDrive] = useState<string>("auto");

  useEffect(() => {
    setSelectedFolder(defaultFolderId || "root");
  }, [defaultFolderId]);

  useEffect(() => {
    if (activeDriveEmail && activeDriveEmail !== "all") {
      setUploadDrive(activeDriveEmail);
    } else {
      setUploadDrive("auto");
    }
  }, [activeDriveEmail]);

  const handleDropFiles = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverFiles(false);
      if (e.dataTransfer.files.length > 0) {
        const folderEmail = selectedFolder !== "root" 
          ? folders.find(f => f.id === selectedFolder)?.driveEmail 
          : (uploadDrive === "auto" ? undefined : uploadDrive);
        await onUpload(e.dataTransfer.files, selectedFolder, folderEmail);
      }
    },
    [onUpload, selectedFolder, folders, uploadDrive]
  );

  const handleDropFolder = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverFolder(false);
      const items = Array.from(e.dataTransfer.items);
      const entries = items
        .map((item) => item.webkitGetAsEntry())
        .filter((entry): entry is FileSystemEntry => !!entry);

      if (entries.length > 0) {
        const filesPromises = entries.map((entry) => getFilesFromEntry(entry));
        const filesArrays = await Promise.all(filesPromises);
        const files = filesArrays.flat();
        if (files.length > 0) {
          const folderEmail = selectedFolder !== "root" 
            ? folders.find(f => f.id === selectedFolder)?.driveEmail 
            : (uploadDrive === "auto" ? undefined : uploadDrive);
          await onUploadFolder(files, selectedFolder, folderEmail);
        }
      }
    },
    [onUploadFolder, selectedFolder, folders, uploadDrive]
  );

  const handleChangeFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const folderEmail = selectedFolder !== "root" 
        ? folders.find(f => f.id === selectedFolder)?.driveEmail 
        : (uploadDrive === "auto" ? undefined : uploadDrive);
      await onUpload(e.target.files, selectedFolder, folderEmail);
      e.target.value = "";
    }
  };

  const handleChangeFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const folderEmail = selectedFolder !== "root" 
        ? folders.find(f => f.id === selectedFolder)?.driveEmail 
        : (uploadDrive === "auto" ? undefined : uploadDrive);
      await onUploadFolder(e.target.files, selectedFolder, folderEmail);
      e.target.value = "";
    }
  };

  const isUploadingAny = uploadingType !== null;
  const isUploadingFiles = uploadingType === "files";
  const isUploadingFolder = uploadingType === "folder";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-8 relative z-20"
    >
      <div className="flex flex-col md:flex-row items-end gap-4 w-full">
        <div className="flex-1 w-full">
          <FolderSelector
            folders={folders}
            value={selectedFolder}
            onChange={setSelectedFolder}
            label="Upload to destination:"
          />
        </div>
        <div className="w-full md:w-64">
          <label className="block text-white/70 text-sm mb-2 font-medium">
            Upload Target Drive:
          </label>
          {selectedFolder !== "root" ? (
            <div className="glass-input w-full px-4 py-2.5 text-indigo-300 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold truncate flex items-center gap-1.5 cursor-not-allowed">
              <span>☁️</span>
              <span className="truncate">
                {(() => {
                  const targetFolder = folders.find(f => f.id === selectedFolder);
                  const folderEmail = targetFolder?.driveEmail;
                  const driveAcc = accounts?.find(a => a.email === folderEmail);
                  return driveAcc?.name || folderEmail || "Unknown Drive";
                })()}
              </span>
              <span className="text-[10px] text-white/40 font-normal shrink-0">(Fixed by folder)</span>
            </div>
          ) : (
            <select
              value={uploadDrive}
              onChange={(e) => setUploadDrive(e.target.value)}
              className="glass-input w-full px-4 py-2.5 text-white bg-[#15132b] border border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all hover:bg-white/5 outline-none"
            >
              {activeDriveEmail === "all" && (
                <option value="auto" className="bg-[#15132b] text-white font-medium">
                  ⚡ Auto (Most Free Space)
                </option>
              )}
              {accounts?.map((acc) => (
                <option key={acc.email} value={acc.email} className="bg-[#15132b] text-white">
                  📧 {acc.name || acc.email}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* Upload Files Box */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverFiles(true);
          }}
          onDragLeave={() => setDragOverFiles(false)}
          onDrop={handleDropFiles}
          className={cn(
            "glass-card block p-8 cursor-pointer text-center transition-all duration-300 relative overflow-hidden",
            dragOverFiles && "ring-2 ring-indigo-400 scale-[1.02]",
            isUploadingAny && "pointer-events-none opacity-70"
          )}
        >
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleChangeFiles}
            disabled={isUploadingAny}
          />

          <AnimatePresence mode="wait">
            {isUploadingFiles ? (
              <motion.div
                key="uploading-files"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 py-6"
              >
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-white/80 font-medium">
                    {uploadProgress === 100 ? "Finishing..." : `Uploading Files... (${uploadProgress}%)`}
                  </p>
                  <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                    <motion.div
                      className="h-full bg-gradient-to-r from-indigo-400 to-purple-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle-files"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center border border-white/20"
                >
                  <FileUp className="w-8 h-8 text-indigo-300" />
                </motion.div>
                <div>
                  <p className="text-white font-semibold text-lg">
                    Drop files here or click to upload
                  </p>
                  <p className="text-white/50 text-sm mt-1">
                    Select multiple files to upload
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-2 justify-center">
                  <Upload className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">
                    {selectedFolder === "root"
                      ? "Uploading to root (Without Folder)"
                      : `Uploading to selected folder`}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </label>

        {/* Upload Folder Box */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverFolder(true);
          }}
          onDragLeave={() => setDragOverFolder(false)}
          onDrop={handleDropFolder}
          className={cn(
            "glass-card block p-8 cursor-pointer text-center transition-all duration-300 relative overflow-hidden",
            dragOverFolder && "ring-2 ring-purple-400 scale-[1.02]",
            isUploadingAny && "pointer-events-none opacity-70"
          )}
        >
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleChangeFolder}
            disabled={isUploadingAny}
            {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          />

          <AnimatePresence mode="wait">
            {isUploadingFolder ? (
              <motion.div
                key="uploading-folder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 py-6"
              >
                <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-white/80 font-medium">
                    {uploadProgress === 100 ? "Finishing..." : `Uploading Folder... (${uploadProgress}%)`}
                  </p>
                  <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-400 to-pink-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.1 }}
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle-folder"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3"
              >
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 flex items-center justify-center border border-white/20"
                >
                  <FolderUp className="w-8 h-8 text-purple-300" />
                </motion.div>
                <div>
                  <p className="text-white font-semibold text-lg">
                    Drop folder here or click to upload
                  </p>
                  <p className="text-white/50 text-sm mt-1">
                    Recursive upload (keeps directory structure)
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-2 justify-center">
                  <Upload className="w-4 h-4 text-white/40" />
                  <span className="text-xs text-white/40">
                    {selectedFolder === "root"
                      ? "Uploading to root (Without Folder)"
                      : `Uploading to selected folder`}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </label>
      </div>
    </motion.div>
  );
}
