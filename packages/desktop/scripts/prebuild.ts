#!/usr/bin/env bun
import { $ } from "bun"

import { resolveChannel } from "./utils"

import path from "path"

const channel = resolveChannel()
await $`bun ./scripts/copy-icons.ts ${channel}`
await $`bun ./scripts/copy-metainfo.ts ${channel}`

const agenceDir = path.resolve(import.meta.dir, "../../agence")
const scriptPath = path.resolve(agenceDir, "script/build-node.ts")
await $`cd ${agenceDir} && bun ${scriptPath}`
