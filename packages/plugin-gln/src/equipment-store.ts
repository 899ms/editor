import { create } from 'zustand'
import type { GlnEquipmentInstallationAreaKind } from './equipment-installation-schema'

export type GlnHydronicCircuit = 'supply' | 'return'

type GlnEquipmentState = {
  readyKind: string | null
  setReadyKind: (kind: string | null) => void
  systemId: string | null
  setSystemId: (systemId: string | null) => void
  hydronicCircuit: GlnHydronicCircuit
  setHydronicCircuit: (circuit: GlnHydronicCircuit) => void
  showConcealedRoutes: boolean
  setShowConcealedRoutes: (show: boolean) => void
  installationAreaZoneId: string | null
  setInstallationAreaZoneId: (zoneId: string | null) => void
  installationAreaKind: GlnEquipmentInstallationAreaKind
  setInstallationAreaKind: (kind: GlnEquipmentInstallationAreaKind) => void
}

export const useGlnEquipmentStore = create<GlnEquipmentState>((set) => ({
  readyKind: null,
  setReadyKind: (readyKind) => set({ readyKind }),
  systemId: null,
  setSystemId: (systemId) => set({ systemId }),
  hydronicCircuit: 'supply',
  setHydronicCircuit: (hydronicCircuit) => set({ hydronicCircuit }),
  showConcealedRoutes: false,
  setShowConcealedRoutes: (showConcealedRoutes) => set({ showConcealedRoutes }),
  installationAreaZoneId: null,
  setInstallationAreaZoneId: (installationAreaZoneId) => set({ installationAreaZoneId }),
  installationAreaKind: 'unassigned',
  setInstallationAreaKind: (installationAreaKind) => set({ installationAreaKind }),
}))
