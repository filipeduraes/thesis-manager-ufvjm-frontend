import { menuByProfile } from "../../data/navigation"
import type { Page, Profile } from "../../types"
import { Icon, Logo } from "../../components/common"

interface SidebarProps {
  profile: Profile
  userName: string
  userInitials: string
  page: Page
  go: (page: Page) => void
  logout: () => void
  open: boolean
  close: () => void
}
export default function Sidebar({
  profile,
  userName,
  userInitials,
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
        <div className="avatar">{userInitials}</div>
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
