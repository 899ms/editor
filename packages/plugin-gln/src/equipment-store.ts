import { create } from 'zustand'
import type { GlnEquipmentInstallationAreaKind } from './equipment-installation-schema'

export type GlnHydronicCircuit = 'supply' | 'return'
export type GlnHydronicInstallationMode = 'ceiling' | 'wall' | 'through-wall'
export type GlnDisplayMode = 'edit' | 'run-preview'

type GlnEquipmentState = {
  readyKind: string | null
  setReadyKind: (kind: string | null) => void
  systemId: string | null
  setSystemId: (systemId: string | null) => void
  hydronicCircuit: GlnHydronicCircuit
  setHydronicCircuit: (circuit: GlnHydronicCircuit) => void
  hydronicInstallationMode: GlnHydronicInstallationMode
  setHydronicInstallationMode: (mode: GlnHydronicInstallationMode) => void
  hydronicServiceHeightM: number
  setHydronicServiceHeightM: (height: number) => void
  showConcealedRoutes: boolean
  setShowConcealedRoutes: (show: boolean) => void
  installationAreaZoneId: string | null
  setInstallationAreaZoneId: (zoneId: string | null) => void
  installationAreaKind: GlnEquipmentInstallationAreaKind
  setInstallationAreaKind: (kind: GlnEquipmentInstallationAreaKind) => void
  displayMode: GlnDisplayMode
  setDisplayMode: (mode: GlnDisplayMode) => void
}

export const useGlnEquipmentStore = create<GlnEquipmentState>((set) => ({
  readyKind: null,
  setReadyKind: (readyKind) => set({ readyKind }),
  systemId: null,
  setSystemId: (systemId) => set({ systemId }),
  hydronicCircuit: 'supply',
  setHydronicCircuit: (hydronicCircuit) => set({ hydronicCircuit }),
  hydronicInstallationMode: 'ceiling',
  setHydronicInstallationMode: (hydronicInstallationMode) => set({ hydronicInstallationMode }),
  hydronicServiceHeightM: 2.3,
  setHydronicServiceHeightM: (hydronicServiceHeightM) => set({ hydronicServiceHeightM }),
  showConcealedRoutes: false,
  setShowConcealedRoutes: (showConcealedRoutes) => set({ showConcealedRoutes }),
  installationAreaZoneId: null,
  setInstallationAreaZoneId: (installationAreaZoneId) => set({ installationAreaZoneId }),
  installationAreaKind: 'unassigned',
  setInstallationAreaKind: (installationAreaKind) => set({ installationAreaKind }),
  displayMode: 'edit',
  setDisplayMode: (displayMode) => set({ displayMode }),
}))
