import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Item, Experiment, Stage, ContentItem, Campaign, PlatformContent, PlatformKey, ContentTypeKey, AssetRef } from '../types'
import { seedItems, seedExperiments, seedContents, seedCampaigns, seedPlatformContents, seedAssets } from '../data/seed'
import { nowIso, uid } from '../lib/utils'
import { blankPlatformContent, deriveCampaignStatus, normalizeCampaignStatus, normalizeContentStatus } from '../lib/content'
import { manifestToEntities, validateManifest, type ManifestIssue, type VelgicManifest } from '../lib/manifest'

interface StoreState {
  items: Item[]
  experiments: Experiment[]
  dismissed: string[]

  // V2 — Content + Campaigns + Platform content
  contents: ContentItem[]
  campaigns: Campaign[]
  platformContents: PlatformContent[]

  // Asset library — reusable, reference-only assets (no binary media).
  assets: AssetRef[]

  addItem: (item: Item) => void
  updateItem: (id: string, patch: Partial<Item>) => void
  deleteItem: (id: string) => void
  moveItem: (id: string, stage: Stage) => void

  addExperiment: (experiment: Experiment) => void
  updateExperiment: (id: string, patch: Partial<Experiment>) => void
  deleteExperiment: (id: string) => void

  addContent: (content: ContentItem) => void
  updateContent: (id: string, patch: Partial<ContentItem>) => void
  deleteContent: (id: string) => void

  updateCampaign: (id: string, patch: Partial<Campaign>) => void
  deleteCampaign: (id: string) => void

  createCampaign: (input: {
    name: string
    description: string
    contentId: string
    platforms: PlatformKey[]
    contentType: ContentTypeKey
  }) => string

  addPlatformContent: (campaignId: string, platform: PlatformKey, contentType: ContentTypeKey | null) => void
  updatePlatformContent: (id: string, patch: Partial<PlatformContent>) => void
  deletePlatformContent: (id: string) => void

  addAsset: (asset: AssetRef) => void
  updateAsset: (id: string, patch: Partial<AssetRef>) => void
  /** Deletion is blocked while the asset is referenced by any platform version. */
  deleteAsset: (id: string) => { deleted: boolean; usages: Array<{ platformContentId: string; campaignId: string; platform: PlatformKey }> }
  /** Attach a library asset to a platform version (reusable across campaigns). */
  attachAssetToPlatform: (platformContentId: string, assetId: string, role?: string | null) => void

  /** Validate + import a manifest atomically. Returns issues when rejected. */
  importCampaign: (manifest: VelgicManifest) => { issues: ManifestIssue[]; campaignId?: string }

  dismiss: (id: string) => void
  resetData: () => void
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      items: seedItems,
      experiments: seedExperiments,
      dismissed: [],

      contents: seedContents,
      campaigns: seedCampaigns,
      platformContents: seedPlatformContents,
      assets: seedAssets,

      addItem: (item) => set((s) => ({ items: [item, ...s.items] })),

      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: nowIso() } : i)),
        })),

      deleteItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      moveItem: (id, stage) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, stage, updatedAt: nowIso() } : i)),
        })),

      addExperiment: (experiment) => set((s) => ({ experiments: [experiment, ...s.experiments] })),

      updateExperiment: (id, patch) =>
        set((s) => ({
          experiments: s.experiments.map((e) => (e.id === id ? { ...e, ...patch, updatedAt: nowIso() } : e)),
        })),

      deleteExperiment: (id) =>
        set((s) => ({ experiments: s.experiments.filter((e) => e.id !== id) })),

      /* ------------------------ V2 content actions ------------------------ */

      addContent: (content) => set((s) => ({ contents: [content, ...s.contents] })),

      updateContent: (id, patch) =>
        set((s) => ({
          contents: s.contents.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: nowIso() } : c)),
        })),

      // Deleting content cascades to its campaigns and their platform versions.
      deleteContent: (id) =>
        set((s) => {
          const campaignIds = s.campaigns.filter((c) => c.contentId === id).map((c) => c.id)
          return {
            contents: s.contents.filter((c) => c.id !== id),
            campaigns: s.campaigns.filter((c) => c.contentId !== id),
            platformContents: s.platformContents.filter((pc) => !campaignIds.includes(pc.campaignId)),
          }
        }),

      updateCampaign: (id, patch) =>
        set((s) => ({
          campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: nowIso() } : c)),
        })),

      // Deleting a campaign cascades to its platform versions.
      deleteCampaign: (id) =>
        set((s) => ({
          campaigns: s.campaigns.filter((c) => c.id !== id),
          platformContents: s.platformContents.filter((pc) => pc.campaignId !== id),
        })),

      createCampaign: ({ name, description, contentId, platforms, contentType }) => {
        const id = uid()
        const now = nowIso()
        const campaign: Campaign = {
          id,
          name,
          description,
          contentId,
          platforms,
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        }
        const platformContents = platforms.map((platform) => blankPlatformContent(id, platform, contentType))
        set((s) => ({
          campaigns: [campaign, ...s.campaigns],
          platformContents: [...s.platformContents, ...platformContents],
        }))
        return id
      },

      addPlatformContent: (campaignId, platform, contentType) =>
        set((s) => ({
          platformContents: [...s.platformContents, blankPlatformContent(campaignId, platform, contentType)],
          campaigns: s.campaigns.map((c) =>
            c.id === campaignId && !c.platforms.includes(platform)
              ? { ...c, platforms: [...c.platforms, platform], updatedAt: nowIso() }
              : c,
          ),
        })),

      updatePlatformContent: (id, patch) =>
        set((s) => ({
          platformContents: s.platformContents.map((pc) => (pc.id === id ? { ...pc, ...patch, updatedAt: nowIso() } : pc)),
        })),

      deletePlatformContent: (id) =>
        set((s) => {
          const removed = s.platformContents.find((pc) => pc.id === id)
          const platformContents = s.platformContents.filter((pc) => pc.id !== id)
          const campaigns = removed
            ? s.campaigns.map((c) => {
                if (c.id !== removed.campaignId) return c
                const platforms = [...new Set(platformContents.filter((pc) => pc.campaignId === c.id).map((pc) => pc.platform))]
                return { ...c, platforms, updatedAt: nowIso() }
              })
            : s.campaigns
          return { platformContents, campaigns }
        }),

      /* ------------------------ V2 asset library ------------------------ */

      addAsset: (asset) =>
        set((s) => ({
          assets: [{ ...asset, createdAt: asset.createdAt ?? nowIso(), notes: asset.notes ?? '' }, ...s.assets],
        })),

      // Updates the library entry AND every platform reference to it (the
      // platform copies keep their own role — the same asset can be a video in
      // one place and a thumbnail in another).
      updateAsset: (id, patch) =>
        set((s) => ({
          assets: s.assets.map((a) => (a.asset_id === id ? { ...a, ...patch } : a)),
          platformContents: s.platformContents.map((pc) => ({
            ...pc,
            assets: pc.assets.map((a) => (a.asset_id === id ? { ...a, ...patch, role: a.role } : a)),
          })),
        })),

      deleteAsset: (id) => {
        const s = get()
        const usages = s.platformContents
          .filter((pc) => pc.assets.some((a) => a.asset_id === id))
          .map((pc) => ({ platformContentId: pc.id, campaignId: pc.campaignId, platform: pc.platform }))
        if (usages.length > 0) return { deleted: false, usages }
        set((state) => ({ assets: state.assets.filter((a) => a.asset_id !== id) }))
        return { deleted: true, usages: [] }
      },

      attachAssetToPlatform: (platformContentId, assetId, role) =>
        set((s) => {
          const lib = s.assets.find((a) => a.asset_id === assetId)
          if (!lib) return s
          return {
            platformContents: s.platformContents.map((pc) =>
              pc.id === platformContentId
                ? pc.assets.some((a) => a.asset_id === assetId)
                  ? pc
                  : { ...pc, assets: [...pc.assets, { ...lib, role: role ?? lib.role ?? 'media' }] }
                : pc,
            ),
          }
        }),

      importCampaign: (manifest) => {
        const issues = validateManifest(manifest)
        if (issues.length > 0) return { issues }

        const s = get()
        const { content, campaign, platformContents } = manifestToEntities(manifest, {
          ideaIds: s.items.map((i) => i.id),
          experimentIds: s.experiments.map((e) => e.id),
          contentIds: s.contents.map((c) => c.id),
          campaignIds: s.campaigns.map((c) => c.id),
          platformContentIds: s.platformContents.map((pc) => pc.id),
        })

        // Register imported assets in the reusable library. Identical asset
        // (same id + reference) → shared with the existing library entry;
        // colliding id with different content → uniquified id.
        const library = [...s.assets]
        const byId = new Map(library.map((a) => [a.asset_id, a]))
        const now = nowIso()
        const platformContentsWithAssets = platformContents.map((pc) => ({
          ...pc,
          assets: pc.assets.map((a) => {
            const existing = byId.get(a.asset_id)
            if (existing && existing.reference === a.reference) return a
            const normalized: AssetRef = existing
              ? { ...a, asset_id: `${a.asset_id}-${uid().slice(0, 6)}` }
              : { ...a, createdAt: now, notes: a.notes ?? '' }
            byId.set(normalized.asset_id, normalized)
            library.push(normalized)
            return normalized
          }),
        }))

        set((state) => ({
          contents: [content, ...state.contents],
          campaigns: [campaign, ...state.campaigns],
          platformContents: [...state.platformContents, ...platformContentsWithAssets],
          assets: library,
        }))
        return { issues: [], campaignId: campaign.id }
      },

      dismiss: (id) => set((s) => ({ dismissed: [...s.dismissed, id] })),

      resetData: () =>
        set({
          items: JSON.parse(JSON.stringify(seedItems)),
          experiments: JSON.parse(JSON.stringify(seedExperiments)),
          dismissed: [],
          contents: JSON.parse(JSON.stringify(seedContents)),
          campaigns: JSON.parse(JSON.stringify(seedCampaigns)),
          platformContents: JSON.parse(JSON.stringify(seedPlatformContents)),
          assets: JSON.parse(JSON.stringify(seedAssets)),
        }),
    }),
    {
      name: 'velgic',
      version: 3,
      migrate: (persisted, version) => {
        // Handle V1 payloads (ideas/experiments only) and earlier V2 payloads
        // missing the content model — and patch fields added later, so stored
        // data survives upgrades without a full reset.
        const state = (persisted ?? {}) as Partial<StoreState> & Record<string, unknown>

        if (!Array.isArray(state.contents)) state.contents = JSON.parse(JSON.stringify(seedContents))
        if (!Array.isArray(state.campaigns)) state.campaigns = JSON.parse(JSON.stringify(seedCampaigns))
        if (!Array.isArray(state.platformContents)) state.platformContents = JSON.parse(JSON.stringify(seedPlatformContents))

        // Normalize content statuses to the current enum (legacy scheduled/failed → aliases).
        state.contents = (state.contents as ContentItem[]).map((c) => ({ ...c, status: normalizeContentStatus(c.status) }))

        // Backfill campaign status + platforms, and platform-version notes.
        const pcs = state.platformContents as PlatformContent[]
        state.campaigns = (state.campaigns as Campaign[]).map((c) => {
          const campaignPcs = pcs.filter((pc) => pc.campaignId === c.id)
          const status = normalizeCampaignStatus(c.status, campaignPcs)
          return {
            ...c,
            status,
            platforms: (c.platforms?.length ? c.platforms : [...new Set(campaignPcs.map((pc) => pc.platform))]) as Campaign['platforms'],
          }
        })
        state.platformContents = pcs.map((pc) => ({ ...pc, notes: pc.notes ?? '', metrics: pc.metrics ?? null }))

        // Build the reusable asset library from platform references when
        // missing (deduplicated by asset_id), and normalize library fields.
        const now = nowIso()
        if (!Array.isArray(state.assets)) {
          const map = new Map<string, AssetRef>()
          for (const pc of state.platformContents as PlatformContent[]) {
            for (const a of pc.assets) {
              if (!map.has(a.asset_id)) {
                map.set(a.asset_id, { ...a, createdAt: a.createdAt ?? now, notes: a.notes ?? '' })
              }
            }
          }
          state.assets = [...map.values()]
        } else {
          state.assets = (state.assets as AssetRef[]).map((a) => ({ ...a, createdAt: a.createdAt ?? now, notes: a.notes ?? '' }))
        }

        return state as StoreState
      },
    },
  ),
)
