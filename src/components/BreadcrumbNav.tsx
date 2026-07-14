"use client";

import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface BreadcrumbNavProps {
  path: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
}

export function BreadcrumbNav({ path, onNavigate }: BreadcrumbNavProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap mb-4 text-sm font-semibold">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/10 text-slate-700 hover:text-black dark:text-slate-300 dark:hover:text-white transition-colors"
      >
        <Home className="w-4 h-4" />
        Root
      </button>
      {path.map((item, index) => (
        <span key={`${item.id}-${index}`} className="flex items-center gap-1">
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-white/30" />
          <button
            onClick={() => onNavigate(item.id)}
            className="px-2 py-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/10 text-slate-700 hover:text-black dark:text-slate-300 dark:hover:text-white transition-colors truncate max-w-[140px]"
            title={item.name}
          >
            {item.name}
          </button>
        </span>
      ))}
    </div>
  );
}
