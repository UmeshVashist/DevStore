"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

interface NewBadge3DProps {
  isUpdated?: boolean;
  hoursLeft?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function NewBadge3D({
  isUpdated = false,
  hoursLeft = 24,
  className = "",
  size = "md",
}: NewBadge3DProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Generate 18-point jagged starburst polygon points (center 22, 22)
  const polygonPoints = useMemo(() => {
    const pts: string[] = [];
    const numPoints = 18;
    const totalVertices = numPoints * 2;
    const cx = 22;
    const cy = 22;
    const rOuter = 20.5;
    const rInner = 14;

    for (let i = 0; i < totalVertices; i++) {
      const angle = (i * Math.PI) / numPoints - Math.PI / 2;
      const r = i % 2 === 0 ? rOuter : rInner;
      const x = (cx + r * Math.cos(angle)).toFixed(1);
      const y = (cy + r * Math.sin(angle)).toFixed(1);
      pts.push(`${x},${y}`);
    }
    return pts.join(" ");
  }, []);

  const sizeStyles = {
    sm: "w-8 h-8 -top-2.5 -left-2.5",
    md: "w-10 h-10 -top-3 -left-3",
    lg: "w-12 h-12 -top-3.5 -left-3.5",
  }[size];

  return (
    <div
      className={`absolute z-30 pointer-events-auto select-none ${sizeStyles} ${className}`}
      style={{ perspective: 600 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${isUpdated ? "Updated" : "New"} (Expires in ~${hoursLeft}h)`}
    >
      <motion.div
        className="relative w-full h-full cursor-help"
        style={{
          transformStyle: "preserve-3d",
        }}
        initial={{ scale: 0, rotate: -30 }}
        animate={{
          scale: 1,
          rotateZ: [-12, -16, -9, -15, -12],
          rotateX: [0, 12, -8, 10, 0],
          rotateY: [0, -14, 12, -8, 0],
          y: [0, -3.5, 0.5, -2.5, 0],
        }}
        whileHover={{
          scale: 1.25,
          rotateZ: -6,
          rotateX: 6,
          rotateY: -8,
          transition: { duration: 0.2 },
        }}
        transition={{
          scale: { type: "spring", stiffness: 350, damping: 18 },
          rotateZ: { duration: 3.6, repeat: Infinity, ease: "easeInOut" },
          rotateX: { duration: 4.2, repeat: Infinity, ease: "easeInOut" },
          rotateY: { duration: 3.8, repeat: Infinity, ease: "easeInOut" },
          y: { duration: 3.2, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <svg
          viewBox="0 0 44 44"
          className="w-full h-full overflow-visible drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)] drop-shadow-[0_0_8px_rgba(74,222,128,0.65)]"
        >
          <defs>
            {/* 3D Green Starburst Gradient */}
            <linearGradient id="burstGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a3e635" />
              <stop offset="35%" stopColor="#4ade80" />
              <stop offset="85%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#15803d" />
            </linearGradient>

            {/* Glossy radial highlight overlay */}
            <radialGradient id="glossHighlight" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>

            {/* Fiery 3D Text Gradient */}
            <linearGradient id="textGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="25%" stopColor="#ffedd5" />
              <stop offset="55%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>

            {/* Shimmer clip path */}
            <clipPath id="burstClip">
              <polygon points={polygonPoints} />
            </clipPath>
          </defs>

          {/* Under-glow / Starburst Back Outline */}
          <polygon
            points={polygonPoints}
            fill="#14532d"
            stroke="#14532d"
            strokeWidth="3.5"
            strokeLinejoin="round"
            transform="translate(0, 1.2)"
            opacity="0.75"
          />

          {/* Main Starburst Body */}
          <polygon
            points={polygonPoints}
            fill="url(#burstGradient)"
            stroke="#166534"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />

          {/* Glossy 3D Highlight Curve */}
          <polygon
            points={polygonPoints}
            fill="url(#glossHighlight)"
            clipPath="url(#burstClip)"
            opacity="0.8"
          />

          {/* Shimmer sweep animation */}
          <g clipPath="url(#burstClip)">
            <motion.rect
              x="-44"
              y="0"
              width="24"
              height="44"
              fill="rgba(255, 255, 255, 0.45)"
              transform="skewX(-25)"
              animate={{
                x: [-44, 60],
              }}
              transition={{
                duration: 2.8,
                repeat: Infinity,
                repeatDelay: 1.5,
                ease: "easeInOut",
              }}
            />
          </g>

          {/* "NEW!" Text with 3D Pop layers */}
          <g transform="rotate(-12 22 22)">
            {/* Deep 3D Shadow layer 2 */}
            <text
              x="22"
              y="23.2"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12.5"
              fontWeight="900"
              fontFamily="Impact, system-ui, sans-serif"
              fill="#450a0a"
              letterSpacing="0.04em"
            >
              NEW!
            </text>

            {/* 3D Extrusion layer 1 */}
            <text
              x="22"
              y="22.6"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12.5"
              fontWeight="900"
              fontFamily="Impact, system-ui, sans-serif"
              fill="#991b1b"
              letterSpacing="0.04em"
            >
              NEW!
            </text>

            {/* Front Gradient Text with bright stroke */}
            <text
              x="22"
              y="21.8"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="12.5"
              fontWeight="900"
              fontFamily="Impact, system-ui, sans-serif"
              fill="url(#textGradient)"
              stroke="#7f1d1d"
              strokeWidth="0.5"
              letterSpacing="0.04em"
              style={{
                paintOrder: "stroke fill",
              }}
            >
              NEW!
            </text>
          </g>
        </svg>

        {/* Hover Tooltip showing 24-hour remaining status */}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute left-1/2 -bottom-7 -translate-x-1/2 bg-slate-900/95 dark:bg-black/95 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-lime-400/30 whitespace-nowrap z-50 pointer-events-none flex items-center gap-1"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-lime-400 animate-ping" />
            <span>
              {isUpdated ? "Updated" : "New"} • {hoursLeft}h left
            </span>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
