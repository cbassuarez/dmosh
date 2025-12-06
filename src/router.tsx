import { AnimatePresence, motion } from 'framer-motion'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import RootLayout from './layouts/RootLayout'
import LandingPage from './pages/LandingPage'
import EditorPage from './pages/EditorPage'
import AboutPage from './pages/AboutPage'
import DocsPage from './pages/DocsPage'
import CliPage from './pages/CliPage'
import ExamplesPage from './pages/ExamplesPage'
import ChangelogPage from './pages/ChangelogPage'
import LicensesPage from './pages/LicensesPage'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

const AnimatedRoutes = () => {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <RootLayout>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <LandingPage />
              </motion.div>
            </RootLayout>
          }
        />
        <Route
          path="/app"
          element={
            <RootLayout>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <EditorPage />
              </motion.div>
            </RootLayout>
          }
        />
        <Route
          path="/about"
          element={
            <RootLayout>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <AboutPage />
              </motion.div>
            </RootLayout>
          }
        />
        <Route
          path="/licenses"
          element={
            <RootLayout>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <LicensesPage />
              </motion.div>
            </RootLayout>
          }
        />
        <Route
          path="/docs"
          element={
            <RootLayout>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <DocsPage />
              </motion.div>
            </RootLayout>
          }
        />
        <Route
          path="/cli"
          element={
            <RootLayout>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <CliPage />
              </motion.div>
            </RootLayout>
          }
        />
        <Route
          path="/examples"
          element={
            <RootLayout>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <ExamplesPage />
              </motion.div>
            </RootLayout>
          }
        />
        <Route
          path="/changelog"
          element={
            <RootLayout>
              <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
                <ChangelogPage />
              </motion.div>
            </RootLayout>
          }
        />
      </Routes>
    </AnimatePresence>
  )
}

const AppRouter = () => (
  <HashRouter>
    <AnimatedRoutes />
  </HashRouter>
)

export default AppRouter
