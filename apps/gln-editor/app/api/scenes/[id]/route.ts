import type { NextRequest } from 'next/server'
import { configureGlnDatabaseEnvironment } from '@/lib/gln-database'
import * as editorSceneRoute from '../../../../../editor/app/api/scenes/[id]/route'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

export function OPTIONS(request: NextRequest) {
  configureGlnDatabaseEnvironment()
  return editorSceneRoute.OPTIONS(request)
}

export async function GET(request: NextRequest, context: RouteContext) {
  configureGlnDatabaseEnvironment()
  return editorSceneRoute.GET(request, context)
}

export async function PUT(request: NextRequest, context: RouteContext) {
  configureGlnDatabaseEnvironment()
  return editorSceneRoute.PUT(request, context)
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  configureGlnDatabaseEnvironment()
  return editorSceneRoute.PATCH(request, context)
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  configureGlnDatabaseEnvironment()
  return editorSceneRoute.DELETE(request, context)
}
