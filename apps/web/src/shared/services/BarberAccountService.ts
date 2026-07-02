import { supabaseAdmin } from "@/shared/lib/supabase"
import { logger } from '@/shared/lib/logger'

export class BarberAccountService {
  /**
   * Called when a connected Stripe account is created.
   */
  static async createAccount(stripeAccountId: string, barberId: string): Promise<void> {
    const { error: updateError } = await supabaseAdmin
      .from('barbers')
      .update({
        stripe_account_id: stripeAccountId,
        stripe_account_status: 'pending',
        stripe_account_ready: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', barberId)

    if (updateError) {
      logger.error('Error updating barber on account creation', updateError)
      throw new Error('Failed to update barber')
    }
  }

  /**
   * Called when a connected Stripe account is updated.
   */
  static async updateAccountStatus(stripeAccountId: string, chargesEnabled: boolean, detailsSubmitted: boolean): Promise<void> {
    const { data: barber, error: findError } = await supabaseAdmin
      .from('barbers')
      .select('id')
      .eq('stripe_account_id', stripeAccountId)
      .single()

    if (findError || !barber) {
      logger.error('Error finding barber', findError)
      throw new Error('Barber not found')
    }

    const { error: updateError } = await supabaseAdmin
      .from('barbers')
      .update({
        stripe_account_status: chargesEnabled ? 'active' : 'pending',
        stripe_account_ready: chargesEnabled && detailsSubmitted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', barber.id)

    if (updateError) {
      logger.error('Error updating barber on account update', updateError)
      throw new Error('Failed to update barber')
    }
  }

  /**
   * Called when a connected Stripe account application is deauthorized.
   */
  static async deauthorizeAccount(stripeAccountId: string): Promise<void> {
    const { error: updateError } = await supabaseAdmin
      .from('barbers')
      .update({
        stripe_account_status: 'deauthorized',
        stripe_account_ready: false,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_account_id', stripeAccountId)

    if (updateError) {
      logger.error('Error updating barber on deauthorization', updateError)
      throw new Error('Failed to update barber')
    }
  }
}
