import localforage from 'localforage'

const STORAGE_KEY = 'muon-docs-cache'

localforage.config({
  name: STORAGE_KEY
})

type muon_docs = {
  tier: muon_docs
  linuxSupport: boolean
  lastUpdated: string
}

export async function updateCache(appId: string, newData: muon_docs) {
  const oldCache = await localforage.getItem<muon_docs>(appId)
  const newCache: muon_docs = { ...oldCache, ...newData }
  await localforage.setItem(appId, newCache)
  return newCache
}

export function clearCache(appId?: string) {
  if (appId?.length) {
    localforage.removeItem(appId)
  } else {
    localforage.clear()
  }
}

export async function getCache(appId: string): Promise<muon_docs | null> {
  const data = await localforage.getItem<muon_docs>(appId)
  return data
}