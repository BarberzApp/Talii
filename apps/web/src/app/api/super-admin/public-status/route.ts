import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { authErrorResponse, requireAdmin } from '@/shared/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)

    const { userId, isPublic } = await request.json()
    logger.debug('Processing public status update', { userId, isPublic })

    if (!userId || typeof isPublic !== 'boolean') {
      logger.debug('Invalid parameters', { userId, isPublic })
      return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 })
    }

    // First, verify the profile exists using admin client
    const { data: existingProfile, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, is_public')
      .eq('id', userId)
      .single()

    if (fetchError || !existingProfile) {
      logger.error('Profile not found', { userId, error: fetchError })
      return NextResponse.json({ success: false, error: 'Profile not found' }, { status: 404 })
    }

    logger.debug('Updating profile', { 
      name: existingProfile.name, 
      email: existingProfile.email,
      currentIsPublic: existingProfile.is_public,
      newIsPublic: isPublic
    })

    // Update the profile's public status using admin client
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ is_public: isPublic })
      .eq('id', userId)

    if (error) {
      logger.error('Error updating public status', error)
      return NextResponse.json({ success: false, error: 'Failed to update public status' }, { status: 500 })
    }

    logger.debug('Successfully updated public status', { name: existingProfile.name })

    return NextResponse.json({ 
      success: true, 
      message: `Profile visibility updated to ${isPublic ? 'public' : 'private'}`,
      data: {
        userId,
        isPublic,
        profileName: existingProfile.name
      }
    })

  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    logger.error('Error in public status update', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
} 