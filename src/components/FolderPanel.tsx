"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FolderPlus, FolderUp, Loader2, X } from "lucide-react";
import { DriveFolder } from "@/lib/file-types";
import { FolderSelector } from "./FolderSelector";

interface FolderPanelProps {
  folders: DriveFolder[];
  uploading: boolean;
  onCreateFolder: (name: string, parentId?: string) => Promise<void>;
  onUploadFolder: (files: FileList, folderId: string) => Promise<void>;
  onRefresh: () => void;
}

export function FolderPanel({
  folders,
  uploading,
  onCreateFolder,
  onUploadFolder,
}: FolderPanelProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploadTarget, setUploadTarget] = useState("root");
  const [createParentId, setCreateParentId] = useState("root");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setCreating(true);
    try {
      await onCreateFolder(folderName.trim(), createParentId === "root" ? undefined : createParentId);
      setFolderName("");
      setShowCreate(false);
      setCreateParentId("root");
    } finally {
      setCreating(false);
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await onUploadFolder(e.target.files, uploadTarget);
      e.target.value = "";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-neo-out p-6 mb-8 relative z-30 border border-slate-200/40 dark:border-white/5 rounded-2xl"
    >
      <h2 className="text-slate-800 dark:text-white font-bold text-lg mb-4">Folder Management</h2>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center justify-center gap-2 flex-1 py-3 rounded-xl shadow-neumorph-btn hover:shadow-neumorph-out font-bold text-white transition-all"
        >
          <FolderPlus className="w-5 h-5" />
          Create Folder
        </button>

        <label className="glass-neo-btn flex items-center justify-center gap-2 flex-1 cursor-pointer border border-slate-200/50 dark:border-white/10 text-slate-700 dark:text-slate-200 py-3 rounded-xl hover:shadow-neumorph-out transition-all font-bold">
          <input
            type="file"
            multiple
            className="hidden"
            onChange={handleFolderUpload}
            disabled={uploading}
            {...({ webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
          />
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <FolderUp className="w-5 h-5" />
          )}
          Upload Folder
        </label>
      </div>

      <FolderSelector
        folders={folders}
        value={uploadTarget}
        onChange={setUploadTarget}
        label="Upload folder to:"
      />

      <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold mt-2">
        Uploading a folder preserves all subfolders and files inside it.
      </p>

      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-6 pt-6 border-t border-slate-200/40 dark:border-white/10 space-y-4"
        >
          <FolderSelector
            folders={folders}
            value={createParentId}
            onChange={setCreateParentId}
            label="Create folder in:"
          />
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Enter folder name..."
              className="glass-neo-input flex-1 px-4 py-2.5 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl outline-none border border-slate-200/50 dark:border-white/10 shadow-inner font-semibold"
              autoFocus
            />
            <button
              type="submit"
              disabled={creating || !folderName.trim()}
              className="btn-primary px-6 rounded-xl shadow-neumorph-btn hover:shadow-neumorph-out font-bold text-white transition-all disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setCreateParentId("root");
              }}
              className="glass-neo-btn px-4 border border-slate-200/50 dark:border-white/10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      )}
    </motion.div>
  );
}
