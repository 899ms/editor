import { configureGlnDatabaseEnvironment } from '@/lib/gln-database'
import * as editorSceneEventsRoute from '../../../../../../editor/app/api/scenes/[id]/events/route'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ id: string }> }

export function OPTIONS(request: Request) {
  configureGlnDatabaseEnvironment()
  return editorSceneEventsRoute.OPTIONS(request)
}

export async function GET(request: Request, context: RouteContext) {
  configureGlnDatabaseEnvironment()
  return editorSceneEventsRoute.GET(request, context)
}
