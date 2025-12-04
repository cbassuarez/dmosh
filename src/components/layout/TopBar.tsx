// src/components/layout/TopBar.tsx
import { motion } from "framer-motion";

export function TopBar() {
  return (
    <motion.header
      className="flex items-center justify-between border-b border-dm-border bg-black/60 px-4 py-2 backdrop-blur"
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <div className="text-sm font-semibold tracking-wide text-slate-200">
        dmosh
        <span className="ml-2 text-xs font-normal text-slate-500">
          v0.1 – datamosh lab
        </span>
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>Project: <span className="font-mono">untitled</span></span>
      </div>
    </motion.header>
  );
}

