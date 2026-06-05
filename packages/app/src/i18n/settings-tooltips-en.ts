/** Extended help for Settings UI (? icons). Merged into en dict. */
export const settingsTooltipsEn = {
  "settings.nav.general.body": "Desktop app preferences: language, shell, appearance, sounds, and updates.",
  "settings.nav.shortcuts.body": "Keyboard shortcuts for commands. Click a binding to record a new key chord.",
  "settings.nav.heartbeat.body": "Scheduled background tasks from HEARTBEAT.md — maintenance, exports, or short agent runs.",
  "settings.nav.memory.body": "Expand to configure learnings, document import, and the project knowledge wiki.",
  "settings.nav.memoryMemories.body": "Auto-capture, maintenance, and the list of stored learnings.",
  "settings.nav.memoryDocuments.body": "Upload PDF, Word, markdown, and text files into memory chunks.",
  "settings.nav.memoryKnowledge.body": "Wiki articles under .agence/knowledge/wiki/ — long-form RAG, separate from SQLite learnings.",
  "settings.nav.memorySkills.body": "SkillOpt: evolve project SKILL.md files from session trajectories with bounded, validated edits.",

  "settings.skillOpt.about.body":
    "Inspired by the SkillOpt research paper: treat skills as trainable text. Agence uses session trajectories, bounded edit budgets, validation gates, and a rejected-edit buffer so skills improve without bloating or breaking.",
  "settings.skillOpt.enabledTip.body": "Turn off to stop all automatic and manual SkillOpt runs for this project.",
  "settings.skillOpt.autoAfterSessionTip.body": "Runs at the end of each agent session, alongside memory reflection.",
  "settings.skillOpt.runNowTip.body": "Optimizes skills using the most recently updated session in this project.",
  "settings.nav.providers.body": "Connect LLM providers (API keys, OAuth, or env). Required before chatting.",
  "settings.nav.models.body": "Show or hide models per provider in the model picker.",

  "settings.general.tooltip.language.body":
    "Display language for menus, settings, and toasts. Does not change the agent's reply language by itself.",
  "settings.general.tooltip.language.ex1": "English UI with a French-speaking user is fine — the model follows your messages.",
  "settings.general.tooltip.autoAccept.body":
    "When on, tool permissions (read file, run command) are approved automatically for this project session.",
  "settings.general.tooltip.autoAccept.ex1": "Speeds up trusted repos; turn off when exploring unknown code.",
  "settings.general.tooltip.shell.body":
    "Shell used for the terminal panel and for agent bash/tool commands on this machine.",
  "settings.general.tooltip.shell.ex1": "PowerShell on Windows, bash/zsh on macOS/Linux.",
  "settings.general.tooltip.shell.ex2": "Auto picks your login shell when marked acceptable.",
  "settings.general.tooltip.reasoningSummaries.body":
    "Shows condensed reasoning summaries in the chat feed when the model supports extended thinking.",
  "settings.general.tooltip.shellToolPartsExpanded.body":
    "Expands shell command tool blocks in the feed by default so you see full command output immediately.",
  "settings.general.tooltip.editToolPartsExpanded.body":
    "Expands edit/write tool diffs in the feed by default.",
  "settings.general.tooltip.showSessionProgressBar.body":
    "Thin progress indicator at the top of the session while the agent is working.",
  "settings.general.tooltip.showFileTree.body": "Shows the file tree panel in the session sidebar (beta desktop).",
  "settings.general.tooltip.showNavigation.body": "Shows breadcrumb / navigation controls in the session UI.",
  "settings.general.tooltip.showSearch.body": "Enables in-session search UI where available.",
  "settings.general.tooltip.showTerminal.body": "Shows the integrated terminal panel.",
  "settings.general.tooltip.showStatus.body": "Shows the status popover trigger (servers, MCP, LSP).",
  "settings.general.tooltip.colorScheme.body":
    "Light, dark, or follow the OS. Affects the whole app chrome and editor surfaces.",
  "settings.general.tooltip.theme.body": "Color theme tokens (accent, surfaces). Custom themes can be added via docs.",
  "settings.general.tooltip.uiFont.body": "Sans-serif font for UI labels and chat. Leave empty for default.",
  "settings.general.tooltip.font.body": "Monospace font for code blocks in chat.",
  "settings.general.tooltip.terminalFont.body": "Font for the integrated terminal emulator.",
  "settings.general.tooltip.notifAgent.body": "Desktop notification when the agent finishes a turn (where supported).",
  "settings.general.tooltip.notifPermissions.body": "Notify when a tool needs permission and you are not focused on the app.",
  "settings.general.tooltip.notifErrors.body": "Notify on agent or connection errors.",
  "settings.general.tooltip.soundAgent.body": "Sound played when the agent completes (choose preset or off).",
  "settings.general.tooltip.soundPermissions.body": "Sound when permission is required.",
  "settings.general.tooltip.soundErrors.body": "Sound on errors.",
  "settings.general.tooltip.updatesStartup.body":
    "On launch, check GitHub releases for a newer Agence desktop build.",
  "settings.general.tooltip.releaseNotes.body": "Show release notes after updating.",
  "settings.general.tooltip.updatesCheck.body": "Manual check against the update channel for this build.",
  "settings.general.tooltip.pinchZoom.body": "Allow trackpad pinch to zoom the UI (Electron desktop).",
  "settings.general.tooltip.externalServer.body":
    "Connect the desktop UI to a remote Agence server URL instead of the bundled sidecar.",
  "settings.general.tooltip.wayland.body":
    "Use native Wayland display on Linux instead of XWayland. Change only if you have rendering or input issues.",
  "settings.general.tooltip.sectionAppearance.body": "Colors, fonts, and visual theme for the app.",
  "settings.general.tooltip.sectionNotifications.body": "OS-level notifications from Agence.",
  "settings.general.tooltip.sectionSounds.body": "Optional audio cues for agent and permission events.",
  "settings.general.tooltip.sectionUpdates.body": "Desktop update checks (packaged builds only).",
  "settings.general.tooltip.sectionDisplay.body": "Electron-specific display and server connection options.",
  "settings.general.tooltip.sectionAdvanced.body": "Experimental session UI panels (beta channel).",

  "settings.heartbeat.tooltip.page.body":
    "HEARTBEAT.md is a checklist of timed tasks the sidecar runs in the background (memory maintenance, exports, short prompts).",
  "settings.heartbeat.tooltip.page.ex1": "fn:memory-maintenance runs consolidate/prune.",
  "settings.heartbeat.tooltip.tasks.body": "Each line is an interval, name, and action. Disable with the switch without deleting.",
  "settings.heartbeat.tooltip.add.body": "Appends a new task line to HEARTBEAT.md and saves the file.",
  "settings.heartbeat.tooltip.taskName.body": "Short id used in .agence/heartbeat.json for last-run timestamps.",
  "settings.heartbeat.tooltip.interval.body": "How often to run: 15m, 1h, 1d, etc.",
  "settings.heartbeat.tooltip.action.body":
    "fn:… built-ins, cmd: shell, or free text for a mini agent prompt.",
  "settings.heartbeat.tooltip.help.body": "Markdown syntax reference for editing tasks manually.",

  "settings.providers.tooltip.page.body":
    "Providers supply API access to models. Connect at least one before starting a session.",
  "settings.providers.tooltip.connected.body":
    "Active credentials. Environment-sourced keys cannot be disconnected here — unset the env var instead.",
  "settings.providers.tooltip.popular.body": "Quick connect for common hosts. View all for the full catalog.",
  "settings.providers.tooltip.custom.body":
    "Any OpenAI-compatible base URL (local LM Studio, vLLM, etc.) with your own model ids.",

  "settings.models.tooltip.page.body":
    "Control which models appear in the picker. Hidden models stay connected but are not offered in the UI.",
  "settings.models.tooltip.visibility.body":
    "Toggle off models you never use to shorten the list. Does not delete provider credentials.",
  "settings.models.tooltip.visibility.ex1": "Hide legacy GPT-3.5 if you only use GPT-4 class models.",

  "settings.shortcuts.tooltip.page.body":
    "Overrides stored in your settings file. Click a shortcut, press keys, Escape to cancel, Backspace to clear.",
  "settings.shortcuts.tooltip.reset.body": "Removes all custom bindings and restores built-in defaults.",
  "settings.shortcuts.tooltip.search.body": "Filter by command title or key binding text.",
  "settings.shortcuts.tooltip.group.body":
    "Shortcuts grouped by area. Conflicts show a toast if two commands share the same chord.",
} as const
