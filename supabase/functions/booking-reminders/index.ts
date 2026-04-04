import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const CARRIER_GATEWAYS: Record<string, string> = {
  verizon: 'vtext.com',
  att: 'txt.att.net',
  tmobile: 'tmomail.net',
  sprint: 'messaging.sprintpcs.com',
  boost: 'sms.myboostmobile.com',
  uscellular: 'email.uscc.net',
  cricket: 'sms.cricketwireless.net',
  metro: 'mymetropcs.com',
  googlefi: 'msg.fi.google.com',
};

async function lookupCarrier(phoneNumber: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.error('Missing Twilio credentials');
    return null;
  }
  
  const url = `https://lookups.twilio.com/v2/Lookups/${phoneNumber}?Fields=line_type_intelligence`;
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`
      }
    });
    const data = await response.json();
    return data.line_type_intelligence?.carrier_name?.toLowerCase();
  } catch (err) {
    console.error('Twilio lookup failed:', err);
    return null;
  }
}

async function sendSmsViaGateway(to: string, carrier: string, message: string) {
  const gateway = CARRIER_GATEWAYS[carrier] || CARRIER_GATEWAYS[carrier.split(' ')[0]]; // Handle "Verizon Wireless" etc.
  if (!gateway) return { success: false, error: 'Unknown carrier gateway' };
  
  const recipient = `${to.replace(/\D/g, '')}@${gateway}`;
  
  if (!RESEND_API_KEY) {
    console.warn(`Resend API Key missing. Simulation send to ${recipient}: ${message}`);
    return { success: true, simulated: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Talii Reminders <reminders@resend.dev>', // Update with your domain once verified
        to: [recipient],
        subject: '', // Carriers prefer blank subjects for SMS
        text: message,
      }),
    });
    return { success: res.ok };
  } catch (err) {
    console.error('Email-to-SMS failed:', err);
    return { success: false };
  }
}

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      *,
      client:client_id(id, phone, carrier, sms_notifications),
      barbers:barber_id(
        id,
        profiles:user_id(id, phone, carrier, sms_notifications, first_name, last_name)
      ),
      service:service_id(name)
    `)
    .eq('status', 'confirmed')
    .eq('reminder_sent', false)
    .gte('date', now.toISOString())
    .lte('date', inOneHour.toISOString());

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results: any[] = [];
  
  for (const booking of bookings) {
    // 1. Resolve Client Carrier if missing
    if (booking.client?.phone && !booking.client.carrier) {
      const carrier = await lookupCarrier(booking.client.phone);
      if (carrier) {
        await supabase.from('profiles').update({ carrier }).eq('id', booking.client_id);
        booking.client.carrier = carrier;
      }
    }


    // 2. Send SMS to Client
    if (booking.client?.phone && booking.client.carrier && booking.client.sms_notifications) {
      const msg = `⏰ Talii Reminder! You have an appointment for "${booking.service?.name}" in 1 hour. See you soon!`;
      const res = await sendSmsViaGateway(booking.client.phone, booking.client.carrier, msg);
      results.push({ booking: booking.id, recipient: 'client', status: res.success ? 'sent' : 'failed' });
    }

    // 3. Resolve Barber Carrier if missing
    const barberProfile = booking.barbers?.profiles;
    if (barberProfile?.phone && !barberProfile.carrier) {
      const carrier = await lookupCarrier(barberProfile.phone);
      if (carrier) {
        await supabase.from('profiles').update({ carrier }).eq('id', barberProfile.id);
        barberProfile.carrier = carrier;
      }
    }

    // 4. Send SMS to Barber
    if (barberProfile?.phone && barberProfile.carrier && barberProfile.sms_notifications) {
      const msg = `📅 Talii Alert! You have a booking ("${booking.service?.name}") starting in 1 hour.`;
      const res = await sendSmsViaGateway(barberProfile.phone, barberProfile.carrier, msg);
      results.push({ booking: booking.id, recipient: 'barber', status: res.success ? 'sent' : 'failed' });
    }

    // 5. Mark as sent
    await supabase.from('bookings').update({ reminder_sent: true }).eq('id', booking.id);
  }

  return new Response(JSON.stringify({ processed: bookings.length, results }), {
    headers: { 'Content-Type': 'application/json' }
  });
})
