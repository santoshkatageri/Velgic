import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Item, Experiment, Stage } from '../types'
import { seedItems, seedExperiments } from '../data/seed'
import { nowIso } from '../lib/utils'

interface StoreState {
  items: Item[]
  experiments: Experiment[]
  dismissed: string[]

  addItem: (item: Item) => void
  updateItem: (id: string, patch: Partial<Item>) => void
  deleteItem: (id: string) => void
  moveItem: (id: string, stage: Stage) => void

  addExperiment: (experiment: Experiment) => void
  updateExperiment: (id: string, patch: Partial<Experiment>) => void
  deleteExperiment: (id: string) => void

  dismiss: (id: string) => void
  resetData: () => void
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      items: seedItems,
      experiments: seedExperiments,
      dismissed: [],

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

      dismiss: (id) => set((s) => ({ dismissed: [...s.dismissed, id] })),

      resetData: () =>
        set({
          items: JSON.parse(JSON.stringify(seedItems)),
          experiments: JSON.parse(JSON.stringify(seedExperiments)),
          dismissed: [],
        }),
    }),
    {
      name: 'velgic',
      version: 1,
    },
  ),
)
