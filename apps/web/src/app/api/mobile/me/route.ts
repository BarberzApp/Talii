import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { ApiAuthError, validateBearerToken } from '@/shared/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await validateBearerToken(request)

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      logger.error('Failed to load profile', profileError, { userId: user.id })
      return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 })
    }

    let barber: any = null
    if (profile?.role === 'barber') {
      const { data: barberRow, error: barberError } = await supabaseAdmin
        .from('barbers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (barberError) {
        logger.error('Failed to load barber row', barberError, { userId: user.id })
        return NextResponse.json({ error: 'Failed to load barber data' }, { status: 500 })
      }

      barber = barberRow
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      profile,
      barber,
    })
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    logger.error('Mobile /me error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

