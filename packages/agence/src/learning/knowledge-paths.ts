import path from "path"

export const PROJECT_KNOWLEDGE_REL = ".agence/knowledge"
export const PROJECT_WIKI_REL = ".agence/knowledge/wiki"

export function projectKnowledgePaths(projectDirectory: string) {
  const root = path.join(projectDirectory, ".agence", "knowledge")
  return {
    projectDirectory,
    root,
    wiki: path.join(root, "wiki"),
    raw: path.join(root, "raw"),
    memoryMd: path.join(root, "memory.md"),
    wikiRel: PROJECT_WIKI_REL,
    rootRel: PROJECT_KNOWLEDGE_REL,
  }
}
