import type { NextRequest } from 'next/server'
import { configureGlnDatabaseEnvironment } from '@/lib/gln-database'
import * as editorScenesRoute from '../../../../editor/app/api/scenes/route'

export const dynamic = 'force-dynamic'

export function OPTIONS(request: NextRequest) {
  configureGlnDatabaseEnvironment()
  return editorScenesRoute.OPTIONS(request)
}

export async function GET(request: NextRequest) {
  configureGlnDatabaseEnvironment()
  return editorScenesRoute.GET(request)
}

export async function POST(request: NextRequest) {
  configureGlnDatabaseEnvironment()
  return editorScenesRoute.POST(request)
}
