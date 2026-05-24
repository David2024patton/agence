const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://github.com/David2024patton/agence" : `https://${stage}.opencode.ai`,
  console: stage === "production" ? "https://github.com/David2024patton/agence/auth" : `https://${stage}.opencode.ai/auth`,
  email: "contact@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/anomalyco/agence",
  discord: "https://github.com/David2024patton/agence/discord",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
