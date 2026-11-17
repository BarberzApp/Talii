import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { authErrorResponse, requireAdmin } from '@/shared/lib/api-auth'

export async function POST(request: Request) {
  try {
    await requireAdmin(request)

    const { userId, isDisabled } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Update the user's disabled status
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_disabled: isDisabled })
      .eq('id', userId)

    if (error) {
      logger.error('Error updating account status', error)
      return NextResponse.json(
        { error: 'Failed to update account status' },
        { status: 500 }
      )
    }

    const statusText = isDisabled ? 'disabled' : 'enabled'
    
    return NextResponse.json({
      success: true,
      message: `Account ${statusText} successfully`
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    logger.error('Super admin account status error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 