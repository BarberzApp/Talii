// Setup and cleanup for the end-to-end API harness: seed lookups, a real
// TEST-mode Custom connected account for barber one, a barber with no Stripe
// account (barber three), and purging rows left by earlier runs.
import { E2E_TAG, USERS } from './lib.mjs'

export async function loadSeed(db) {
  const { data: barbers, error } = await db
    .from('barbers')
    .select('id, user_id, timezone, business_name')
    .in('user_id', [USERS.barberOne.id, USERS.barberTwo.id, USERS.barberThree.id])
  if (error) throw error
  const byUser = Object.fromEntries(barbers.map((b) => [b.user_id, b]))
  const b1 = byUser[USERS.barberOne.id]
  const b2 = byUser[USERS.barberTwo.id]
  if (!b1 || !b2) throw new Error('Seed barbers not found. Run `supabase db reset` locally.')

  const { data: services, error: sErr } = await db
    .from('services')
    .select('id, barber_id, name, duration_minutes, is_active')
    .in('barber_id', [b1.id, b2.id])
  if (sErr) throw sErr
  const { data: addons, error: aErr } = await db.from('service_addons').select('id, barber_id, name, price_cents').in('barber_id', [b1.id, b2.id])
  if (aErr) throw aErr
  const svc = (barberId, name) => services.find((s) => s.barber_id === barberId && s.name === name)
  return {
    b1,
    b2,
    b3: byUser[USERS.barberThree.id] ?? null,
    skinFade: svc(b1.id, 'Skin Fade'),
    kidsCut: svc(b1.id, 'Kids Cut'),
    cutLineup: svc(b2.id, 'Cut and Line-up'),
    beardTrim: addons.find((a) => a.barber_id === b1.id && a.name === 'Beard Trim'),
    eyebrows: addons.find((a) => a.barber_id === b2.id && a.name === 'Eyebrows'),
  }
}

/** Deletes bookings (and their payments) and special hours created by earlier harness runs. */
export async function purgeE2eRows(db) {
  const { data: old, error } = await db.from('bookings').select('id').like('notes', 'e2e-api%')
  if (error) throw error
  const ids = (old ?? []).map((b) => b.id)
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const { error: pErr } = await db.from('payments').delete().in('booking_id', chunk)
    if (pErr) throw pErr
    const { error: bErr } = await db.from('bookings').delete().in('id', chunk)
    if (bErr) throw bErr
  }
  const { error: shErr } = await db.from('special_hours').delete().like('reason', 'e2e-api%')
  if (shErr) throw shErr
  return ids.length
}

async function listAllAccounts(stripe) {
  const out = []
  for await (const a of stripe.accounts.list({ limit: 100 })) out.push(a)
  return out
}

/** Accounts that carry seed-user / seed-barber metadata or our tag. Never touches anything else. */
export function seedLinked(accounts, seed) {
  const userIds = new Set(Object.values(USERS).map((u) => u.id))
  const barberIds = new Set([seed.b1?.id, seed.b2?.id, seed.b3?.id].filter(Boolean))
  return accounts.filter(
    (a) =>
      a.metadata?.e2e === E2E_TAG ||
      userIds.has(a.metadata?.user_id) ||
      barberIds.has(a.metadata?.barber_id) ||
      a.email === USERS.barberThree.email
  )
}

async function createCustomAccount(stripe, seed) {
  return stripe.accounts.create({
    type: 'custom',
    country: 'US',
    email: 'barber.one+e2e@example.com',
    business_type: 'individual',
    business_profile: { mcc: '7230', url: 'https://accessible.stripe.com', product_description: 'Barber services (Talii local e2e test)' },
    capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
    individual: {
      first_name: 'Marcus',
      last_name: 'Reed',
      email: 'barber.one+e2e@example.com',
      phone: '0000000000',
      dob: { day: 1, month: 1, year: 1901 },
      ssn_last_4: '0000',
      id_number: '000000000',
      address: { line1: 'address_full_match', city: 'Brooklyn', state: 'NY', postal_code: '11201', country: 'US' },
    },
    external_account: 'btok_us_verified',
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
    metadata: { barber_id: seed.b1.id, user_id: USERS.barberOne.id, e2e: E2E_TAG },
  })
}

/**
 * Barber one gets a real TEST-mode Custom account that can take destination
 * charges (reused across runs; duplicates carrying seed metadata are deleted).
 * Barber three's leftover Express accounts are deleted so it starts with none.
 */
export async function ensureConnectedAccount(db, stripe, seed, log = console.log) {
  const linked = seedLinked(await listAllAccounts(stripe), seed)
  let keep = null
  const remove = []
  for (const a of linked) {
    const isB1 = a.type === 'custom' && (a.metadata?.user_id === USERS.barberOne.id || a.metadata?.barber_id === seed.b1.id)
    if (isB1 && !keep) keep = a
    else remove.push(a)
  }
  for (const a of remove) {
    await stripe.accounts.del(a.id)
    log(`deleted leftover test account ${a.id} (${a.type}, metadata ${JSON.stringify(a.metadata)})`)
  }

  let account = keep
  if (account) {
    log(`reusing test account ${account.id}`)
    if (account.metadata?.barber_id !== seed.b1.id || account.metadata?.e2e !== E2E_TAG) {
      account = await stripe.accounts.update(account.id, {
        metadata: { barber_id: seed.b1.id, user_id: USERS.barberOne.id, e2e: E2E_TAG },
      })
      log(`updated ${account.id} metadata.barber_id to the current seed barber`)
    }
  } else {
    account = await createCustomAccount(stripe, seed)
    log(`created test Custom account ${account.id}`)
  }

  const deadline = Date.now() + 120_000
  while (!(account.charges_enabled && account.capabilities?.transfers === 'active')) {
    if (Date.now() > deadline) break
    await new Promise((r) => setTimeout(r, 3000))
    account = await stripe.accounts.retrieve(account.id)
  }
  log(
    `account ${account.id}: charges_enabled=${account.charges_enabled} payouts_enabled=${account.payouts_enabled} ` +
      `transfers=${account.capabilities?.transfers} card_payments=${account.capabilities?.card_payments}`
  )

  // Free the unique stripe_account_id if some other row holds it, then link barber one.
  await db.from('barber_billing').update({ stripe_account_id: null }).eq('stripe_account_id', account.id).neq('barber_id', seed.b1.id)
  const { error } = await db
    .from('barber_billing')
    .update({
      stripe_account_id: account.id,
      charges_enabled: true,
      payouts_enabled: !!account.payouts_enabled,
      details_submitted: !!account.details_submitted,
      fee_exempt: false,
    })
    .eq('barber_id', seed.b1.id)
  if (error) throw error
  return account
}

/**
 * Barber three: a barber with no Stripe account. Recreated on every run so it
 * gets a fresh barber id: the API's accounts.create idempotency key is
 * `connect-account-<barberId>`, and reusing a barber id within Stripe's 24-hour
 * window would replay the (deleted) account from the previous run.
 */
export async function ensureBarberThree(db, seed) {
  if (seed.b3) {
    const { error } = await db.auth.admin.deleteUser(USERS.barberThree.id)
    if (error) throw error
  }
  const { error: createError } = await db.auth.admin.createUser({
    id: USERS.barberThree.id,
    email: USERS.barberThree.email,
    password: 'local-dev-password',
    email_confirm: true,
    user_metadata: { role: 'barber', name: 'E2E Barber Three', username: 'e2ebarberthree', business_name: 'E2E Three' },
  })
  if (createError) throw createError
  const { data: b3, error } = await db.from('barbers').select('id, user_id, timezone, business_name').eq('user_id', USERS.barberThree.id).single()
  if (error) throw error
  const { data: billing, error: bErr } = await db.from('barber_billing').select('stripe_account_id').eq('barber_id', b3.id).single()
  if (bErr) throw bErr
  if (billing.stripe_account_id) throw new Error('new barber three unexpectedly has a Stripe account')
  return b3
}

/**
 * Cleanup: delete every TEST-mode account the harness created (tagged, or
 * Express accounts for barber three), restore barber one's seed billing row,
 * delete barber three and purge harness rows.
 */
export async function cleanup(db, stripe, log = console.log) {
  const seed = await loadSeed(db)
  const accounts = seedLinked(await listAllAccounts(stripe), seed)
  for (const a of accounts) {
    await stripe.accounts.del(a.id)
    log(`deleted test account ${a.id} (${a.type}, ${a.email ?? 'no email'})`)
  }
  const { error } = await db
    .from('barber_billing')
    .update({ stripe_account_id: 'acct_localtest0001', charges_enabled: true, payouts_enabled: true, details_submitted: true, fee_exempt: false })
    .eq('barber_id', seed.b1.id)
  if (error) throw error
  log('restored barber one billing to the seed values (acct_localtest0001)')
  const purged = await purgeE2eRows(db)
  log(`purged ${purged} harness bookings and harness special hours`)
  if (seed.b3) {
    const { error: delErr } = await db.auth.admin.deleteUser(USERS.barberThree.id)
    if (delErr) throw delErr
    log('deleted barber three (local auth user, cascades to profile/barber/billing)')
  }
}
