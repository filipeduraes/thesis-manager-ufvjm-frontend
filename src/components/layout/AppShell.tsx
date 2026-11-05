import type { ReactNode } from "react"
import type { Page, Profile } from "../../types"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
interface AppShellProps {
  children: ReactNode
  page: Page
  profile: Profile
  profiles: Profile[]
  userName: string
  userInitials: string
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
  userName,
  userInitials,
  title,
  menuOpen,
  navigate,
  logout,
  setMenuOpen,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar
        profile={profile}
        userName={userName}
        userInitials={userInitials}
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
          openMenu={() => setMenuOpen(true)}
        />
        <div className="mobile-title">{title}</div>
        {children}
      </div>
    </div>
  )
}
