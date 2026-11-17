import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { authErrorResponse, requireAdmin } from '@/shared/lib/api-auth'

export async function POST(request: Request) {
  try {
    await requireAdmin(request)

    const { userId, role } = await request.json()

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'User ID and role are required' },
        { status: 400 }
      )
    }

    // Validate role
    if (!['client', 'barber'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "client" or "barber"' },
        { status: 400 }
      )
    }

    // Update the user's role
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role: role })
      .eq('id', userId)

    if (error) {
      logger.error('Error updating user role', error)
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 500 }
      )
    }

    // If changing to barber role, ensure they have a barber record
    if (role === 'barber') {
      const { data: existingBarber } = await supabaseAdmin
        .from('barbers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle()

      if (!existingBarber) {
        // Create barber record if it doesn't exist
        const { error: insertError } = await supabaseAdmin
          .from('barbers')
          .insert({
            user_id: userId,
            business_name: 'New Business',
            is_developer: false
          })
        if (insertError) {
          logger.error('Error creating barber record for new barber role', insertError)
          return NextResponse.json(
            { error: 'Role updated but failed to create barber record' },
            { status: 500 }
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `User role updated to ${role}`
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    logger.error('Super admin update role error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 