import { create } from 'zustand'

export type GlnHydronicCircuit = 'supply' | 'return'

type GlnEquipmentState = {
  readyKind: string | null
  setReadyKind: (kind: string | null) => void
  systemId: string | null
  setSystemId: (systemId: string | null) => void
  hydronicCircuit: GlnHydronicCircuit
  setHydronicCircuit: (circuit: GlnHydronicCircuit) => void
}

export const useGlnEquipmentStore = create<GlnEquipmentState>((set) => ({
  readyKind: null,
  setReadyKind: (readyKind) => set({ readyKind }),
  systemId: null,
  setSystemId: (systemId) => set({ systemId }),
  hydronicCircuit: 'supply',
  setHydronicCircuit: (hydronicCircuit) => set({ hydronicCircuit }),
}))
