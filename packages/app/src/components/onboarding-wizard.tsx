import { createSignal, Show, For } from "solid-js"
import { useLanguage } from "@/context/language"
import { useTheme } from "@agence-ai/ui/theme/context"
import { Logo } from "@agence-ai/ui/logo"

interface OnboardingWizardProps {
  onComplete: () => void
}

export function OnboardingWizard(props: OnboardingWizardProps) {
  const language = useLanguage()
  const theme = useTheme()
  const [step, setStep] = createSignal(1)
  const [agreed, setAgreed] = createSignal(false)
  const [selectedTheme, setSelectedTheme] = createSignal<"system" | "light" | "dark">("dark")
  const [selectedPlugins, setSelectedPlugins] = createSignal<string[]>([
    "android",
    "modern-web",
    "sdk",
    "science",
    "firebase",
    "chrome",
  ])

  const pluginsList = [
    {
      id: "android",
      name: "Android",
      description: "Core tools and knowledge required to develop for Android",
    },
    {
      id: "modern-web",
      name: "Modern Web Guidance",
      description: "Best practices for modern CSS, HTML, and Javascript coding guidelines",
    },
    {
      id: "sdk",
      name: "Google Antigravity SDK",
      description: "Interact with Antigravity agent-side features and package libraries",
    },
    {
      id: "science",
      name: "Science",
      description: "Retrieve structures, query ChEMBL and ClinVar databases",
    },
    {
      id: "firebase",
      name: "Firebase",
      description: "Google Firebase CLI, database integrations and deployment tools",
    },
    {
      id: "chrome",
      name: "Chrome DevTools",
      description: "Connect to your live Chrome session via Chrome DevTools Protocol",
    },
  ]

  function togglePlugin(id: string) {
    if (selectedPlugins().includes(id)) {
      setSelectedPlugins(selectedPlugins().filter((p) => p !== id))
    } else {
      setSelectedPlugins([...selectedPlugins(), id])
    }
  }

  function handleThemeSelect(mode: "system" | "light" | "dark") {
    setSelectedTheme(mode)
    theme.setColorScheme(mode)
    theme.setTheme("agence") // Set the default Agence theme
  }

  function nextStep() {
    if (step() === 1 && !agreed()) return
    if (step() < 3) {
      setStep(step() + 1)
    } else {
      completeOnboarding()
    }
  }

  function prevStep() {
    if (step() > 1) {
      setStep(step() - 1)
    }
  }

  function completeOnboarding() {
    localStorage.setItem("agence.onboarded", "true")
    localStorage.setItem("agence.selected_theme", selectedTheme())
    localStorage.setItem("agence.selected_plugins", JSON.stringify(selectedPlugins()))
    props.onComplete()
  }

  return (
    <div class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#131010] text-white select-none">
      {/* Background Graphic Grid */}
      <div class="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-20" />
      <div class="absolute inset-0 bg-[radial-gradient(circle_800px_at_50%_-100px,#005fe515,transparent)] pointer-events-none" />

      {/* Main Card */}
      <div class="relative w-full max-w-2xl px-8 py-10 rounded-2xl border border-white/10 bg-[#1e1e24] shadow-2xl flex flex-col gap-8">
        
        {/* Header with logo */}
        <div class="flex flex-col items-center gap-3">
          <div class="size-16 flex items-center justify-center text-[#005fe5]">
            <Logo class="size-12" />
          </div>
          <div class="h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent mt-1" />
        </div>

        {/* Step 1: Security Notice */}
        <Show when={step() === 1}>
          <div class="flex flex-col gap-6">
            <h2 class="text-20-medium text-center text-[#005fe5]">Security Notice & Data Use</h2>
            <div class="text-14-regular text-white/70 leading-relaxed bg-black/20 p-5 rounded-xl border border-white/5 flex flex-col gap-4">
              <p>
                AI coding agents are known to have certain security limitations. Users should be aware of potential
                risks, including data exfiltration and possible code execution.
              </p>
              <p class="text-white/50">
                Avoid processing highly sensitive data and verify all the actions taken by the agent on your machine.
              </p>
            </div>
            <label class="flex items-start gap-3 mt-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={agreed()}
                onChange={(e) => setAgreed(e.currentTarget.checked)}
                class="mt-1 size-4 rounded border-white/20 bg-white/5 text-[#005fe5] focus:ring-[#005fe5]"
              />
              <span class="text-12-regular text-white/60 group-hover:text-white/80 transition-colors select-none">
                Yes, I agree to help improve Agence by allowing the collection and use of my interaction data,
                subject to the <span class="text-[#005fe5] hover:underline">Terms of Service</span> and{" "}
                <span class="text-[#005fe5] hover:underline">Privacy Policy</span>.
              </span>
            </label>
          </div>
        </Show>

        {/* Step 2: Theme Selector */}
        <Show when={step() === 2}>
          <div class="flex flex-col gap-6">
            <h2 class="text-20-medium text-center text-[#005fe5]">Select Agence Theme</h2>
            <div class="grid grid-cols-3 gap-4 mt-2">
              <For each={["system", "light", "dark"] as const}>
                {(mode) => (
                  <button
                    type="button"
                    onClick={() => handleThemeSelect(mode)}
                    classList={{
                      "flex flex-col items-center gap-4 p-5 rounded-xl border transition-all text-center": true,
                      "border-[#005fe5] bg-[#005fe5]/10": selectedTheme() === mode,
                      "border-white/10 bg-black/10 hover:border-white/20": selectedTheme() !== mode,
                    }}
                  >
                    {/* Visual representation of theme */}
                    <div
                      classList={{
                        "w-full aspect-video rounded-md border flex items-stretch overflow-hidden relative shadow-inner": true,
                        "border-white/20": selectedTheme() === mode,
                        "border-white/10": selectedTheme() !== mode,
                      }}
                    >
                      <Show when={mode === "light"}>
                        <div class="w-1/3 bg-[#f3f3f3]" />
                        <div class="w-2/3 bg-white" />
                      </Show>
                      <Show when={mode === "dark"}>
                        <div class="w-1/3 bg-[#131010]" />
                        <div class="w-2/3 bg-[#232328]" />
                      </Show>
                      <Show when={mode === "system"}>
                        <div class="w-1/3 bg-[#f3f3f3]" />
                        <div class="w-2/3 bg-white relative">
                          <div class="absolute inset-0 bg-gradient-to-tr from-[#131010] to-[#232328] [clip-path:polygon(0_100%,100%_0,100%_100%)]" />
                        </div>
                      </Show>
                    </div>
                    <span class="text-14-medium capitalize">{mode}</span>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Step 3: Plugins Installer */}
        <Show when={step() === 3}>
          <div class="flex flex-col gap-4 max-h-[420px]">
            <div class="flex flex-col gap-1 text-center">
              <h2 class="text-20-medium text-[#005fe5]">Build with Plugins</h2>
              <p class="text-12-regular text-white/50 px-8">
                Plugins are packaged collections of skills and MCPs to help the Agent in Agence work with your developer tools. You can always change your choices in Settings.
              </p>
            </div>

            <div class="flex flex-col gap-2 overflow-y-auto pr-1 bg-black/10 p-3 rounded-xl border border-white/5 mt-2">
              <For each={pluginsList}>
                {(plugin) => (
                  <label class="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group">
                    <div class="flex flex-col gap-0.5">
                      <span class="text-14-medium text-white group-hover:text-[#005fe5] transition-colors">{plugin.name}</span>
                      <span class="text-12-regular text-white/40">{plugin.description}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedPlugins().includes(plugin.id)}
                      onChange={() => togglePlugin(plugin.id)}
                      class="size-5 rounded border-white/20 bg-white/5 text-[#005fe5] focus:ring-[#005fe5]"
                    />
                  </label>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Navigation & Indicators */}
        <div class="flex flex-col gap-6 mt-2">
          {/* Indicators */}
          <div class="flex justify-center gap-2">
            <For each={[1, 2, 3]}>
              {(idx) => (
                <div
                  classList={{
                    "size-2 rounded-full transition-all duration-300": true,
                    "bg-[#005fe5] w-5": step() === idx,
                    "bg-white/20": step() !== idx,
                  }}
                />
              )}
            </For>
          </div>

          {/* Action Buttons */}
          <div class="flex justify-between items-center">
            <button
              type="button"
              onClick={prevStep}
              classList={{
                "px-5 py-2.5 rounded-lg text-14-medium transition-all": true,
                "text-white/40 hover:text-white/80": step() > 1,
                "opacity-0 pointer-events-none": step() === 1,
              }}
            >
              Previous
            </button>

            <button
              type="button"
              onClick={nextStep}
              disabled={step() === 1 && !agreed()}
              classList={{
                "px-8 py-2.5 rounded-lg text-14-medium font-semibold transition-all shadow-md": true,
                "bg-[#005fe5] text-white hover:bg-[#005fe5]/90": step() > 1 || agreed(),
                "bg-white/5 text-white/20 cursor-not-allowed": step() === 1 && !agreed(),
              }}
            >
              {step() === 3 ? "Get Started" : "Next"}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
