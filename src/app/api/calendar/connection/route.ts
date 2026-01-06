import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { CalendarSyncService } from '@/shared/lib/google-calendar-api';
import { logger } from '@/shared/lib/logger';

async function getAuthenticatedSupabaseClient(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    return { supabase, user, userError };
  }

  // Fallback: cookie-based auth (browser session)
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  return { supabase, user, userError };
}

export async function GET(request: NextRequest) {
  try {
    const { user, userError } = await getAuthenticatedSupabaseClient(request);
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get user's calendar connection
    const connection = await CalendarSyncService.getCalendarConnection(user.id);
    
    if (!connection) {
      return NextResponse.json({
        connected: false,
        connection: null
      });
    }

    return NextResponse.json({
      connected: true,
      connection: {
        id: connection.id,
        provider: connection.provider,
        sync_enabled: connection.sync_enabled,
        sync_direction: connection.sync_direction,
        last_sync_at: connection.last_sync_at,
        created_at: connection.created_at
      }
    });

  } catch (error) {
    logger.error('Error getting calendar connection', error);
    return NextResponse.json(
      { error: 'Failed to get calendar connection' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user, userError } = await getAuthenticatedSupabaseClient(request);
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get user's calendar connection
    const connection = await CalendarSyncService.getCalendarConnection(user.id);
    
    if (!connection) {
      return NextResponse.json(
        { error: 'No calendar connection found' },
        { status: 404 }
      );
    }

    // Delete all synced events for this user
    await supabase
      .from('synced_events')
      .delete()
      .eq('user_id', user.id);

    // Delete sync logs for this connection
    await supabase
      .from('calendar_sync_logs')
      .delete()
      .eq('connection_id', connection.id);

    // Delete the connection
    await supabase
      .from('user_calendar_connections')
      .delete()
      .eq('id', connection.id);

    return NextResponse.json({
      success: true,
      message: 'Calendar connection removed successfully'
    });

  } catch (error) {
    logger.error('Error removing calendar connection', error);
    return NextResponse.json(
      { error: 'Failed to remove calendar connection' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { sync_enabled, sync_direction } = await request.json();
    
    const { supabase, user, userError } = await getAuthenticatedSupabaseClient(request);
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not authenticated' },
        { status: 401 }
      );
    }

    // Get user's calendar connection
    const connection = await CalendarSyncService.getCalendarConnection(user.id);
    
    if (!connection) {
      return NextResponse.json(
        { error: 'No calendar connection found' },
        { status: 404 }
      );
    }

    // Update connection settings
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (sync_enabled !== undefined) {
      updateData.sync_enabled = sync_enabled;
    }

    if (sync_direction !== undefined) {
      updateData.sync_direction = sync_direction;
    }

    const { data: updatedConnection, error: updateError } = await supabase
      .from('user_calendar_connections')
      .update(updateData)
      .eq('id', connection.id)
      .select()
      .single();

    if (updateError) {
      logger.error('Error updating calendar connection', updateError);
      return NextResponse.json(
        { error: 'Failed to update calendar connection' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Calendar connection updated successfully',
      connection: {
        id: updatedConnection.id,
        provider: updatedConnection.provider,
        sync_enabled: updatedConnection.sync_enabled,
        sync_direction: updatedConnection.sync_direction,
        last_sync_at: updatedConnection.last_sync_at
      }
    });

  } catch (error) {
    logger.error('Error updating calendar connection', error);
    return NextResponse.json(
      { error: 'Failed to update calendar connection' },
      { status: 500 }
    );
  }
} 