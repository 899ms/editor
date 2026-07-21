import type { BuildStats, SchemaIssue, ValidateBuildJsonResult } from '@pascal-app/core'
import { usePascalTranslation } from '@pascal-app/i18n'
import { useViewer } from '@pascal-app/viewer'
import {
  AlertTriangle,
  AppWindow,
  Box,
  Building2,
  CheckCircle2,
  DoorOpen,
  Layers,
  MapPin,
  Scan,
  Square,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../../../components/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../components/ui/primitives/dialog'
import {
  getAreaUnitLabel,
  type LinearUnit,
  squareMetersToAreaUnit,
} from '../../../../../lib/measurements'

export type PendingImport = {
  fileName: string
  fileSizeBytes: number
  result: ValidateBuildJsonResult
}

type Props = {
  pending: PendingImport | null
  onCancel: () => void
  onConfirm: (parsed: NonNullable<ValidateBuildJsonResult['parsed']>) => void
}

type StatRow = {
  icon: typeof Building2
  label: string
  count: number
}

type StatLabels = Record<
  | 'sites'
  | 'buildings'
  | 'levels'
  | 'walls'
  | 'doors'
  | 'windows'
  | 'items'
  | 'slabs'
  | 'ceilings'
  | 'zones'
  | 'scans',
  string
>

function statsRows(stats: BuildStats, labels: StatLabels): StatRow[] {
  return (
    [
      { icon: MapPin, label: labels.sites, count: stats.byType.site ?? 0 },
      { icon: Building2, label: labels.buildings, count: stats.byType.building ?? 0 },
      { icon: Layers, label: labels.levels, count: stats.byType.level ?? 0 },
      { icon: Square, label: labels.walls, count: stats.byType.wall ?? 0 },
      { icon: DoorOpen, label: labels.doors, count: stats.byType.door ?? 0 },
      { icon: AppWindow, label: labels.windows, count: stats.byType.window ?? 0 },
      { icon: Box, label: labels.items, count: stats.byType.item ?? 0 },
      { icon: Square, label: labels.slabs, count: stats.byType.slab ?? 0 },
      { icon: Square, label: labels.ceilings, count: stats.byType.ceiling ?? 0 },
      { icon: Square, label: labels.zones, count: stats.byType.zone ?? 0 },
      { icon: Scan, label: labels.scans, count: stats.byType.scan ?? 0 },
    ] satisfies StatRow[]
  ).filter((row) => row.count > 0)
}

function groupSchemaIssuesByType(
  issues: SchemaIssue[],
): { type: string; issues: SchemaIssue[] }[] {
  const groups = new Map<string, SchemaIssue[]>()
  for (const issue of issues) {
    const existing = groups.get(issue.nodeType)
    if (existing) {
      existing.push(issue)
    } else {
      groups.set(issue.nodeType, [issue])
    }
  }
  return Array.from(groups, ([type, list]) => ({ type, issues: list }))
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatFloorArea(m2: number, unit: LinearUnit): string {
  if (m2 === 0) return '—'
  const value = squareMetersToAreaUnit(m2, unit)
  const label = getAreaUnitLabel(unit)
  return `${value < 10 ? value.toFixed(2) : value.toFixed(1)} ${label}`
}

export function LoadBuildDialog({ pending, onCancel, onConfirm }: Props) {
  const { t } = usePascalTranslation('editor')
  const { t: commonT } = usePascalTranslation('common')
  const [showAllWarnings, setShowAllWarnings] = useState(false)
  const [showSchemaIssues, setShowSchemaIssues] = useState(false)
  const unit = useViewer((state) => state.unit)

  if (!pending) return null

  const { fileName, fileSizeBytes, result } = pending
  const { ok, parsed, stats, errors, warnings, schemaIssues, schemaIssueCount } = result
  const rows = statsRows(stats, {
    sites: t('settings.loadDialog.stats.sites'),
    buildings: t('settings.loadDialog.stats.buildings'),
    levels: t('settings.loadDialog.stats.levels'),
    walls: t('settings.loadDialog.stats.walls'),
    doors: t('settings.loadDialog.stats.doors'),
    windows: t('settings.loadDialog.stats.windows'),
    items: t('settings.loadDialog.stats.items'),
    slabs: t('settings.loadDialog.stats.slabs'),
    ceilings: t('settings.loadDialog.stats.ceilings'),
    zones: t('settings.loadDialog.stats.zones'),
    scans: t('settings.loadDialog.stats.scans'),
  })
  const visibleWarnings = showAllWarnings ? warnings : warnings.slice(0, 3)
  const hiddenWarningCount = warnings.length - visibleWarnings.length
  const schemaIssuesByType = groupSchemaIssuesByType(schemaIssues)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ok ? (
              <CheckCircle2 className="size-5 text-emerald-600" />
            ) : (
              <XCircle className="size-5 text-red-600" />
            )}
            {t(ok ? 'settings.loadDialog.ready' : 'settings.loadDialog.cannotImport')}
          </DialogTitle>
          <DialogDescription>
            {fileName} · {formatFileSize(fileSizeBytes)} · {t('settings.loadDialog.nodeCount', { count: stats.total })}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          {errors.length > 0 && (
            <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3">
              <div className="flex items-center gap-2 font-medium text-red-800 text-sm">
                <XCircle className="size-4" />
                {t('settings.loadDialog.errorCount', { count: errors.length })}
              </div>
              <ul className="space-y-1 text-red-700 text-xs">
                {errors.map((e) => (
                  <li key={`${e.code}-${e.nodeId ?? ''}`}>· {e.message}</li>
                ))}
              </ul>
            </div>
          )}

          {stats.total > 0 && (
            <div className="rounded-md border bg-card">
              <div className="border-b px-3 py-2 font-medium text-muted-foreground text-xs uppercase">
                {t('settings.loadDialog.structure')}
              </div>
              {rows.length > 0 ? (
                <div>
                  {rows.map((row, i) => {
                    const Icon = row.icon
                    return (
                      <div
                        className={`flex items-center justify-between px-3 py-2 ${
                          i === rows.length - 1 ? '' : 'border-b'
                        }`}
                        key={row.label}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="size-4 text-muted-foreground" />
                          <span className="text-sm">{row.label}</span>
                        </div>
                        <span className="font-medium text-sm">{row.count}</span>
                      </div>
                    )
                  })}
                  {stats.floorAreaM2 > 0 && (
                    <div className="flex items-center justify-between border-t px-3 py-2">
                      <span className="text-muted-foreground text-sm">
                        {t('settings.loadDialog.floorArea')}
                      </span>
                      <span className="font-medium text-sm">
                        {formatFloorArea(stats.floorAreaM2, unit)}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-3 py-4 text-center text-muted-foreground text-xs">
                  {t('settings.loadDialog.noRecognisedNodes')}
                </div>
              )}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 font-medium text-amber-800 text-sm">
                <AlertTriangle className="size-4" />
                {t('settings.loadDialog.warningCount', { count: warnings.length })}
              </div>
              <ul className="space-y-1 text-amber-700 text-xs">
                {visibleWarnings.map((w, i) => (
                  <li key={`${w.code}-${w.nodeId ?? ''}-${i}`}>· {w.message}</li>
                ))}
              </ul>
              {hiddenWarningCount > 0 && (
                <button
                  className="text-amber-800 text-xs underline hover:no-underline"
                  onClick={() => setShowAllWarnings(true)}
                  type="button"
                >
                  {t('settings.loadDialog.showMore', { count: hiddenWarningCount })}
                </button>
              )}
            </div>
          )}

          {schemaIssues.length > 0 && (
            <div className="space-y-2 rounded-md border bg-card p-3">
              <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setShowSchemaIssues((v) => !v)}
                type="button"
              >
                <span className="font-medium text-muted-foreground text-xs uppercase">
                  {t('settings.loadDialog.schemaDetails', { count: schemaIssueCount })}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t(showSchemaIssues ? 'settings.loadDialog.hide' : 'settings.loadDialog.show')}
                </span>
              </button>
              {showSchemaIssues && (
                <div className="space-y-3 pt-1">
                  {schemaIssuesByType.map(({ type, issues }) => (
                    <div className="space-y-1" key={type}>
                      <div className="font-medium text-xs">
                        {type} · {issues.length}
                      </div>
                      <ul className="space-y-0.5 text-muted-foreground text-xs">
                        {issues.map((issue) => (
                          <li className="font-mono" key={issue.nodeId}>
                            <span className="text-foreground">{issue.nodeId}</span>
                            {issue.path && <span> · {issue.path}</span>}
                            <span> — {issue.message}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onCancel} variant="outline">
            {commonT('actions.cancel')}
          </Button>
          <Button
            disabled={!ok || !parsed}
            onClick={() => {
              if (parsed) onConfirm(parsed)
            }}
          >
            {t('settings.loadDialog.replaceScene')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
