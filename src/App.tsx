import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import AboutPage from './pages/AboutPage'
import CliPage from './pages/CliPage'
import DocsPage from './pages/DocsPage'
import EditorPage from './pages/EditorPage'
import ExamplesPage from './pages/ExamplesPage'
import ChangelogPage from './pages/ChangelogPage'
import LandingPage from './pages/LandingPage'
import RootLayout from './components/RootLayout'

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
              <motion.div
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.28, ease: 'easeInOut' }}
              >
                <LandingPage />
              </motion.div>
            </RootLayout>
          }
        />
        <Route
          path="/app"
          element={
            <RootLayout>
              <motion.div
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.32, ease: 'easeInOut' }}
              >
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

const App = () => (
  <HashRouter>
    <AnimatedRoutes />
  </HashRouter>
)

export default App
