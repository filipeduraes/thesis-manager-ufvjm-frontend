
import { useEffect, useState } from "react"
import type { SearchDestination } from "../../data/globalSearch"
import type { NavigationItem } from "../../types"
import { Icon } from "../common"
import GlobalSearch from "../search/GlobalSearch"

interface TopbarProps {
  openMenu: () => void
  menuItems: NavigationItem[]
  canReadDirectory: boolean
  onSearchNavigate: (destination: SearchDestination) => void
  onSessionExpired: () => void
}

export default function Topbar({
  openMenu, menuItems, canReadDirectory, onSearchNavigate, onSessionExpired,
}: TopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        if (!event.repeat) setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", openSearch)
    return () => window.removeEventListener("keydown", openSearch)
  }, [])

  return (
    <header className="topbar">
      <button
        className="menu-toggle icon-btn"
        onClick={openMenu}
        aria-label="Abrir menu"
      >
        <Icon name="menu" />
      </button>

      <button type="button" className="top-search global-search-trigger" aria-label="Pesquisar no sistema"
        aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" onClick={() => setSearchOpen(true)}>
        <Icon name="search" />
        <span>Pesquisar no sistema</span>
        <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K"}</kbd>
      </button>
      {searchOpen && (
        <GlobalSearch
          menuItems={menuItems}
          canReadDirectory={canReadDirectory}
          onNavigate={onSearchNavigate}
          onSessionExpired={onSessionExpired}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </header>
  )
}
