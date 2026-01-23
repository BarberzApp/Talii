import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { validateBearerToken } from '@/shared/lib/api-auth'
import { handleApiError } from '@/shared/lib/api-errors'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  let userId: string | null = null

  try {
    const user = await validateBearerToken(request)
    userId = user.id

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      return handleApiError(
        profileError,
        request,
        { route: 'mobile/me', userId, step: 'load_profile' },
        { status: 500, fallbackMessage: 'Failed to load profile' }
      )
    }

    let barber: any = null
    if (profile?.role === 'barber') {
      const { data: barberRow, error: barberError } = await supabaseAdmin
        .from('barbers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (barberError) {
        return handleApiError(
          barberError,
          request,
          { route: 'mobile/me', userId, step: 'load_barber' },
          { status: 500, fallbackMessage: 'Failed to load barber data' }
        )
      }

      barber = barberRow
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email },
      profile,
      barber,
    })
  } catch (err) {
    return handleApiError(err, request, { route: 'mobile/me', userId })
  }
}

