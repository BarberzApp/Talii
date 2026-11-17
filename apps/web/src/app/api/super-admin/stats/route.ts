import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/shared/lib/supabase'
import { logger } from '@/shared/lib/logger'
import { authErrorResponse, requireAdmin } from '@/shared/lib/api-auth'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)

    // Fetch comprehensive platform statistics
    const [
      { count: totalUsers },
      { count: totalBarbers },
      { count: totalClients },
      { count: disabledAccounts },
      { count: developers },
      { count: activeBookings },
      { data: revenueData }
    ] = await Promise.all([
      // Total users
      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true }),
      
      // Total barbers
      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'barber'),
      
      // Total clients
      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'client'),
      
      // Disabled accounts
      supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_disabled', true),
      
      // Developers
      supabaseAdmin
        .from('barbers')
        .select('*', { count: 'exact', head: true })
        .eq('is_developer', true),
      
      // Active bookings
      supabaseAdmin
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .in('status', ['confirmed']),
      
      // Revenue data (all bookings)
      supabaseAdmin
        .from('bookings')
        .select('price, status, barber_id')
        .in('status', ['confirmed', 'completed'])
    ])

    // Get all barber IDs from bookings and fetch their developer status
    const barberIds = [...new Set(revenueData?.map(b => b.barber_id).filter(Boolean) || [])]
    
    let developerBarberIds: string[] = []
    if (barberIds.length > 0) {
      const { data: barbersData } = await supabaseAdmin
        .from('barbers')
        .select('id, is_developer')
        .in('id', barberIds)
      
      developerBarberIds = barbersData?.filter(b => b.is_developer).map(b => b.id) || []
    }
    
    // Calculate total revenue
    const totalRevenue = revenueData?.reduce((sum, booking) => sum + (booking.price || 0), 0) || 0
    
    // Calculate developer bookings revenue (these bypass platform fees)
    const developerRevenue = revenueData?.filter(b => developerBarberIds.includes(b.barber_id))
      .reduce((sum, booking) => sum + (booking.price || 0), 0) || 0
    
    // Calculate regular bookings revenue
    const regularRevenue = revenueData?.filter(b => !developerBarberIds.includes(b.barber_id))
      .reduce((sum, booking) => sum + (booking.price || 0), 0) || 0
    
    // Count bookings
    const developerBookings = revenueData?.filter(b => developerBarberIds.includes(b.barber_id)).length || 0
    const regularBookings = revenueData?.filter(b => !developerBarberIds.includes(b.barber_id)).length || 0
    
    // Calculate today's stats
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString()
    
    const { count: newUsersToday } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('join_date', todayStr)
    
    const { data: todayRevenueData } = await supabaseAdmin
      .from('bookings')
      .select('price, status')
      .in('status', ['confirmed', 'completed'])
      .gte('created_at', todayStr)
    
    const revenueToday = (todayRevenueData?.reduce((sum, booking) => sum + (booking.price || 0), 0) || 0) / 100

    const stats = {
      totalUsers: totalUsers || 0,
      totalBarbers: totalBarbers || 0,
      totalClients: totalClients || 0,
      disabledAccounts: disabledAccounts || 0,
      developers: developers || 0,
      activeBookings: activeBookings || 0,
      totalRevenue: totalRevenue / 100, // Convert from cents to dollars
      developerRevenue: developerRevenue / 100,
      regularRevenue: regularRevenue / 100,
      developerBookings: developerBookings,
      regularBookings: regularBookings,
      newUsersToday: newUsersToday || 0,
      revenueToday: revenueToday
    }

    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    const authResponse = authErrorResponse(error)
    if (authResponse) return authResponse
    logger.error('Super admin stats error', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 