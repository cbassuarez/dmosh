import { ReactNode } from 'react'
import NavBar from './navigation/NavBar'

interface Props {
  children: ReactNode
}

const RootLayout = ({ children }: Props) => {
  return (
    <div className="min-h-screen bg-surface-100 text-slate-50">
      <NavBar />
      <main className="pt-20">{children}</main>
    </div>
  )
}

export default RootLayout
