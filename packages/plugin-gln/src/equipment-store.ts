import { create } from 'zustand'

type GlnEquipmentState = {
  readyKind: string | null
  setReadyKind: (kind: string | null) => void
  systemId: string | null
  setSystemId: (systemId: string | null) => void
}

export const useGlnEquipmentStore = create<GlnEquipmentState>((set) => ({
  readyKind: null,
  setReadyKind: (readyKind) => set({ readyKind }),
  systemId: null,
  setSystemId: (systemId) => set({ systemId }),
}))
