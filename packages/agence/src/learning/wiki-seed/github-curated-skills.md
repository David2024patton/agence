# GitHub curated skills

Agence can install **Agent Skills** (`SKILL.md` folders) from public GitHub repos. On first project open, these packs are cloned in the background into `.agence/installs/` and enabled under the **Installed** resource group.

Requires network on first open. Retry from **Project Hub → Skills → Install from GitHub** if a pack failed.

## Auto-installed sources

| Source | What you get |
| --- | --- |
| [anthropics/skills](https://github.com/anthropics/skills) | `frontend-design`, `web-artifacts-builder` (multi-component sites, React/Tailwind/shadcn) |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `web-design-guidelines`, `react-best-practices` |
| [kostja94/marketing-skills](https://github.com/kostja94/marketing-skills) | SEO pack, marketing page types (landing, pricing, …), UI component skills |
| [ericosiu/ai-marketing-skills](https://github.com/ericosiu/ai-marketing-skills) | `clone-site` — site analysis / rebuild workflows |

## Install more from GitHub (Project Hub)

Paste any of these into **Install from GitHub** (type: **skill**):

```text
https://github.com/kostja94/marketing-skills/tree/main/skills/seo/on-page
https://github.com/kostja94/marketing-skills/tree/main/skills/pages/marketing/landing-page
https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines
https://github.com/anthropics/skills/tree/main/skills/frontend-design
https://github.com/ericosiu/ai-marketing-skills/tree/main/clone-site
```

Full marketing library (160+ skills): clone repo root or `skills/` subpath:

```text
https://github.com/kostja94/marketing-skills
```

Other community packs:

- [ericosiu/ai-marketing-skills](https://github.com/ericosiu/ai-marketing-skills) — growth, content ops, outbound, SEO
- [LeoYeAI/openclaw-marketing-skills](https://github.com/LeoYeAI/openclaw-marketing-skills) — marketing playbooks for agents
- [ScaleBrick/founder-marketing-skills](https://github.com/ScaleBrick/founder-marketing-skills) — founder SEO & growth

## Skills vs Knowledge wiki

| | Skills (`SKILL.md`) | Knowledge wiki (this library) |
| --- | --- | --- |
| Loaded when | Agent session, matching task | You browse `/library` or agent searches wiki |
| Format | YAML frontmatter + instructions | Markdown articles |
| Install path | `.agence/installs/<skill-name>/` | `.agence/knowledge/wiki/*.md` |

Bundled wiki articles ([[Seo Basics]], [[Web Design Fundamentals]], …) are quick reference. GitHub skills are full agent playbooks.

## See also

- [[Knowledge And Library]]
- [[Getting Started]]
