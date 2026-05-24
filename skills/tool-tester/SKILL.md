---
name: tool-tester
description: "Systematic tool testing skill. Creates a task per tool, runs a real task for each, and verifies output."
---
# Tool Tester

Load this skill to run a full test suite across all available tools. Creates one todo per tool, executes each with a real task, and reports results.

## How to run

1. Call `todowrite` to create a task list — one task per tool
2. For each tool, call it with a real task (not just a ping — actually use it)
3. Mark each task `completed` after verification
4. When done, call `reflect` to save what was learned

## Test plan per tool

| Tool | Task to run | What to verify |
|------|-------------|----------------|
| `read` | Read a file from the project (e.g., `AGENCE.md`) | Returns content correctly |
| `write` | Write a test file to a temp location | File is created |
| `edit` | Edit the test file you just wrote | Changes are applied |
| `glob` | Search for `*.ts` files in any directory | Returns matching paths |
| `grep` | Search for a keyword in files | Returns matches |
| `system_info` | Get system information | Returns OS/CPU/RAM details |
| `weather` | Get weather for a city | Returns temperature + conditions |
| `drives` | List drives | Returns drive list |
| `os_open` | Note: runs on desktop only. Skip if in headless CLI. |
| `env_read` | Read the .env file | Returns variables (or not-found message) |
| `env_write` | Write a test env var | Var is saved |
| `lint` | Run typecheck on the project | Returns lint output |
| `screenshot` | Take a desktop screenshot | Returns image attachment (vision models see it) |
| `powershell` | Run `Get-Location` (Windows) or `pwd` (Unix) | Returns current directory |
| `browser_inspect` | Open a simple URL and inspect | Returns page snapshot |
| `browser_screenshot` | Screenshot the page | Returns image |
| `browser_close` | Close the browser | Confirms closure |
| `image_describe` | Describe a screenshot or image | Returns OCR/description text |
| `todowrite` | Create a test todo list | Tasks are created |
| `todoread` | Read the todo list | Returns tasks |
| `task_search` | Search for a task by keyword | Returns matching tasks |
| `todo_carry` | Note: requires two sessions. Skip during single-session testing. |
| `reflect` | Reflect on what was tested | Creates a skill |
| `model_learn` | Store a concept | Concept is saved |
| `memory_add` | Add a test memory | Memory is stored |
| `memory_recall` | Recall the memory | Returns the memory |
| `vector_search` | Search for the concept | Returns the learning |
| `quality_gate` | Record a test quality check | Check is stored |
| `eval_run` | Record an eval result | Result is logged |
| `agent_group` | Create a test agent group | Group is created |
| `plugin_marketplace` | Browse available plugins | Returns plugin list |
| `plugin_install` | Show how to install (don't actually install) | Instructions displayed |
| `webfetch` | Fetch a URL | Returns content |
| `websearch` | Search for a topic | Returns results |
| `question` | Ask a simple yes/no to the user | User responds |
| `skill` | Load this skill (already loaded) | Skill content displayed |

## Verification
- Each tool must complete without errors
- If a tool fails, note the error but continue testing
- Report pass/fail for each tool at the end
- Don't skip tools unless they truly can't run (e.g. browser tools without agent-browser installed)

## After testing
1. Call `reflect` to save the test run as a skill
2. Call `model_learn` to store the test patterns
3. Report the final pass/fail count
