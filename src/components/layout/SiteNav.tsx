import { Link, NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

const links = [
  { to: "/app", label: "App" },
  { to: "/docs", label: "Docs", external: true },
  { to: "/spec", label: "Spec" },
  { to: "/changelog", label: "Changelog" },
  { to: "/about", label: "About" },
];

export function SiteNav() {
  const location = useLocation();
  const isEditor = location.pathname.startsWith("/app");

  // Hide marketing nav on the editor route; editor has its own focused chrome
  if (isEditor) return null;

  return (
    <motion.header
      className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur"
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 text-sm">
        {/* Brand */}
        <Link to="/" className="flex items-baseline gap-2">
          <span className="text-sm font-semibold tracking-wide text-slate-100">
            dmosh
          </span>
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
            datamosh lab
          </span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-4 text-xs text-slate-300">
          {links.map((link) =>
            link.external ? (
              <a
                key={link.to}
                href={link.to}
                className="transition hover:text-slate-50"
              >
                {link.label}
              </a>
            ) : (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  [
                    "px-2 py-1 rounded-md transition",
                    isActive
                      ? "bg-slate-900/80 text-slate-50"
                      : "hover:bg-slate-900/60 hover:text-slate-50",
                  ].join(" ")
                }
              >
                {link.label}
              </NavLink>
            )
          )}
          <a
            href="https://github.com/cbassuarez/dmosh"
            className="rounded-md border border-slate-800 px-2 py-1 text-xs text-slate-300 hover:border-teal-400 hover:text-teal-300"
          >
            GitHub
          </a>
        </nav>
      </div>
    </motion.header>
  );
}
