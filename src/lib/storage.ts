/**
 * Asset storage abstraction.
 *
 * Velgic never embeds media inside the publishing manifest — assets are
 * referenced by a `reference` string that is resolved by the active
 * StorageProvider.
 *
 * V2 ships with a local/reference implementation only (references are plain
 * relative paths the user manages themselves). Google Drive and Cloudflare R2
 * providers can be added later behind this same interface without touching
 * the rest of the app:
 *
 *   class GoogleDriveProvider implements StorageProvider {
 *     name = 'gdrive'
 *     kind = 'remote'
 *     resolve(reference: string) {
 *       return `https://drive.google.com/…/${reference}`
 *     }
 *     validateReference(reference: string) {
 *       return reference.startsWith('gdrive/') ? null : 'Drive references must start with "gdrive/".'
 *     }
 *   }
 *   configureStorageProvider(new GoogleDriveProvider())
 */

export interface StorageProvider {
  /** Stable provider name, recorded on asset references ("local", "gdrive", "r2"). */
  name: string
  kind: 'local' | 'remote'
  /** Resolve an asset reference to a usable location, or null if unknown. */
  resolve(reference: string): string | null
  /** Return an error message for a malformed reference, or null when valid. */
  validateReference(reference: string): string | null
}

/** Local, reference-only storage: references are relative paths managed by the user. */
export class LocalStorageProvider implements StorageProvider {
  name: string = 'local'
  kind: 'local' = 'local'

  resolve(reference: string): string | null {
    return reference.trim() ? reference : null
  }

  validateReference(reference: string): string | null {
    if (!reference.trim()) return 'Reference cannot be empty.'
    if (reference.startsWith('/') || /^[a-z]+:\/\//i.test(reference)) {
      return 'Local references should be relative paths like "instagram/reel.mp4".'
    }
    return null
  }
}

let activeProvider: StorageProvider = new LocalStorageProvider()

export function getStorageProvider(): StorageProvider {
  return activeProvider
}

export function configureStorageProvider(provider: StorageProvider): void {
  activeProvider = provider
}
