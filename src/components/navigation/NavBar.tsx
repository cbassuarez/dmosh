import { Link, NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'

const links = [
  { to: '/', label: 'Home' },
  { to: '/app', label: 'Editor' },
  { to: '/docs', label: 'Docs' },
  { to: '/examples', label: 'Examples' },
  { to: '/cli', label: 'CLI' },
  { to: '/changelog', label: 'Changelog' },
  { to: '/about', label: 'About' },
]

const NavBar = () => {
  const location = useLocation()
  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeInOut' }}
      className="fixed inset-x-0 top-0 z-40 border-b border-surface-300/60 bg-surface-100/80 backdrop-blur"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-100">
          <Flame className="h-5 w-5 text-accent" />
          <span>DMOSH</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm font-medium">
          {links.map((link) => {
            const isActive = location.pathname === link.to
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className="relative px-3 py-2 text-slate-300 transition-colors hover:text-white"
              >
                {link.label}
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-x-2 bottom-1 h-0.5 rounded-full bg-accent"
                    transition={{ duration: 0.24, ease: 'easeInOut' }}
                  />
                )}
              </NavLink>
            )
          })}
        </nav>
      </div>
    </motion.header>
  )
}

export default NavBar
