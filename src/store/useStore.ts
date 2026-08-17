import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Item, Experiment, Stage, ContentItem, Campaign, PlatformContent, PlatformKey, ContentTypeKey } from '../types'
import { seedItems, seedExperiments, seedContents, seedCampaigns, seedPlatformContents } from '../data/seed'
import { nowIso, uid } from '../lib/utils'
import { blankPlatformContent } from '../lib/content'
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
        })),

      updatePlatformContent: (id, patch) =>
        set((s) => ({
          platformContents: s.platformContents.map((pc) => (pc.id === id ? { ...pc, ...patch, updatedAt: nowIso() } : pc)),
        })),

      deletePlatformContent: (id) =>
        set((s) => ({ platformContents: s.platformContents.filter((pc) => pc.id !== id) })),

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
      version: 1,
    },
  ),
)
