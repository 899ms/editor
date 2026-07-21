'use client'

import { Editor, ItemsPanel } from '@pascal-app/editor'
import { usePascalTranslation } from '@pascal-app/i18n'
import { Hammer, Layers, Package, Settings } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useMemo } from 'react'
import { BuildTab } from '@/components/build-tab'
import {
  CommunityViewerToolbarLeft,
  CommunityViewerToolbarRight,
} from '@/components/viewer-toolbar'

function EditorItemsPanel() {
  return <ItemsPanel showSourceFilter={false} showTagFilters={false} />
}

const PROJECT_ID = 'local-editor'

export default function Home() {
  const { t } = usePascalTranslation('editor')
  const sidebarTabs = useMemo(
    () => [
      {
        id: 'site',
        label: t('tabs.scene'),
        component: () => null,
        mobileDefaultSnap: 0.5,
        mobileIcon: <Layers className="h-5 w-5" />,
        icon: (
          <Image
            alt=""
            className="h-8 w-8 object-contain"
            height={32}
            src="/icons/scene.webp"
            width={32}
          />
        ),
      },
      {
        id: 'build',
        label: t('tabs.build'),
        component: BuildTab,
        mobileDefaultSnap: 0.5,
        mobileIcon: <Hammer className="h-5 w-5" />,
        icon: (
          <Image
            alt=""
            className="h-8 w-8 object-contain"
            height={32}
            src="/icons/build.webp"
            width={32}
          />
        ),
      },
      {
        id: 'items',
        label: t('tabs.items'),
        component: EditorItemsPanel,
        mobileDefaultSnap: 0.5,
        mobileIcon: <Package className="h-5 w-5" />,
        icon: (
          <Image
            alt=""
            className="h-8 w-8 object-contain"
            height={32}
            src="/icons/couch.webp"
            width={32}
          />
        ),
      },
      {
        id: 'settings',
        label: t('tabs.settings'),
        component: () => null,
        mobileDefaultSnap: 0.5,
        mobileIcon: <Settings className="h-5 w-5" />,
        icon: (
          <Image
            alt=""
            className="h-8 w-8 object-contain"
            height={32}
            src="/icons/settings.webp"
            width={32}
          />
        ),
      },
    ],
    [t],
  )

  return (
    <div className="relative h-screen w-screen">
      {PROJECT_ID === 'local-editor' && (
        <div className="pointer-events-none absolute top-3 left-1/2 z-40 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-border/60 bg-background/90 px-4 py-1.5 text-xs shadow-sm backdrop-blur">
            <span className="text-muted-foreground">{t('localEditor.notice')}</span>
            <Link className="font-medium text-foreground hover:underline" href="/scenes">
              {t('localEditor.openRecentScenes')}
            </Link>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <Link className="font-medium text-foreground hover:underline" href="/scenes">
              {t('localEditor.createNew')}
            </Link>
          </div>
        </div>
      )}
      <Editor
        layoutVersion="v2"
        projectId={PROJECT_ID}
        sidebarTabs={sidebarTabs}
        viewerToolbarLeft={<CommunityViewerToolbarLeft />}
        viewerToolbarRight={<CommunityViewerToolbarRight />}
      />
    </div>
  )
}
