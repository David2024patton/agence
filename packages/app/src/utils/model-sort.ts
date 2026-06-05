export function isZenProvider(providerID: string) {
  return providerID === "agence" || providerID === "opencode"
}

export function isZenFreeModel(providerID: string, cost: { input: number } | undefined) {
  return isZenProvider(providerID) && (!cost || cost.input === 0)
}

type ModelSortItem = {
  name: string
  provider: { id: string }
  cost?: { input: number }
}

/** Within one provider group: free Zen models first, then name. */
export function compareModelsFreeFirst(a: ModelSortItem, b: ModelSortItem) {
  const aFree = isZenFreeModel(a.provider.id, a.cost)
  const bFree = isZenFreeModel(b.provider.id, b.cost)
  if (aFree !== bFree) return aFree ? -1 : 1
  return a.name.localeCompare(b.name)
}

/** Flat list: group by provider id, free Zen models first in each provider. */
export function compareModelsByProviderFreeFirst(a: ModelSortItem, b: ModelSortItem) {
  const byProvider = a.provider.id.localeCompare(b.provider.id)
  if (byProvider !== 0) return byProvider
  return compareModelsFreeFirst(a, b)
}
