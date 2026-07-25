import { create } from 'zustand'

type GlnEquipmentState = {
  systemId: string | null
  setSystemId: (systemId: string | null) => void
}

export const useGlnEquipmentStore = create<GlnEquipmentState>((set) => ({
  systemId: null,
  setSystemId: (systemId) => set({ systemId }),
}))
