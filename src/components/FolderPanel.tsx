"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FolderPlus, FolderUp, Loader2, X } from "lucide-react";
import { DriveFolder } from "@/lib/file-types";
import { FolderSelector } from "./FolderSelector";
import { CustomDropdown } from "./CustomDropdown";

interface FolderPanelProps {
  folders: DriveFolder[];
  uploading: boolean;
  onCreateFolder: (name: string, parentId?: string, driveEmail?: string) => Promise<void>;
  onUploadFolder: (files: FileList | File[], folderId: string, driveEmail?: string) => Promise<void>;
  onRefresh: () => void;
  accounts?: Array<{ email: string; name?: string; connectedAt: string }>;
  activeDriveEmail?: string;
}

export function FolderPanel({
  folders,
  uploading,
  onCreateFolder,
  onUploadFolder,
  accounts = [],
  activeDriveEmail = "all",
}: FolderPanelProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploadTarget, setUploadTarget] = useState("root");
  const [createParentId, setCreateParentId] = useState("root");

  // Local target drive states for folder uploading & creation
  const [uploadDrive, setUploadDrive] = useState<string>("auto");
  const [createDrive, setCreateDrive] = useState<string>("auto");

  useEffect(() => {
    if (activeDriveEmail && activeDriveEmail !== "all") {
      setUploadDrive(activeDriveEmail);
      setCreateDrive(activeDriveEmail);
    } else {
      setUploadDrive("auto");
      setCreateDrive("auto");
    }
  }, [activeDriveEmail]);

  // Filter folders according to target drives (if "auto", show all folders)
  const availableUploadFolders = uploadDrive === "auto"
    ? folders
    : folders.filter((f) => f.driveEmail === uploadDrive);

  const availableCreateFolders = createDrive === "auto"
    ? folders
    : folders.filter((f) => f.driveEmail === createDrive);

  // If selected folder is not in filtered folders, reset to root
  useEffect(() => {
    if (uploadTarget !== "root" && !availableUploadFolders.some((f) => f.id === uploadTarget)) {
      setUploadTarget("root");
    }
  }, [uploadDrive, availableUploadFolders, uploadTarget]);

  useEffect(() => {
    if (createParentId !== "root" && !availableCreateFolders.some((f) => f.id === createParentId)) {
      setCreateParentId("root");
    }
  }, [createDrive, availableCreateFolders, createParentId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setCreating(true);
    try {
      const targetParent = createParentId === "root" ? undefined : createParentId;
      const targetEmail = createParentId !== "root"
        ? folders.find(f => f.id === createParentId)?.driveEmail
        : (createDrive === "auto" ? undefined : createDrive);
      await onCreateFolder(folderName.trim(), targetParent, targetEmail);
      setFolderName("");
      setShowCreate(false);
      setCreateParentId("root");
    } finally {
      setCreating(false);
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const folderEmail = uploadTarget !== "root"
        ? folders.find(f => f.id === uploadTarget)?.driveEmail
        : (uploadDrive === "auto" ? undefined : uploadDrive);
      await onUploadFolder(e.target.files, uploadTarget, folderEmail);
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

      <div className="flex flex-col md:flex-row items-end gap-4 w-full">
        <div className="flex-1 w-full">
          <FolderSelector
            folders={availableUploadFolders}
            value={uploadTarget}
            onChange={setUploadTarget}
            label="Upload folder to:"
          />
        </div>
        <div className="w-full md:w-64">
          <label className="block text-slate-600 dark:text-slate-400 text-sm mb-2 font-bold">
            Upload Target Drive:
          </label>
          <CustomDropdown
            options={[
              ...(activeDriveEmail === "all" ? [{ value: "auto", label: "Auto (Most Free Space)", icon: "⚡" }] : []),
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

      <p className="text-slate-400 dark:text-slate-500 text-xs font-semibold mt-2">
        Uploading a folder preserves all subfolders and files inside it.
      </p>

      {showCreate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-6 pt-6 border-t border-slate-200/40 dark:border-white/10 space-y-4"
        >
          <div className="flex flex-col md:flex-row items-end gap-4 w-full">
            <div className="flex-1 w-full">
              <FolderSelector
                folders={availableCreateFolders}
                value={createParentId}
                onChange={setCreateParentId}
                label="Create folder in:"
              />
            </div>
            <div className="w-full md:w-64">
              <label className="block text-slate-600 dark:text-slate-400 text-sm mb-2 font-bold">
                Create Target Drive:
              </label>
              <CustomDropdown
                options={[
                  ...(activeDriveEmail === "all" ? [{ value: "auto", label: "Auto (Most Free Space)", icon: "⚡" }] : []),
                  ...(accounts || []).map((acc) => ({
                    value: acc.email,
                    label: acc.name || acc.email,
                    icon: "📧",
                  })),
                ]}
                value={createDrive}
                onChange={setCreateDrive}
              />
            </div>
          </div>
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
