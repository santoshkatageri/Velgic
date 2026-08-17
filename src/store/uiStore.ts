import { create } from 'zustand'
import type { Item, Experiment, ContentItem, ContentOrigin, ContentTypeKey } from '../types'

export interface ContentPrefill {
  origin: ContentOrigin
  ideaId?: string
  experimentId?: string
  title?: string
  concept?: string
  audience?: string
  notes?: string
  contentType?: ContentTypeKey
  format?: string
}

interface UIState {
  // Idea editor drawer
  editorOpen: boolean
  editorItem: Item | null
  openEditor: (item?: Item | null) => void
  closeEditor: () => void

  // Experiment editor drawer
  experimentOpen: boolean
  experimentItem: Experiment | null
  experimentPrefill: string
  openExperimentEditor: (experiment?: Experiment | null, prefillName?: string) => void
  closeExperimentEditor: () => void

  // Content editor drawer (V2)
  contentEditorOpen: boolean
  contentEditorItem: ContentItem | null
  contentPrefill: ContentPrefill | null
  openContentEditor: (opts?: { content?: ContentItem | null; prefill?: ContentPrefill | null }) => void
  closeContentEditor: () => void

  // Confirm dialog
  confirmMessage: string | null
  confirmResolve: ((value: boolean) => void) | null
  requestConfirm: (message: string) => Promise<boolean>
  resolveConfirm: (value: boolean) => void
}

export const useUI = create<UIState>((set, get) => ({
  editorOpen: false,
  editorItem: null,
  openEditor: (item = null) => set({ editorOpen: true, editorItem: item }),
  closeEditor: () => set({ editorOpen: false, editorItem: null }),

  experimentOpen: false,
  experimentItem: null,
  experimentPrefill: '',
  openExperimentEditor: (experiment = null, prefillName = '') =>
    set({ experimentOpen: true, experimentItem: experiment, experimentPrefill: prefillName }),
  closeExperimentEditor: () => set({ experimentOpen: false, experimentItem: null, experimentPrefill: '' }),

  contentEditorOpen: false,
  contentEditorItem: null,
  contentPrefill: null,
  openContentEditor: (opts = {}) =>
    set({
      contentEditorOpen: true,
      contentEditorItem: opts.content ?? null,
      contentPrefill: opts.prefill ?? null,
    }),
  closeContentEditor: () => set({ contentEditorOpen: false, contentEditorItem: null, contentPrefill: null }),

  confirmMessage: null,
  confirmResolve: null,
  requestConfirm: (message) =>
    new Promise<boolean>((resolve) => {
      set({ confirmMessage: message, confirmResolve: resolve })
    }),
  resolveConfirm: (value) => {
    const r = get().confirmResolve
    if (r) r(value)
    set({ confirmMessage: null, confirmResolve: null })
  },
}))
