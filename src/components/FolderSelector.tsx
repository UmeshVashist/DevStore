"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
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
  const [focusedIndex, setFocusedIndex] = useState(-1);
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

  // Consolidate all selectable items in order: root first, then folders
  const selectableItems = [
    ...(showRoot ? [{ id: "root", pathName: "Without Folder (Root)" }] : []),
    ...filteredFolders.map(f => ({ id: f.id, pathName: f.pathName }))
  ];

  // Reset focus when query changes or dropdown opens
  useEffect(() => {
    setFocusedIndex(selectableItems.length > 0 ? 0 : -1);
  }, [searchQuery, isOpen, selectableItems.length]);

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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (selectableItems.length > 0 ? (prev + 1) % selectableItems.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (selectableItems.length > 0 ? (prev - 1 + selectableItems.length) % selectableItems.length : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < selectableItems.length) {
        const selectedItem = selectableItems[focusedIndex];
        onChange(selectedItem.id);
        setIsOpen(false);
        setSearchQuery("");
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div>
      {label && (
        <label className="block text-slate-600 dark:text-slate-400 text-sm mb-2 font-bold">{label}</label>
      )}
      <div className="relative z-50" ref={containerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="glass-neo-btn w-full pl-10 pr-10 py-2.5 text-slate-800 dark:text-white flex items-center justify-between cursor-pointer text-left focus:outline-none border border-slate-200/50 dark:border-white/10 rounded-xl"
        >
          <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <span className="truncate font-semibold">
            {value === "root" ? "Without Folder (Root)" : (folderMap.has(value) ? getFolderPath(value) : "Select Folder")}
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-1/2 -translate-y-1/2 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div
            className="absolute left-0 right-0 mt-1.5 z-50 rounded-xl overflow-hidden glass-neo-out border border-slate-200/50 dark:border-white/10 shadow-2xl bg-[#fdfbf7]/95 dark:bg-[#15112e]/95 backdrop-blur-xl"
          >
            <div className="relative border-b border-slate-200/40 dark:border-white/10">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full bg-transparent pl-10 pr-4 py-2.5 text-sm text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: "168px" }}>
              {selectableItems.map((item, idx) => {
                const isSelected = value === item.id;
                const isFocused = idx === focusedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      onChange(item.id);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold border-l-2 border-indigo-500"
                        : isFocused
                        ? "bg-slate-200/60 dark:bg-white/10 text-slate-800 dark:text-white font-bold"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/40 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {item.pathName}
                  </div>
                );
              })}
              {selectableItems.length === 0 && (
                <div className="px-4 py-6 text-sm text-slate-400 dark:text-slate-500 text-center font-medium">
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
