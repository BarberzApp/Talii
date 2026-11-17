import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { authErrorResponse, requireAdmin } from '@/shared/lib/api-auth'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)

    // Fetch barbers with comprehensive data using admin client
    const { data: barbers, error } = await supabaseAdmin
      .from('barbers')
      .select(`
        id,
        user_id,
        business_name,
        is_developer,
        created_at,
        profiles (
          id,
          name,
          email,
          role,
          phone,
          location,
          bio,
          is_disabled,
          is_public,
          join_date,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Error fetching barbers', error)
      return NextResponse.json(
        { error: 'Failed to fetch barbers' },
        { status: 500 }
      )
    }

    // Normalize profiles data (handle both array and object formats)
    const normalizedBarbers = (barbers || []).map(barber => ({
      ...barber,
      profiles: Array.isArray(barber.profiles) ? barber.profiles[0] : barber.profiles
    }))

    return NextResponse.json({
      success: true,
      barbers: normalizedBarbers
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    logger.error('Super admin barbers error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 