import React from 'react'
import { Link } from 'react-router-dom'

interface AppFooterProps {
  onOpenAbout?: () => void
}

const AppFooter: React.FC<AppFooterProps> = ({ onOpenAbout }) => {
  return (
    <footer className="border-t border-surface-300/60 bg-surface-200/80 px-6 py-4 text-[11px] text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <span className="text-slate-500">© {new Date().getFullYear()} dmosh</span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onOpenAbout}
            className="text-slate-400 underline decoration-slate-600/60 underline-offset-2 hover:text-slate-200 hover:decoration-slate-300"
          >
            About
          </button>
          <Link
            to="/licenses"
            className="text-slate-400 underline decoration-slate-600/60 underline-offset-2 hover:text-slate-200 hover:decoration-slate-300"
          >
            Open-source &amp; licenses
          </Link>
        </div>
      </div>
    </footer>
  )
}

export default AppFooter
