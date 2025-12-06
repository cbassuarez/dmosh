import { ReactNode, useState } from 'react'
import NavBar from '../components/navigation/NavBar'
import AboutModal from '../components/AboutModal'
import AppFooter from '../components/AppFooter'

interface Props {
  children: ReactNode
}

const RootLayout = ({ children }: Props) => {
  const [aboutOpen, setAboutOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col bg-surface-100 text-slate-50">
      <NavBar />
      <main className="flex-1 pt-20">{children}</main>
      <AppFooter onOpenAbout={() => setAboutOpen(true)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}

export default RootLayout
