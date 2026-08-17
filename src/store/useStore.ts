import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Item, Experiment, Stage, ContentItem, Campaign, PlatformContent, PlatformKey, ContentTypeKey } from '../types'
import { seedItems, seedExperiments, seedContents, seedCampaigns, seedPlatformContents } from '../data/seed'
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

        set((state) => ({
          contents: [content, ...state.contents],
          campaigns: [campaign, ...state.campaigns],
          platformContents: [...state.platformContents, ...platformContents],
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
        }),
    }),
    {
      name: 'velgic',
      version: 2,
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
        state.platformContents = pcs.map((pc) => ({ ...pc, notes: pc.notes ?? '' }))

        return state as StoreState
      },
    },
  ),
)
