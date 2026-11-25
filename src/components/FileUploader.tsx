"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileUp, FolderUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DriveFolder } from "@/lib/file-types";
import { FolderSelector } from "./FolderSelector";
import { CustomDropdown } from "./CustomDropdown";

interface FileUploaderProps {
  folders: DriveFolder[];
  onUpload: (files: FileList | File[], folderId: string, driveEmail?: string, slotId?: string) => Promise<void>;
  onUploadFolder: (files: FileList | File[], folderId: string, driveEmail?: string, slotId?: string) => Promise<void>;
  uploadSlots: Record<string, number>;
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
          enumerable: true,
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

interface UploadCardConfig {
  slotId: string;
  mode: "files" | "folder";
  badge: string;
  title: string;
  subtitle: string;
}

const UPLOAD_CARDS: UploadCardConfig[] = [
  {
    slotId: "files-1",
    mode: "files",
    badge: "File 1",
    title: "Drop files here",
    subtitle: "Click or drag files (Slot 1)",
  },
  {
    slotId: "files-2",
    mode: "files",
    badge: "File 2",
    title: "Drop files here",
    subtitle: "Click or drag files (Slot 2)",
  },
  {
    slotId: "folder-1",
    mode: "folder",
    badge: "Folder 1",
    title: "Drop folder here",
    subtitle: "Recursive upload (Slot 1)",
  },
  {
    slotId: "folder-2",
    mode: "folder",
    badge: "Folder 2",
    title: "Drop folder here",
    subtitle: "Recursive upload (Slot 2)",
  },
];

export function FileUploader({
  folders,
  onUpload,
  onUploadFolder,
  uploadSlots,
  defaultFolderId,
  accounts = [],
  activeDriveEmail = "all",
}: FileUploaderProps) {
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState("root");
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

  const availableFolders =
    uploadDrive === "auto"
      ? folders
      : folders.filter((f) => f.driveEmail === uploadDrive);

  useEffect(() => {
    if (selectedFolder !== "root" && !availableFolders.some((f) => f.id === selectedFolder)) {
      setSelectedFolder("root");
    }
  }, [uploadDrive, availableFolders, selectedFolder]);

  const resolveTargetDriveEmail = useCallback(() => {
    if (selectedFolder !== "root") {
      return folders.find((f) => f.id === selectedFolder)?.driveEmail;
    }
    return uploadDrive === "auto" ? undefined : uploadDrive;
  }, [selectedFolder, folders, uploadDrive]);

  const handleDropForSlot = useCallback(
    async (e: React.DragEvent, card: UploadCardConfig) => {
      e.preventDefault();
      setDragOverSlot(null);
      const folderEmail = resolveTargetDriveEmail();

      if (card.mode === "files") {
        if (e.dataTransfer.files.length > 0) {
          await onUpload(e.dataTransfer.files, selectedFolder, folderEmail, card.slotId);
        }
      } else {
        const items = Array.from(e.dataTransfer.items);
        const entries = items
          .map((item) => item.webkitGetAsEntry())
          .filter((entry): entry is FileSystemEntry => !!entry);

        if (entries.length > 0) {
          const filesPromises = entries.map((entry) => getFilesFromEntry(entry));
          const filesArrays = await Promise.all(filesPromises);
          const files = filesArrays.flat();
          if (files.length > 0) {
            await onUploadFolder(files, selectedFolder, folderEmail, card.slotId);
          }
        }
      }
    },
    [onUpload, onUploadFolder, selectedFolder, resolveTargetDriveEmail]
  );

  const handleChangeForSlot = async (
    e: React.ChangeEvent<HTMLInputElement>,
    card: UploadCardConfig
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      e.target.value = "";
      const folderEmail = resolveTargetDriveEmail();
      if (card.mode === "files") {
        await onUpload(files, selectedFolder, folderEmail, card.slotId);
      } else {
        await onUploadFolder(files, selectedFolder, folderEmail, card.slotId);
      }
    }
  };

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
            folders={availableFolders}
            value={selectedFolder}
            onChange={setSelectedFolder}
            label="Upload to destination:"
          />
        </div>
        <div className="w-full md:w-64">
          <label className="block text-slate-600 dark:text-slate-400 text-sm mb-2 font-bold">
            Upload Target Drive:
          </label>
          <CustomDropdown
            options={[
              ...(activeDriveEmail === "all"
                ? [{ value: "auto", label: "Auto (Most Free Space)", icon: "⚡" }]
                : []),
              ...(accounts || []).map((acc) => ({
                value: acc.email,
                label: acc.name || acc.email,
                icon: "📧",
              })),
            ]}
            value={uploadDrive}
            onChange={setUploadDrive}
          />
        </div>
      </div>

      {/* 2 File Upload Cards + 2 Folder Upload Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {UPLOAD_CARDS.map((card, idx) => {
          const slotProgress = uploadSlots[card.slotId];
          const isUploadingSlot = slotProgress !== undefined;
          const isDragOver = dragOverSlot === card.slotId;
          const isFiles = card.mode === "files";

          return (
            <label
              key={card.slotId}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverSlot(card.slotId);
              }}
              onDragLeave={() => setDragOverSlot(null)}
              onDrop={(e) => handleDropForSlot(e, card)}
              className={cn(
                "block p-5 cursor-pointer text-center transition-all duration-300 relative overflow-hidden rounded-2xl border",
                isDragOver
                  ? isFiles
                    ? "glass-neo-in border-indigo-500/50 scale-[1.01]"
                    : "glass-neo-in border-purple-500/50 scale-[1.01]"
                  : "glass-neo-out hover:shadow-neumorph-out hover:-translate-y-1.5 hover:shadow-xl border-slate-200/40 dark:border-white/5",
                isUploadingSlot && "pointer-events-none opacity-85"
              )}
            >
              <span
                className={cn(
                  "absolute top-2.5 right-2.5 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                  isFiles
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/20"
                    : "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20"
                )}
              >
                {card.badge}
              </span>

              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleChangeForSlot(e, card)}
                disabled={isUploadingSlot}
                {...(!isFiles
                  ? ({
                      webkitdirectory: "",
                      directory: "",
                    } as React.InputHTMLAttributes<HTMLInputElement>)
                  : {})}
              />

              <AnimatePresence mode="wait">
                {isUploadingSlot ? (
                  <motion.div
                    key={`uploading-${card.slotId}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2.5 py-4"
                  >
                    <Loader2
                      className={cn(
                        "w-10 h-10 animate-spin",
                        isFiles
                          ? "text-indigo-500 dark:text-indigo-400"
                          : "text-purple-500 dark:text-purple-400"
                      )}
                    />
                    <div className="flex flex-col items-center gap-1.5 w-full">
                      <p className="text-slate-800 dark:text-slate-200 font-semibold text-sm">
                        {slotProgress === 100
                          ? "Finishing..."
                          : `Uploading... (${slotProgress}%)`}
                      </p>
                      <div className="w-full max-w-[160px] h-2 bg-slate-200/60 dark:bg-black/30 rounded-full overflow-hidden border border-slate-300/30 dark:border-white/5 shadow-inner">
                        <motion.div
                          className={cn(
                            "h-full bg-gradient-to-r",
                            isFiles
                              ? "from-indigo-500 to-purple-500"
                              : "from-purple-500 to-pink-500"
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${slotProgress}%` }}
                          transition={{ duration: 0.1 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`idle-${card.slotId}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-2.5 pt-1"
                  >
                    <motion.div
                      animate={{ y: [0, -5, 0] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: idx * 0.15,
                      }}
                      className={cn(
                        "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center border shadow-sm",
                        isFiles
                          ? "from-indigo-500/10 to-purple-500/10 border-indigo-500/20"
                          : "from-purple-500/10 to-pink-500/10 border-purple-500/20"
                      )}
                    >
                      {isFiles ? (
                        <FileUp className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
                      ) : (
                        <FolderUp className="w-6 h-6 text-purple-600 dark:text-purple-300" />
                      )}
                    </motion.div>
                    <div>
                      <p className="text-slate-800 dark:text-slate-200 font-bold text-sm sm:text-base">
                        {card.title}
                      </p>
                      <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5 font-medium">
                        {card.subtitle}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 justify-center">
                      <Upload className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                        {selectedFolder === "root"
                          ? "To Root"
                          : "To Selected Folder"}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </label>
          );
        })}
      </div>
    </motion.div>
  );
}
