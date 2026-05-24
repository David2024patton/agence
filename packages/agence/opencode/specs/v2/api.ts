// @ts-nocheck

import { Agence } from "@agence-ai/core"
import { ReadTool } from "@agence-ai/core/tools"

const agence = Agence.make({})

agence.tool.add(ReadTool)

agence.tool.add({
  name: "bash",
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to run.",
      },
    },
    required: ["command"],
  },
  execute(input, ctx) {},
})

agence.auth.add({
  provider: "openai",
  type: "api",
  value: process.env.OPENAI_API_KEY,
})

agence.agent.add({
  name: "build",
  permissions: [],
  model: {
    id: "gpt-5-5",
    provider: "openai",
    variant: "xhigh",
  },
})

const sessionID = await agence.session.create({
  agent: "build",
})

agence.subscribe((event) => {
  console.log(event)
})

await agence.session.prompt({
  sessionID,
  text: "hey what is up",
})

await agence.session.prompt({
  sessionID,
  text: "what is up with this",
  files: [
    {
      mime: "image/png",
      uri: "data:image/png;base64,xxxx",
    },
  ],
})

await agence.session.wait()

console.log(await agence.session.messages(sessionID))
