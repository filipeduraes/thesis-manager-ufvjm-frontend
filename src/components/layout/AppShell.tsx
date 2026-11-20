import { useEffect } from "react"
import type { ReactNode } from "react"
import type { NavigationItem, Page } from "../../types"
import type { SearchDestination } from "../../data/globalSearch"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"

interface AppShellProps {
  children: ReactNode
  page: Page
  profileLabel: string
  menuItems: NavigationItem[]
  searchSessionKey: string
  canReadDirectory: boolean
  onSearchNavigate: (destination: SearchDestination) => void
  onSessionExpired: () => void
  userName: string
  userInitials: string
  userAvatarUrl: string | null
  title: string
  menuOpen: boolean
  navigate: (page: Page) => void
  logout: () => void
  setMenuOpen: (open: boolean) => void
}

export default function AppShell({
  children,
  page,
  profileLabel,
  menuItems,
  searchSessionKey,
  canReadDirectory,
  onSearchNavigate,
  onSessionExpired,
  userName,
  userInitials,
  userAvatarUrl,
  title,
  menuOpen,
  navigate,
  logout,
  setMenuOpen,
}: AppShellProps) {
  // Escape fecha o menu lateral aberto no celular, como esperado de uma navegação em gaveta.
  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [menuOpen, setMenuOpen])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#conteudo-principal">
        Pular para o conteúdo
      </a>
      <Sidebar
        profileLabel={profileLabel}
        menuItems={menuItems}
        userName={userName}
        userInitials={userInitials}
        userAvatarUrl={userAvatarUrl}
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
          key={searchSessionKey}
          menuItems={menuItems}
          canReadDirectory={canReadDirectory}
          onSearchNavigate={onSearchNavigate}
          onSessionExpired={onSessionExpired}
          openMenu={() => setMenuOpen(true)}
        />
        <div className="mobile-title">{title}</div>
        <main id="conteudo-principal" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
