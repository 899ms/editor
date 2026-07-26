'use client'

import { useState } from 'react'
import GlnGlbImportPanel from './glb-import-panel'
import GlnIfcImportPanel from './ifc-import-panel'

type ImportKind = 'ifc' | 'glb'

export default function GlnResidentialImportPanel() {
  const [kind, setKind] = useState<ImportKind>('ifc')

  return (
    <div className="space-y-4 p-3" data-gln-residential-import-panel>
      <div className="grid grid-cols-2 border border-sidebar-border">
        {(['ifc', 'glb'] as const).map((value) => (
          <button
            aria-pressed={kind === value}
            className={`h-9 text-sm ${
              kind === value
                ? 'bg-sidebar-accent font-medium text-sidebar-foreground'
                : 'text-sidebar-foreground/60'
            }`}
            key={value}
            onClick={() => setKind(value)}
            type="button"
          >
            {value.toUpperCase()}
          </button>
        ))}
      </div>
      {kind === 'ifc' ? <GlnIfcImportPanel /> : <GlnGlbImportPanel />}
    </div>
  )
}
