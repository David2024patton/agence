import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { SkillInstallError } from "@/project/installer"
import { InvalidRequestError } from "../errors"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery, WorkspaceRoutingQueryFields } from "../middleware/workspace-routing"

const ResourceRef = Schema.Struct({
  type: Schema.Literals(["persona", "skill", "mcp", "plugin", "document_pack", "memory_pack"]),
  ref: Schema.String,
})

const ResourceGroup = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  builtin: Schema.optional(Schema.Boolean),
  enabled: Schema.optional(Schema.Boolean),
  items: Schema.Array(ResourceRef),
})

const Manifest = Schema.Struct({
  version: Schema.optional(Schema.Number),
  persona_id: Schema.optional(Schema.String),
  default_model: Schema.optional(Schema.String),
  goal: Schema.optional(Schema.String),
  enabled_groups: Schema.optional(Schema.Array(Schema.String)),
  max_parallel_agents: Schema.optional(Schema.Number),
})

const ResourceToggle = Schema.Struct({
  type: Schema.Literals(["persona", "skill", "mcp", "plugin"]),
  ref: Schema.String,
  enabled: Schema.Boolean,
})

const HubState = Schema.Struct({
  directory: Schema.String,
  manifest: Manifest,
  groups: Schema.Array(ResourceGroup),
  effective: Schema.Array(ResourceRef),
  personas: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      description: Schema.optional(Schema.String),
      mode: Schema.optional(Schema.String),
      active: Schema.Boolean,
      custom: Schema.optional(Schema.Boolean),
      enabled: Schema.Boolean,
      locked: Schema.optional(Schema.Boolean),
    }),
  ),
  skills: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      description: Schema.optional(Schema.String),
      location: Schema.String,
      enabled: Schema.Boolean,
      locked: Schema.optional(Schema.Boolean),
    }),
  ),
  mcps: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      status: Schema.String,
      type: Schema.String,
      enabled: Schema.Boolean,
    }),
  ),
  threads: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      title: Schema.String,
      parentID: Schema.optional(Schema.String),
      updated: Schema.optional(Schema.Number),
      kind: Schema.Literals(["session", "subagent"]),
    }),
  ),
  mcpServe: Schema.Struct({
    stdio: Schema.String,
    global: Schema.optional(Schema.String),
    note: Schema.String,
  }),
  goal: Schema.optional(
    Schema.Struct({
      status: Schema.String,
      continuationCount: Schema.Number,
      budget: Schema.Number,
    }),
  ),
})

const UpdateManifestPayload = Manifest

const ToggleGroupPayload = Schema.Struct({
  groupID: Schema.String,
  enabled: Schema.Boolean,
})

const InstallPayload = Schema.Struct({
  type: Schema.Literals(["persona", "skill", "mcp", "plugin", "document_pack", "memory_pack"]),
  github: Schema.String,
  subpath: Schema.optional(Schema.String),
  id: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
})

const UploadPayload = Schema.Struct({
  type: Schema.Literals(["persona", "skill", "mcp", "plugin", "document_pack", "memory_pack"]),
  name: Schema.String,
  content: Schema.String,
})

const SaveGroupsPayload = Schema.Struct({
  groups: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      description: Schema.optional(Schema.String),
      items: Schema.Array(ResourceRef),
    }),
  ),
})

const SavePersonaPayload = Schema.Struct({
  id: Schema.optional(Schema.String),
  name: Schema.String,
  description: Schema.optional(Schema.String),
  mode: Schema.optional(Schema.Literals(["primary", "subagent", "all"])),
  prompt: Schema.String,
  activate: Schema.optional(Schema.Boolean),
})

const PersonaContent = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  mode: Schema.optional(Schema.String),
  prompt: Schema.String,
})

const PersonaQuery = Schema.Struct({
  ...WorkspaceRoutingQueryFields,
  personaID: Schema.String,
})

export const HubApi = HttpApi.make("hub").add(
  HttpApiGroup.make("hub")
    .add(
      HttpApiEndpoint.get("state", "/hub/state", {
        query: WorkspaceRoutingQuery,
        success: HubState,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "hub.state",
          summary: "Project hub state (manifest, groups, resources, threads)",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("updateManifest", "/hub/manifest", {
        query: WorkspaceRoutingQuery,
        payload: UpdateManifestPayload,
        success: Manifest,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "hub.manifest.update",
          summary: "Update project manifest (persona, goal, groups, limits)",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("toggleGroup", "/hub/groups/toggle", {
        query: WorkspaceRoutingQuery,
        payload: ToggleGroupPayload,
        success: Manifest,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "hub.groups.toggle",
          summary: "Enable or disable a resource group for this project",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("install", "/hub/install/github", {
        query: WorkspaceRoutingQuery,
        payload: InstallPayload,
        success: Schema.Struct({
          id: Schema.String,
          name: Schema.String,
          path: Schema.optional(Schema.String),
          github: Schema.optional(Schema.String),
          skills: Schema.optional(Schema.Array(Schema.String)),
        }),
        error: [SkillInstallError, InvalidRequestError],
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "hub.install.github",
          summary: "Install persona, skill, MCP, or plugin from GitHub",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("upload", "/hub/upload", {
        query: WorkspaceRoutingQuery,
        payload: UploadPayload,
        success: Schema.Struct({
          id: Schema.String,
          name: Schema.String,
          path: Schema.optional(Schema.String),
        }),
        error: [SkillInstallError, InvalidRequestError],
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "hub.upload",
          summary: "Upload persona or skill content into project registry",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("saveGroups", "/hub/groups/save", {
        query: WorkspaceRoutingQuery,
        payload: SaveGroupsPayload,
        success: Schema.Struct({
          groups: Schema.Array(ResourceGroup),
        }),
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "hub.groups.save",
          summary: "Save custom resource groups to project registry",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("savePersona", "/hub/persona/save", {
        query: WorkspaceRoutingQuery,
        payload: SavePersonaPayload,
        success: Schema.Struct({
          id: Schema.String,
          name: Schema.String,
          path: Schema.optional(Schema.String),
        }),
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "hub.persona.save",
          summary: "Create or update a custom project persona",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.get("personaContent", "/hub/persona", {
        query: PersonaQuery,
        success: PersonaContent,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "hub.persona.get",
          summary: "Load custom persona markdown for editing",
        }),
      ),
    )
    .add(
      HttpApiEndpoint.post("toggleResource", "/hub/resource/toggle", {
        payload: ResourceToggle,
        success: HubState,
      }).annotateMerge(
        OpenApi.annotations({
          identifier: "hub.resource.toggle",
          summary: "Enable or disable a skill, persona, or MCP for this project",
        }),
      ),
    )
    .middleware(InstanceContextMiddleware)
    .middleware(WorkspaceRoutingMiddleware)
    .middleware(Authorization),
)
