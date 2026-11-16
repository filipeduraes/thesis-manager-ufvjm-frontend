import { useState } from "react"

/** Returns up to two initials from the first words of a name, in upper case. */
export function initialsOf(name: string): string {
  const parts = name.split(" ").filter(Boolean).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}

export interface AvatarProps {
  /** Name shown next to the avatar; used for the initials. */
  name: string
  /** Profile picture URL from the API (`avatarUrl`); null or absent shows the initials. */
  imageUrl?: string | null
  /** Initials provided by the API (e.g. `initials` in the session); computed from `name` otherwise. */
  initials?: string
  /** `small` uses the 34px variant of the user list (`.avatar.small`). */
  size?: "default" | "small"
}

/**
 * Circular avatar with the `.avatar` classes of the sidebar and the user list.
 *
 * Shows the picture when `imageUrl` is set and falls back to the initials when it is
 * missing or fails to load. The avatar is decorative (the name is always rendered beside
 * it), so it is hidden from assistive technologies.
 */
export default function Avatar({ name, imageUrl, initials, size = "default" }: AvatarProps) {
  // Guarda a URL que falhou em vez de um booleano: uma URL nova volta a tentar a foto sem efeito.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = Boolean(imageUrl) && imageUrl !== failedUrl
  const className = size === "small" ? "avatar small" : "avatar"

  return (
    <div className={className} aria-hidden="true">
      {showImage && imageUrl ? (
        <img src={imageUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(imageUrl)} />
      ) : (
        initials || initialsOf(name)
      )}
    </div>
  )
}
