import { NO_DEFENSE_PERMISSIONS, type DefenseViewerPermissions } from "../../api/client"

/** Who is looking at the defense in a test scenario. */
export type DefenseViewerKind = "admin" | "manager" | "none"

/**
 * Test fixture: the `viewerPermissions` the backend sends for a viewer and a status,
 * mirroring `DefenseViewerContext.permissions_for`. `manager` is a coordinator of the
 * thesis course or the thesis advisor; `none` is anyone who does not manage the defense
 * (for example a committee member who coordinates another course).
 */
export function defensePermissions(viewer: DefenseViewerKind, status: string): DefenseViewerPermissions {
  if (viewer === "none") return NO_DEFENSE_PERMISSIONS
  const isScheduled = status === "SCHEDULED"
  return {
    canManage: true,
    canEdit: isScheduled,
    canCancel: isScheduled,
    canStart: isScheduled,
    canClose: status === "IN_PROGRESS",
    canRevert: viewer === "admin" && (status === "IN_PROGRESS" || status === "CANCELLED"),
    canManageMembers: isScheduled || status === "IN_PROGRESS",
  }
}
