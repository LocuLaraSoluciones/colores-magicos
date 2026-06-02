import { NextResponse, type NextRequest } from 'next/server'

// Middleware mínimo - solo pasar las cookies sin tocar nada
// La protección de rutas la manejan los Server Components
export async function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
