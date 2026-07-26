import type { IfcResidentialSourceGraph } from '@pascal-app/ifc-converter'
import { create } from 'zustand'

type GlnIfcReferenceState = {
  references: Record<string, IfcResidentialSourceGraph>
  removeReference: (importId: string) => void
  setReference: (importId: string, graph: IfcResidentialSourceGraph) => void
}

export const useGlnIfcReferenceStore = create<GlnIfcReferenceState>((set) => ({
  references: {},
  setReference: (importId, graph) =>
    set((state) => ({
      references: { ...state.references, [importId]: graph },
    })),
  removeReference: (importId) =>
    set((state) => {
      const references = { ...state.references }
      delete references[importId]
      return { references }
    }),
}))
