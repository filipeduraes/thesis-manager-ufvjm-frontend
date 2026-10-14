import type { ReactNode } from "react"
import type { Page, Profile } from "../../types"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
interface AppShellProps {
  children: ReactNode
  page: Page
  profile: Profile
  title: string
  menuOpen: boolean
  navigate: (page: Page) => void
  logout: () => void
  setProfile: (profile: Profile) => void
  setMenuOpen: (open: boolean) => void
}
export default function AppShell({
  children,
  page,
  profile,
  title,
  menuOpen,
  navigate,
  logout,
  setProfile,
  setMenuOpen,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar
        profile={profile}
        page={page}
        go={navigate}
        logout={logout}
        open={menuOpen}
        close={() => setMenuOpen(false)}
      />
      {menuOpen && (
        <button
          className="nav-backdrop"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu"
        />
      )}
      <div className="app-main">
        <Topbar
          profile={profile}
          setProfile={setProfile}
          openMenu={() => setMenuOpen(true)}
        />
        <div className="mobile-title">{title}</div>
        {children}
      </div>
    </div>
  )
}
