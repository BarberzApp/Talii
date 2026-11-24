import 'server-only'
import type Stripe from 'stripe'
import type { User } from '@supabase/supabase-js'
import type { Tables } from '@barber-app/shared'
import { getStripe, getSupabaseAdmin, type Db } from '../clients'
import { getServerEnv } from '../env'
import { ApiError } from '../errors'
import { callStripe, isStripeError } from './errors'

/**
 * Stripe Connect (Express) for barbers.
 *
 * Safety rules (Phase 1 review):
 * - Before returning any link for a stored account, retrieve it and require
 *   `metadata.barber_id` to be the caller's barber (403 ACCOUNT_MISMATCH).
 * - Create a replacement account only when Stripe says the stored one is
 *   missing or no longer accessible. Any other Stripe error is 502 and nothing
 *   is changed.
 */

type Billing = Pick<
  Tables<'barber_billing'>,
  'barber_id' | 'stripe_account_id' | 'charges_enabled' | 'payouts_enabled' | 'details_submitted' | 'fee_exempt'
>

const BILLING_COLUMNS = 'barber_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, fee_exempt'

export interface ConnectStatus {
  hasAccount: boolean
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  feeExempt: boolean
}

export interface ConnectLink {
  url: string
  type: 'onboarding' | 'dashboard'
}

/** True when Stripe reports the account missing or no longer accessible to the platform. */
export function isAccountGoneError(error: unknown): boolean {
  if (!isStripeError(error)) return false
  if (error.code === 'resource_missing' || error.code === 'account_invalid') return true
  return error.type === 'StripePermissionError' && /does not have access to account/i.test(error.message)
}

async function loadBilling(db: Db, barberId: string): Promise<Billing> {
  const { data, error } = await db.from('barber_billing').select(BILLING_COLUMNS).eq('barber_id', barberId).maybeSingle()
  if (error) throw error
  if (data) return data

  // Normally created by the create_barber_billing trigger; recreate if missing.
  const { error: insertError } = await db
    .from('barber_billing')
    .upsert({ barber_id: barberId }, { onConflict: 'barber_id', ignoreDuplicates: true })
  if (insertError) throw insertError
  const { data: created, error: reloadError } = await db
    .from('barber_billing')
    .select(BILLING_COLUMNS)
    .eq('barber_id', barberId)
    .single()
  if (reloadError) throw reloadError
  return created
}

class AccountGone extends Error {}

/**
 * Retrieves the stored account and checks it belongs to the barber.
 * Returns null when Stripe says it is gone; throws 403 on a metadata mismatch
 * and 502 on any other Stripe error.
 */
export async function retrieveOwnedAccount(accountId: string, barberId: string): Promise<Stripe.Account | null> {
  let account: Stripe.Account
  try {
    account = await callStripe('accounts.retrieve', async () => {
      try {
        return await getStripe().accounts.retrieve(accountId)
      } catch (error) {
        if (isAccountGoneError(error)) throw new AccountGone()
        throw error
      }
    })
  } catch (error) {
    if (error instanceof AccountGone) return null
    throw error
  }

  if (account.metadata?.barber_id !== barberId) {
    throw new ApiError(403, 'ACCOUNT_MISMATCH', 'This Stripe account does not belong to your barber profile.')
  }
  return account
}

async function persistFlags(db: Db, barberId: string, account: Stripe.Account): Promise<void> {
  const { error } = await db
    .from('barber_billing')
    .update({
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
    })
    .eq('barber_id', barberId)
  if (error) throw error
}

async function createAccount(db: Db, barberId: string, user: User, replacing: string | null): Promise<Stripe.Account> {
  // Same barber (and same account being replaced) → same key → a retry or
  // double click returns the same account instead of creating a second one.
  const idempotencyKey = replacing
    ? `connect-account-${barberId}-replaces-${replacing}`
    : `connect-account-${barberId}`

  const account = await callStripe('accounts.create', () =>
    getStripe().accounts.create(
      {
        type: 'express',
        ...(user.email ? { email: user.email } : {}),
        metadata: { barber_id: barberId, user_id: user.id },
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      },
      { idempotencyKey }
    )
  )

  const { error } = await db
    .from('barber_billing')
    .update({
      stripe_account_id: account.id,
      charges_enabled: account.charges_enabled ?? false,
      payouts_enabled: account.payouts_enabled ?? false,
      details_submitted: account.details_submitted ?? false,
    })
    .eq('barber_id', barberId)
  if (error) throw error // a retry gets the same account through the idempotency key
  return account
}

async function onboardingLink(accountId: string): Promise<ConnectLink> {
  const appUrl = getServerEnv().NEXT_PUBLIC_APP_URL
  const query = `account_id=${encodeURIComponent(accountId)}`
  const link = await callStripe('accountLinks.create', () =>
    getStripe().accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/barber/connect/refresh?${query}`,
      return_url: `${appUrl}/barber/connect/return?${query}`,
      type: 'account_onboarding',
    })
  )
  return { url: link.url, type: 'onboarding' }
}

/** The caller's account (verified, flags refreshed), creating one if there is none or it is gone. */
async function ensureAccount(barberId: string, user: User): Promise<Stripe.Account> {
  const db = getSupabaseAdmin()
  const billing = await loadBilling(db, barberId)

  if (billing.stripe_account_id) {
    const existing = await retrieveOwnedAccount(billing.stripe_account_id, barberId)
    if (existing) {
      await persistFlags(db, barberId, existing)
      return existing
    }
  }
  return createAccount(db, barberId, user, billing.stripe_account_id)
}

/** POST /api/stripe/connect/onboarding */
export async function startOnboarding(barberId: string, user: User): Promise<ConnectLink> {
  const account = await ensureAccount(barberId, user)
  return onboardingLink(account.id)
}

/** POST /api/stripe/connect/dashboard: Express dashboard once details are submitted, else onboarding. */
export async function dashboardLink(barberId: string, user: User): Promise<ConnectLink> {
  const account = await ensureAccount(barberId, user)
  if (!account.details_submitted) return onboardingLink(account.id)
  const login = await callStripe('accounts.createLoginLink', () => getStripe().accounts.createLoginLink(account.id))
  return { url: login.url, type: 'dashboard' }
}

/** GET /api/stripe/connect/status: reads Stripe and stores the flags. */
export async function refreshStatus(barberId: string): Promise<ConnectStatus> {
  const db = getSupabaseAdmin()
  const billing = await loadBilling(db, barberId)
  const none: ConnectStatus = {
    hasAccount: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    detailsSubmitted: false,
    feeExempt: billing.fee_exempt,
  }
  if (!billing.stripe_account_id) return none

  const account = await retrieveOwnedAccount(billing.stripe_account_id, barberId)
  if (!account) {
    // Gone at Stripe: nothing can be charged to it. Onboarding will replace it.
    const { error } = await db
      .from('barber_billing')
      .update({ charges_enabled: false, payouts_enabled: false })
      .eq('barber_id', barberId)
    if (error) throw error
    return none
  }

  await persistFlags(db, barberId, account)
  return {
    hasAccount: true,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
    feeExempt: billing.fee_exempt,
  }
}
