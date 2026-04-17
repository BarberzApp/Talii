import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/shared/lib/supabase';
import { Filter } from 'bad-words';
import { logger } from '@/shared/lib/logger';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

const filter = new Filter();

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get current authenticated user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const { barberId, rating, comment } = body;

    if (!barberId) {
      return NextResponse.json({ error: 'Barber ID is required' }, { status: 400 });
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Valid rating between 1 and 5 is required' }, { status: 400 });
    }

    // Profanity check
    if (comment && filter.isProfane(comment)) {
      return NextResponse.json(
        { error: 'Your review contains language that goes against our community guidelines.' },
        { status: 400 }
      );
    }

    // Verify recent booking (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentBookings, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, date')
      .eq('client_id', userId)
      .eq('barber_id', barberId)
      .in('status', ['completed', 'confirmed'])
      .gte('date', thirtyDaysAgo.toISOString())
      .limit(1);

    if (bookingError) {
      logger.error('Error verifying recent bookings', bookingError);
      return NextResponse.json({ error: 'Failed to verify booking history' }, { status: 500 });
    }

    if (!recentBookings || recentBookings.length === 0) {
      return NextResponse.json(
        { error: 'You must have completed a booking with this barber in the last 30 days to leave a review.' },
        { status: 403 }
      );
    }

    // Create the review
    const { data: review, error: reviewError } = await supabaseAdmin
      .from('reviews')
      .insert({
        client_id: userId,
        barber_id: barberId,
        booking_id: recentBookings[0].id,
        rating,
        comment: comment || null,
        is_verified: true, // It's verified because we confirmed a booking
        is_public: true,
        is_moderated: true // Moderated automatically via bad-words
      })
      .select()
      .single();

    if (reviewError) {
      logger.error('Error creating review', reviewError);
      return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
    }

    // Optional: Refresh barber review stats in background
    // Calculate new average and count
    const { data: stats } = await supabaseAdmin
      .from('reviews')
      .select('rating')
      .eq('barber_id', barberId)
      .eq('is_public', true)
      .eq('is_moderated', true);

    if (stats) {
      const totalReviews = stats.length;
      const averageRating = totalReviews > 0 
        ? stats.reduce((sum, r) => sum + r.rating, 0) / totalReviews 
        : 0;

      await supabaseAdmin
        .from('barbers')
        .update({
          review_count: totalReviews,
          average_rating: averageRating
        })
        .eq('id', barberId);
    }

    return NextResponse.json({ success: true, data: review });
  } catch (error) {
    logger.error('Unhandled error in /api/reviews', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
