"use client";

import { useState, useRef, useEffect } from "react";
import { DriveFolder } from "@/lib/file-types";
import { FolderOpen, Search, ChevronDown } from "lucide-react";

interface FolderSelectorProps {
  folders: DriveFolder[];
  value: string;
  onChange: (folderId: string) => void;
  label?: string;
}

export function FolderSelector({ folders, value, onChange, label }: FolderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const folderMap = new Map(folders.map((f) => [f.id, f]));

  const getFolderPath = (folderId: string): string => {
    const parts: string[] = [];
    let current = folderMap.get(folderId);
    while (current) {
      parts.unshift(current.name);
      current = current.parentId ? folderMap.get(current.parentId) : undefined;
    }
    return parts.join(" ➡ ");
  };

  const foldersWithPath = folders.map((f) => ({
    ...f,
    pathName: getFolderPath(f.id),
  }));
  foldersWithPath.sort((a, b) => a.pathName.localeCompare(b.pathName));

  const filteredFolders = foldersWithPath.filter((folder) =>
    folder.pathName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showRoot = "Without Folder (Root)".toLowerCase().includes(searchQuery.toLowerCase());

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="mb-4">
      {label && (
        <label className="block text-white/70 text-sm mb-2 font-medium">{label}</label>
      )}
      <div className="relative z-30" ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="glass-input w-full pl-10 pr-10 py-2.5 text-white flex items-center justify-between cursor-pointer text-left focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        >
          <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
          <span className="truncate">
            {value === "root" ? "Without Folder (Root)" : (folderMap.has(value) ? getFolderPath(value) : "Select Folder")}
          </span>
          <ChevronDown className={`w-4 h-4 text-white/40 absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div
            className="absolute left-0 right-0 mt-1.5 z-50 rounded-xl border border-white/10 overflow-hidden shadow-2xl"
            style={{ backgroundColor: "#15132b" }}
          >
            <div className="relative border-b border-white/10">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "168px" }}>
              {showRoot && (
                <div
                  onClick={() => {
                    onChange("root");
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                    value === "root"
                      ? "bg-indigo-600/30 text-white font-medium"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  Without Folder (Root)
                </div>
              )}
              {filteredFolders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => {
                    onChange(folder.id);
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                  className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                    value === folder.id
                      ? "bg-indigo-600/30 text-white font-medium"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {folder.pathName}
                </div>
              ))}
              {!showRoot && filteredFolders.length === 0 && (
                <div className="px-4 py-6 text-sm text-white/40 text-center">
                  No folders found
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
