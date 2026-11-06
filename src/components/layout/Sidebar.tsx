import { useEffect, useState } from "react"
import { menuByProfile } from "../../data/navigation"
import type { Page, Profile } from "../../types"
import { Icon, Logo } from "../../components/common"

interface SidebarProps {
  profile: Profile
  userName: string
  userInitials: string
  userAvatarUrl: string | null
  page: Page
  go: (page: Page) => void
  logout: () => void
  open: boolean
  close: () => void
}

function UserAvatar({ url, initials }: { url: string | null; initials: string }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [url])

  return (
    <div className="avatar">
      {url && !failed ? (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </div>
  )
}

export default function Sidebar({
  profile,
  userName,
  userInitials,
  userAvatarUrl,
  page,
  go,
  logout,
  open,
  close,
}: SidebarProps) {
  return (
    <aside
      className={`sidebar ${open ? "open" : ""}`}
      aria-label="Navegação principal"
    >
      <div className="sidebar-header">
        <Logo dark />
        <button
          className="sidebar-close icon-btn"
          onClick={close}
          aria-label="Fechar menu"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="profile-pill">
        <UserAvatar url={userAvatarUrl} initials={userInitials} />
        <div>
          <strong>{userName}</strong>
          <span>{profile}</span>
        </div>
      </div>
      <nav>
        {menuByProfile[profile].map((item, index) => (
          <button
            key={`${item.label}-${index}`}
            className={page === item.page ? "active" : ""}
            onClick={() => {
              go(item.page)
              close()
            }}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <a href="https://portal.ufvjm.edu.br/" target="_blank" rel="noreferrer">
          <Icon name="book" />
          <span>Portal da UFVJM</span>
        </a>
        <button onClick={logout}>
          <Icon name="logout" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}
