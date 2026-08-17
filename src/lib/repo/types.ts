import type {
  AssetRef,
  Campaign,
  ContentItem,
  ContentTypeKey,
  Experiment,
  Item,
  PlatformContent,
  PlatformKey,
  Stage,
} from '../../types'
import type { VelgicManifest, ManifestIssue } from '../manifest'

/**
 * Velgic V3 — Repository interface (Phase 1 type-only declaration).
 *
 * `LocalRepository` is the existing V2 `useStore` (Zustand + persist; identity
 * mapping — it already satisfies this interface by signature). No parallel
 * implementation, no OfflineAdapter wrapper. This declaration is the boundary
 * that `SupabaseRepository` (Phase 6) will implement against.
 *
 * Reads continue to happen via Zustand selectors (Phase 6 wires cache
 * hydration). Method signatures mirror the V2 store actions so every page
 * keeps compiling.
 */
export interface VelgicRepository {
  /* -------------------------------- Decision layer -------------------------------- */

  /** Add a new Idea / Pipeline / Published `Item`. */
  addItem(input: Item): void
  /** Patch a subset of fields on `Item`; bumps `updatedAt`. */
  updateItem(id: string, patch: Partial<Item>): void
  /** Remove the `Item` from the store. */
  deleteItem(id: string): void
  /** Move an `Item` along the Pipeline (`Ideas → Research → Script → Production → Published`). */
  moveItem(id: string, stage: Stage): void

  /** Add a new experiment record. */
  addExperiment(input: Experiment): void
  /** Patch a subset of fields on an experiment; bumps `updatedAt`. */
  updateExperiment(id: string, patch: Partial<Experiment>): void
  /** Remove the experiment. */
  deleteExperiment(id: string): void

  /* ------------------------------- Distribution layer ------------------------------ */

  /** Add a new first-class Content concept. */
  addContent(input: ContentItem): void
  /** Patch a subset of fields on Content; bumps `updatedAt`. */
  updateContent(id: string, patch: Partial<ContentItem>): void
  /**
   * Delete a Content item. Cascades to its campaigns and the platform
   * versions they own (matching V2's `deleteContent` reducer).
   */
  deleteContent(id: string): void

  /**
   * Create a multi-platform Campaign bound to a Content concept; seeds one
   * PlatformContent per requested platform. Returns the new campaign id.
   */
  createCampaign(input: {
    name: string
    description: string
    contentId: string
    platforms: PlatformKey[]
    contentType: ContentTypeKey
  }): string

  /** Patch a subset of fields on `Campaign`; bumps `updatedAt`. */
  updateCampaign(id: string, patch: Partial<Campaign>): void
  /**
   * Delete a campaign. Cascades to its platform versions (matching V2's
   * `deleteCampaign` reducer).
   */
  deleteCampaign(id: string): void

  /** Add a PlatformContent to a campaign; mirrors `platforms[]` on the campaign. */
  addPlatformContent(
    campaignId: string,
    platform: PlatformKey,
    contentType: ContentTypeKey | null,
  ): void

  /** Patch a subset of fields on a PlatformContent; bumps `updatedAt`. */
  updatePlatformContent(id: string, patch: Partial<PlatformContent>): void
  /**
   * Delete a PlatformContent. Recomputes the parent campaign's `platforms[]`
   * mirror (matching V2's `deletePlatformContent` reducer).
   */
  deletePlatformContent(id: string): void

  /* ----------------------------------- Asset library -------------------------------- */

  /** Add an asset to the reusable library. Normalizes `createdAt` / `notes`. */
  addAsset(input: AssetRef): void
  /**
   * Patch library fields and propagate the same patch to every reference
   * (matching V2's `updateAsset` reducer — per-usage `role` is preserved).
   */
  updateAsset(id: string, patch: Partial<AssetRef>): void
  /**
   * Attempt to delete an asset. Returns whether deletion succeeded and the
   * list of usages if blocked (referenced by one or more platform versions).
   */
  deleteAsset(id: string): {
    deleted: boolean
    usages: Array<{ platformContentId: string; campaignId: string; platform: PlatformKey }>
  }

  /**
   * Attach a library asset to a PlatformContent. Idempotent (a platform
   * version references each asset at most once).
   */
  attachAssetToPlatform(
    platformContentId: string,
    assetId: string,
    role?: string | null,
  ): void

  /* ----------------------------------- Misc / domain --------------------------------- */

  /** Mark an Idea dismissal so the recommendation engine stops surfacing it. */
  dismiss(id: string): void

  /**
   * Validate + import a Velgic Publishing Manifest atomically. On any
   * validation issue the manifest is rejected wholesale — V2's invariant.
   * Returns the new campaign id, or the validation issues.
   */
  importCampaign(
    manifest: VelgicManifest,
  ): { issues: ManifestIssue[]; campaignId?: string }

  /** Reset every collection to the V2-seeded baseline. */
  resetData(): void
}

/** Which Repository implementation is currently active. Phase 1 = 'local' only. */
export type RepositoryName = 'local' | 'supabase'

/**
 * Local repository marker — the interface itself is satisfied by the V2
 * `useStore` (Zustand + persist). No separate type or class is introduced.
 *
 * Phase 6 will introduce `SupabaseRepository` satisfying `VelgicRepository`;
 * until then, callers stay on `useStore` directly.
 */
export type LocalRepository = VelgicRepository

/** Re-export `VelgicManifest` / `ManifestIssue` for convenience at the repo boundary. */
export type { VelgicManifest, ManifestIssue }
