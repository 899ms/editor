import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({
    app: 'gln-editor',
    status: 'ok',
  })
}
