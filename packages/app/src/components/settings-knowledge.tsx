import { useLanguage } from "@/context/language"
import { SettingsLearningShell } from "./settings-learning-shell"
import { SettingsKnowledgePanel } from "./settings-knowledge-panel"

/** Standalone Knowledge settings (prefer Memory → Knowledge & RAG sub-tab). */
export function SettingsKnowledge() {
  const language = useLanguage()

  return (
    <SettingsLearningShell
      title={language.t("settings.tab.knowledge")}
      description={language.t("settings.knowledge.description")}
    >
      <SettingsKnowledgePanel />
    </SettingsLearningShell>
  )
}
