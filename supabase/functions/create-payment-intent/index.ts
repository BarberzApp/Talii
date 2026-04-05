/// <reference path="../types.d.ts" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type EnvProvider = {
  get: (key: string) => string | undefined
}

type HandlerDeps = {
  env: EnvProvider
  createSupabaseClient: (url: string, serviceKey: string) => ReturnType<typeof createClient>
  createStripeClient: (secretKey: string) => Stripe
}

const createSupabaseClient = (url: string, serviceKey: string) => createClient(url, serviceKey)
const createStripeClient = (secretKey: string) =>
  new Stripe(secretKey, {
    apiVersion: '2024-06-20' as any,
  })

export const handleCreatePaymentIntentRequest = async (
  req: Request,
  deps: HandlerDeps = {
    env: Deno.env,
    createSupabaseClient,
    createStripeClient,
  }
) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('create-payment-intent function called')
    
    // Create Supabase client
    const supabaseUrl = deps.env.get('SUPABASE_URL')!
    const supabaseServiceKey = deps.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = deps.createSupabaseClient(supabaseUrl, supabaseServiceKey)

    // Create Stripe client
    const stripeSecretKey = deps.env.get('STRIPE_SECRET_KEY')!
    const stripe = deps.createStripeClient(stripeSecretKey)

    // Parse request body
    const {
      barberId,
      serviceId,
      date,
      notes,
      clientId,
      addonIds = [],
    } = await req.json()

    console.log('Request body parsed:', { barberId, serviceId, date, clientId, addonIds })

    // Validate required fields
    console.log('Validating required fields...')
    if (!barberId || !serviceId || !date) {
      console.log('Missing required fields:', { barberId, serviceId, date })
      return new Response(
        JSON.stringify({ error: 'barberId, serviceId, and date are required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get the barber's details including developer status
    const { data: barber, error: barberError } = await supabase
      .from('barbers')
      .select('stripe_account_id, stripe_account_status, is_developer')
      .eq('id', barberId)
      .single()

    if (barberError) {
      console.log('Barber error:', barberError)
      return new Response(
        JSON.stringify({ error: 'Barber not found' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Barber data:', barber)

    // Check if this is a developer account
    if (barber.is_developer) {
      console.log('Developer account detected - should use create-developer-booking instead')
      return new Response(
        JSON.stringify({ error: 'Developer accounts should use create-developer-booking endpoint' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // For regular barbers, check Stripe account
    if (!barber?.stripe_account_id) {
      console.log('No Stripe account ID found for barber')
      return new Response(
        JSON.stringify({ error: 'Barber Stripe account not found or not ready' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the barber's Stripe account is active
    if (barber.stripe_account_status !== 'active') {
      console.log('Barber Stripe account not active:', barber.stripe_account_status)
      return new Response(
        JSON.stringify({ error: 'Barber account is not ready to accept payments' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('name, price, duration')
      .eq('id', serviceId)
      .single()

    if (serviceError || !service?.price) {
      return new Response(
        JSON.stringify({ error: 'Service not found or missing price' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const servicePrice = Math.round(Number(service.price) * 100) // Convert to cents
    
    console.log('💰 Service details (for reference only - NOT included in payment):', {
      serviceName: service.name,
      servicePriceCents: servicePrice,
      servicePriceDollars: (servicePrice / 100).toFixed(2),
      warning: 'Service price is NOT added to payment amount'
    })
    
    // Get add-ons if any are selected (deduplicate to prevent double-counting)
    const uniqueAddonIds = Array.isArray(addonIds)
      ? [...new Set(addonIds.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0))]
      : []

    let addonTotal = 0
    if (uniqueAddonIds.length > 0) {
      const { data: addons, error: addonsError } = await supabase
        .from('service_addons')
        .select('id, name, price')
        .in('id', uniqueAddonIds)
        .eq('is_active', true)

      if (addonsError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch add-ons' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }

      addonTotal = addons.reduce((total: number, addon: any) => total + addon.price, 0)
      console.log('📦 Addons (for reference only - NOT included in payment):', {
        addonCount: addons.length,
        addonTotalDollars: addonTotal.toFixed(2),
        addonTotalCents: Math.round(addonTotal * 100),
        addonDetails: addons.map(a => ({ name: a.name, price: a.price })),
        warning: 'Addons are NOT added to payment amount'
      })
    }
    
    // CRITICAL: Canonical fee-only model
    // Customers ONLY pay the platform fee ($3.40); service and addons are paid at appointment.
    const platformFee = 340 // cents
    
    // ALWAYS charge only the platform fee - DO NOT add servicePrice or addonTotal
    const totalAmount = platformFee // Always $3.40 (platform fee only)
    
    // CRITICAL SAFEGUARD: Verify totalAmount does NOT include service or addons
    console.log('💳 Payment amount verification:', {
      servicePriceCents: servicePrice,
      servicePriceDollars: (servicePrice / 100).toFixed(2),
      addonTotalCents: Math.round(addonTotal * 100),
      addonTotalDollars: addonTotal.toFixed(2),
      platformFeeCents: platformFee,
      platformFeeDollars: (platformFee / 100).toFixed(2),
      totalAmountCents: totalAmount,
      totalAmountDollars: (totalAmount / 100).toFixed(2),
      verification: totalAmount === platformFee ? '✅ CORRECT' : '❌ ERROR',
      note: 'totalAmount MUST equal platformFee (340) - service and addons NOT included'
    })
    
    // CRITICAL ERROR CHECK: If totalAmount includes service or addons, return error
    if (totalAmount !== platformFee) {
      const extraAmount = totalAmount - platformFee
      console.error('❌ CRITICAL ERROR: totalAmount includes service or addons!', {
        totalAmount,
        platformFee,
        extraAmount,
        extraAmountDollars: (extraAmount / 100).toFixed(2),
        servicePrice,
        addonTotal,
        possibleCause: extraAmount === servicePrice ? 'Service price was incorrectly added' : 
                      extraAmount === Math.round(addonTotal * 100) ? 'Addon total was incorrectly added' :
                      'Unknown amount was added'
      })
      return new Response(
        JSON.stringify({ 
          error: `Payment calculation error: Expected $3.40 but calculated $${(totalAmount / 100).toFixed(2)}. Service price should not be included.` 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }
    
    // Total amount calculation verification completed.
    
    // Stripe fee calculation: Stripe takes ~$0.40 (2.9% + $0.30)
    // After Stripe fee: $3.40 - $0.40 = $3.00
    // Split the $3.00: 60% to BOCM ($1.80), 40% to barber ($1.20)
    // BOCM absorbs the Stripe fee as a platform cost, so BOCM net = $1.80 - $0.40 = $1.40
    // For destination charges, transfer amount = totalAmount - application_fee_amount
    // So to give barber $1.20, application_fee_amount = $3.40 - $1.20 = $2.20
    const stripeFee = 40 // cents (absorbed by platform)
    const netAfterStripe = platformFee - stripeFee // $3.00 = 300 cents
    const bocmShare = Math.round(netAfterStripe * 0.60) // Gross platform share = $1.80 = 180 cents
    const barberShare = Math.round(netAfterStripe * 0.40) // Barber share = $1.20 = 120 cents
    const applicationFeeAmount = platformFee - barberShare // Amount to withhold = 220 cents
    
    console.log('Payment: customer only pays platform fee', { 
      totalCharged: platformFee,
      stripeFee,
      netAfterStripe,
      bocmShare, // Gross platform share
      barberShare, // Barber target payout
      applicationFeeAmount, // Withheld by platform
      note: 'Service and addons paid directly to barber at appointment. BOCM absorbs Stripe fee as platform cost.'
    })

    // Create Payment Intent
    // Fee breakdown:
    // - Total charged to customer: $3.40
    // - Stripe fee: ~$0.40 (absorbed by platform)
    // - Net after Stripe: $3.00
    // - BOCM gross: $1.80 (60% of net)
    // - BOCM net: $1.40 (after absorbing Stripe fee)
    // - Barber receives: $1.20 (40% of net)
    // - Platform withholds: $2.20 (application_fee_amount)
    // Note: Service price and addons are paid directly to barber at appointment
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount, // Always $3.40 (platform fee only)
      currency: 'usd',
      application_fee_amount: applicationFeeAmount, // Platform withholds $2.20 to ensure barber gets $1.20
      transfer_data: {
        destination: barber.stripe_account_id, // Barber gets 40% of net = $1.20
      },
      metadata: {
        barberId,
        serviceId,
        date,
        notes: notes || '',
        clientId: clientId || '',
        serviceName: service.name,
        servicePrice: servicePrice.toString(),
        addonTotal: Math.round(addonTotal * 100).toString(),
        addonIds: uniqueAddonIds.join(','),
        platformFee: platformFee.toString(),
        paymentType: 'fee',
        feeType: 'fee_only',
        bocmShare: bocmShare.toString(),
        barberShare: barberShare.toString(),
        isDeveloper: 'false',
        addonsPaidSeparately: (uniqueAddonIds.length > 0).toString(),
      },
    })

    console.log('Payment Intent created successfully:', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      amountInDollars: (paymentIntent.amount / 100).toFixed(2),
      expectedAmount: 3.40,
      application_fee_amount: applicationFeeAmount,
      application_fee_dollars: (applicationFeeAmount / 100).toFixed(2),
      barber_should_receive: (barberShare / 100).toFixed(2),
      clientSecret: paymentIntent.client_secret,
      breakdown: {
        totalCharged: `${(totalAmount / 100).toFixed(2)}`,
        stripeFee: `${(stripeFee / 100).toFixed(2)}`,
        netAfterStripe: `${(netAfterStripe / 100).toFixed(2)}`,
        bocmShare: `${(bocmShare / 100).toFixed(2)}`,
        barberShare: `${(barberShare / 100).toFixed(2)}`
      }
    })
    
    // Verify the amount is correct
    if (paymentIntent.amount !== 340) {
      console.error('❌ ERROR: Payment amount is incorrect!', {
        expected: 340,
        actual: paymentIntent.amount,
        difference: paymentIntent.amount - 340,
        differenceInDollars: ((paymentIntent.amount - 340) / 100).toFixed(2)
      })
    }

    return new Response(
      JSON.stringify({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error("Error creating payment intent:", error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to create payment intent" 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}

serve((req: Request) => handleCreatePaymentIntentRequest(req))
