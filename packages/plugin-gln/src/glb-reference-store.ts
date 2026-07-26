import type { Object3D } from 'three'
import { create } from 'zustand'

type GlnGlbReferenceState = {
  references: Record<string, Object3D>
  removeReference: (importId: string) => void
  setReference: (importId: string, object: Object3D) => void
}

export const useGlnGlbReferenceStore = create<GlnGlbReferenceState>((set) => ({
  references: {},
  setReference: (importId, object) =>
    set((state) => ({
      references: { ...state.references, [importId]: object },
    })),
  removeReference: (importId) =>
    set((state) => {
      const references = { ...state.references }
      delete references[importId]
      return { references }
    }),
}))
