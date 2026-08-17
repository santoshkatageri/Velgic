import { create } from 'zustand'
import type { Item, Experiment } from '../types'

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
