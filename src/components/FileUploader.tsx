"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DriveFolder } from "@/lib/file-types";
import { FolderSelector } from "./FolderSelector";

interface FileUploaderProps {
  folders: DriveFolder[];
  onUpload: (files: FileList, folderId: string) => Promise<void>;
  uploading: boolean;
  defaultFolderId?: string | null;
}

export function FileUploader({ folders, onUpload, uploading, defaultFolderId }: FileUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState("root");

  useEffect(() => {
    setSelectedFolder(defaultFolderId || "root");
  }, [defaultFolderId]);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        await onUpload(e.dataTransfer.files, selectedFolder);
      }
    },
    [onUpload, selectedFolder]
  );

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onUpload(e.target.files, selectedFolder);
      e.target.value = "";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mb-8 relative z-20"
    >
      <FolderSelector
        folders={folders}
        value={selectedFolder}
        onChange={setSelectedFolder}
        label="Upload file to:"
      />

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "glass-card block p-8 cursor-pointer text-center transition-all duration-300",
          dragOver && "ring-2 ring-indigo-400 scale-[1.02]",
          uploading && "pointer-events-none opacity-70"
        )}
      >
        <input
          type="file"
          multiple
          className="hidden"
          onChange={handleChange}
          disabled={uploading}
        />

        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
              <p className="text-white/80 font-medium">Uploading to Google Drive...</p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center border border-white/20"
              >
                <Upload className="w-8 h-8 text-indigo-300" />
              </motion.div>
              <div>
                <p className="text-white font-semibold text-lg">
                  Drop files here or click to upload
                </p>
                <p className="text-white/50 text-sm mt-1">
                  PDF, Word, Excel, PPT, ZIP, Software & more
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <FileUp className="w-4 h-4 text-white/40" />
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
    </motion.div>
  );
}
