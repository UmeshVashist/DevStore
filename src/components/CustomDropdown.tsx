"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  align?: "left" | "right";
}

export function CustomDropdown({
  options,
  value,
  onChange,
  className,
  align = "right",
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

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
    <div className="relative inline-block text-left w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "glass-neo-btn w-full px-4 py-2 border border-slate-200/50 dark:border-white/10 rounded-xl text-sm font-semibold cursor-pointer outline-none flex items-center justify-between gap-2 text-slate-800 dark:text-white transition-all",
          className
        )}
      >
        <span className="flex items-center gap-1.5 truncate">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption?.label}</span>
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "absolute mt-1.5 z-50 rounded-xl overflow-hidden glass-neo-out border border-slate-200/50 dark:border-white/10 shadow-2xl min-w-[200px] w-full max-h-60 overflow-y-auto bg-[#fdfbf7]/95 dark:bg-[#15112e]/95 backdrop-blur-xl",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            <div className="py-1">
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      "w-full px-4 py-2.5 text-left text-sm font-medium transition-colors flex items-center gap-2",
                      isSelected
                        ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold border-l-2 border-indigo-500"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {option.icon && <span className="shrink-0">{option.icon}</span>}
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
