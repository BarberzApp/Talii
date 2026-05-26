import { POST } from './apps/web/src/app/api/webhooks/stripe/route';
import Stripe from 'stripe';

// @ts-ignore
// @ts-nocheck
// Create a real Stripe instance for testing signatures (needs any valid secret)
const testStripe = new Stripe('sk_test_123', { apiVersion: '2025-08-27.basil' });
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.STRIPE_SECRET_KEY = 'sk_test_123';

async function runTests() {
  console.log('--- RUNNING WEBHOOK TESTS ---');

  // Helper to generate a valid request with signature
  const createWebhookRequest = (payload: any) => {
    const payloadString = JSON.stringify(payload);
    const signature = testStripe.webhooks.generateTestHeaderString({
      payload: payloadString,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });

    return new Request('http://localhost:3000/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'stripe-signature': signature,
        'content-type': 'application/json',
      },
      body: payloadString,
    });
  };

  // Test 1: Check webhook status (invalid signature / missing body)
  console.log('\n1. Checking webhook status (handling missing signature)...');
  const req1 = new Request('http://localhost:3000/api/webhooks/stripe', { method: 'POST', body: 'invalid' });
  const res1 = await POST(req1);
  console.log('Status missing signature:', res1.status, await res1.json());

  // Test 2: Basic event received (dummy event type)
  console.log('\n2. Checking if payment event can be received (unhandled event type)...');
  const payload2 = {
    id: 'evt_test',
    type: 'payment_intent.created',
    data: { object: { id: 'pi_test' } },
  };
  const req2 = createWebhookRequest(payload2);
  const res2 = await POST(req2);
  console.log('Status unhandled event:', res2.status, await res2.json());

  // Test 3: Full payment received with information to complete booking
  console.log('\n3. Checking if payment can be received with all info to complete booking...');
  // We mock a payment_intent.succeeded
  const payload3 = {
    id: 'evt_test3',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: 'pi_mock_123',
        amount: 340,
        currency: 'usd',
        status: 'succeeded',
        application_fee_amount: 220,
        transfer_data: {
          destination: 'acct_mock'
        },
        metadata: {
          barberId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', // mock uuids
          serviceId: 'ssssssss-ssss-ssss-ssss-ssssssssssss',
          date: new Date(Date.now() + 86400000).toISOString(),
          clientId: 'guest',
          guestName: 'Test Guest',
          guestEmail: 'test@example.com',
          guestPhone: '555-555-5555',
          platformFeeCents: '340',
          bocmShareCents: '180',
          barberShareCents: '120',
          addonsPaidSeparately: 'false',
          isDeveloper: 'false'
        }
      }
    }
  };
  
  const req3 = createWebhookRequest(payload3);
  const res3 = await POST(req3);
  console.log('Status full payment info:', res3.status, await res3.json());
}

runTests().catch(console.error);
