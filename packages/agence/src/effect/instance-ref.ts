import { Context } from "effect"
// InstanceRef/WorkspaceRef: Effect context references for project context.
// InstanceRef carries the current InstanceContext (directory, project, worktree).
// WorkspaceRef carries the current workspace ID.
// Both default to undefined — middleware provides real values per-request.
import type { InstanceContext } from "@/project/instance-context"
import type { WorkspaceID } from "@/control-plane/schema"

export const InstanceRef = Context.Reference<InstanceContext | undefined>("~opencode/InstanceRef", {
  defaultValue: () => undefined,
})

export const WorkspaceRef = Context.Reference<WorkspaceID | undefined>("~opencode/WorkspaceRef", {
  defaultValue: () => undefined,
})
