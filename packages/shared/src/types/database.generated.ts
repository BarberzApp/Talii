export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      availability: {
        Row: {
          barber_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          start_time: string
          updated_at?: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      barber_billing: {
        Row: {
          barber_id: string
          charges_enabled: boolean
          created_at: string
          details_submitted: boolean
          fee_exempt: boolean
          payouts_enabled: boolean
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          barber_id: string
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          fee_exempt?: boolean
          payouts_enabled?: boolean
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          barber_id?: string
          charges_enabled?: boolean
          created_at?: string
          details_submitted?: boolean
          fee_exempt?: boolean
          payouts_enabled?: boolean
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barber_billing_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: true
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      barbers: {
        Row: {
          bio: string | null
          business_name: string | null
          city: string | null
          created_at: string
          id: string
          instagram: string | null
          is_public: boolean
          latitude: number | null
          listing_suspended: boolean
          longitude: number | null
          onboarding_complete: boolean
          portfolio: string[]
          specialties: string[]
          state: string | null
          tiktok: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          is_public?: boolean
          latitude?: number | null
          listing_suspended?: boolean
          longitude?: number | null
          onboarding_complete?: boolean
          portfolio?: string[]
          specialties?: string[]
          state?: string | null
          tiktok?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          is_public?: boolean
          latitude?: number | null
          listing_suspended?: boolean
          longitude?: number | null
          onboarding_complete?: boolean
          portfolio?: string[]
          specialties?: string[]
          state?: string | null
          tiktok?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "barbers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barbers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_addons: {
        Row: {
          addon_id: string
          booking_id: string
          created_at: string
          id: string
          name: string
          price_cents: number
        }
        Insert: {
          addon_id: string
          booking_id: string
          created_at?: string
          id?: string
          name: string
          price_cents: number
        }
        Update: {
          addon_id?: string
          booking_id?: string
          created_at?: string
          id?: string
          name?: string
          price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "service_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_addons_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          addon_total_cents: number
          application_fee_cents: number
          barber_fee_share_cents: number
          barber_id: string
          booking_fee_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string | null
          created_at: string
          customer_name: string | null
          ends_at: string
          hold_expires_at: string | null
          id: string
          notes: string | null
          payment_intent_id: string | null
          payment_status: string
          service_id: string
          service_price_cents: number
          source: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          addon_total_cents?: number
          application_fee_cents?: number
          barber_fee_share_cents?: number
          barber_id: string
          booking_fee_cents?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          customer_name?: string | null
          ends_at: string
          hold_expires_at?: string | null
          id?: string
          notes?: string | null
          payment_intent_id?: string | null
          payment_status?: string
          service_id: string
          service_price_cents?: number
          source?: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          addon_total_cents?: number
          application_fee_cents?: number
          barber_fee_share_cents?: number
          barber_id?: string
          booking_fee_cents?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          customer_name?: string | null
          ends_at?: string
          hold_expires_at?: string | null
          id?: string
          notes?: string | null
          payment_intent_id?: string | null
          payment_status?: string
          service_id?: string
          service_price_cents?: number
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          application_fee_cents: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          payment_intent_id: string | null
          status: string
          stripe_object_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          application_fee_cents?: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          payment_intent_id?: string | null
          status: string
          stripe_object_id: string
          type: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          application_fee_cents?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          payment_intent_id?: string | null
          status?: string
          stripe_object_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cover_photo_url: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          is_disabled: boolean
          name: string | null
          phone: string | null
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          cover_photo_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id: string
          is_disabled?: boolean
          name?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          cover_photo_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_disabled?: boolean
          name?: string | null
          phone?: string | null
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          details: string | null
          id: string
          reason: string
          reported_user_id: string | null
          reporter_id: string
          status: string
          updated_at: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          barber_id: string
          booking_id: string
          client_id: string | null
          comment: string | null
          created_at: string
          id: string
          is_hidden: boolean
          rating: number
          updated_at: string
        }
        Insert: {
          barber_id: string
          booking_id: string
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          rating: number
          updated_at?: string
        }
        Update: {
          barber_id?: string
          booking_id?: string
          client_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          is_hidden?: boolean
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_booking_barber_fkey"
            columns: ["booking_id", "barber_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id", "barber_id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_addons: {
        Row: {
          barber_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_addons_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          barber_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          updated_at: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          updated_at?: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      special_hours: {
        Row: {
          barber_id: string
          created_at: string
          date: string
          end_time: string | null
          id: string
          is_closed: boolean
          reason: string | null
          start_time: string | null
          updated_at: string
        }
        Insert: {
          barber_id: string
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          is_closed?: boolean
          reason?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          barber_id?: string
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          is_closed?: boolean
          reason?: string | null
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "special_hours_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_events: {
        Row: {
          created_at: string
          error: string | null
          id: string
          payload: Json | null
          processed_at: string | null
          received_at: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id: string
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          payload?: Json | null
          processed_at?: string | null
          received_at?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      barber_rating_stats: {
        Row: {
          average_rating: number | null
          barber_id: string | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          cover_photo_url: string | null
          id: string | null
          name: string | null
          role: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          cover_photo_url?: string | null
          id?: string | null
          name?: string | null
          role?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          cover_photo_url?: string | null
          id?: string | null
          name?: string | null
          role?: string | null
          username?: string | null
        }
        Relationships: []
      }
      public_reviews: {
        Row: {
          barber_id: string | null
          comment: string | null
          created_at: string | null
          id: string | null
          rating: number | null
          reviewer_avatar_url: string | null
          reviewer_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_barber_id_fkey"
            columns: ["barber_id"]
            isOneToOne: false
            referencedRelation: "barbers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_platform_stats: {
        Args: { p_since?: string }
        Returns: {
          barbers_charges_enabled: number
          barbers_fee_exempt: number
          barbers_listed: number
          barbers_suspended: number
          barbers_total: number
          bookings_cancelled: number
          bookings_completed: number
          bookings_confirmed: number
          bookings_new_since: number
          bookings_no_show: number
          bookings_pending: number
          bookings_total: number
          bookings_upcoming: number
          clients_total: number
          disabled_total: number
          fees_charged_cents: number
          fees_charged_since_cents: number
          platform_fees_cents: number
          platform_fees_refunded_cents: number
          platform_fees_since_cents: number
          refunded_cents: number
          reports_pending: number
          reviews_hidden: number
          reviews_total: number
          users_new_since: number
          users_total: number
          waitlist_total: number
        }[]
      }
      barber_earnings_bookings: {
        Args: {
          p_barber_id: string
          p_from: string
          p_limit?: number
          p_offset?: number
          p_to: string
        }
        Returns: {
          addon_total_cents: number
          customer_name: string
          fee_share_cents: number
          id: string
          payment_status: string
          service_name: string
          service_price_cents: number
          source: string
          starts_at: string
          status: string
        }[]
      }
      barber_earnings_totals: {
        Args: { p_barber_id: string; p_from: string; p_to: string }
        Returns: {
          booking_count: number
          cancelled_bookings: number
          completed_bookings: number
          fee_share_earned_cents: number
          fee_share_reversed_cents: number
          no_show_bookings: number
          refunded_to_clients_cents: number
          service_revenue_cents: number
          upcoming_bookings: number
        }[]
      }
      barber_is_listed: { Args: { p_barber_id: string }; Returns: boolean }
      create_booking_hold: {
        Args: {
          p_addon_ids?: string[]
          p_application_fee_cents: number
          p_barber_fee_share_cents: number
          p_barber_id: string
          p_booking_fee_cents: number
          p_client_id: string
          p_hold_expires_at: string
          p_notes?: string
          p_service_id: string
          p_starts_at: string
        }
        Returns: {
          addon_total_cents: number
          application_fee_cents: number
          barber_fee_share_cents: number
          barber_id: string
          booking_fee_cents: number
          cancellation_reason: string | null
          cancelled_at: string | null
          client_id: string | null
          created_at: string
          customer_name: string | null
          ends_at: string
          hold_expires_at: string | null
          id: string
          notes: string | null
          payment_intent_id: string | null
          payment_status: string
          service_id: string
          service_price_cents: number
          source: string
          starts_at: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      nearby_barbers: {
        Args: {
          p_latitude: number
          p_limit?: number
          p_longitude: number
          p_radius_miles?: number
        }
        Returns: {
          avatar_url: string
          bio: string
          business_name: string
          city: string
          distance_miles: number
          id: string
          latitude: number
          longitude: number
          name: string
          specialties: string[]
          state: string
          user_id: string
          username: string
        }[]
      }
      owns_barber: { Args: { p_barber_id: string }; Returns: boolean }
      replace_availability: {
        Args: { p_barber_id: string; p_windows: Json }
        Returns: {
          barber_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          start_time: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "availability"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_barbers: {
        Args: {
          p_exclude_user_ids?: string[]
          p_limit?: number
          p_offset?: number
          p_query?: string
        }
        Returns: {
          avatar_url: string
          bio: string
          business_name: string
          city: string
          id: string
          latitude: number
          longitude: number
          name: string
          specialties: string[]
          state: string
          user_id: string
          username: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

