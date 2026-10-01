import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
const WHATSAPP_APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET');

function verifyWhatsAppSignature(payload: string, signature: string): boolean {
  if (!WHATSAPP_APP_SECRET) return false;
  
  const crypto = await import('node:crypto');
  const expectedSignature = crypto
    .createHmac('sha256', WHATSAPP_APP_SECRET)
    .update(payload)
    .digest('hex');
  
  const providedSignature = signature.replace('sha256=', '');
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(providedSignature)
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // GET request for webhook verification
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Verify webhook signature
    const signature = req.headers.get('x-hub-signature-256');
    const payload = await req.text();
    
    if (WHATSAPP_APP_SECRET && signature) {
      if (!verifyWhatsAppSignature(payload, signature)) {
        return new Response('Invalid signature', { status: 401, headers: corsHeaders });
      }
    }

    const body = JSON.parse(payload);
    
    // Process WhatsApp Business API webhook
    // Structure: entry[0].changes[0].value.messages[0]
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messages = value?.messages;
    
    if (!messages || messages.length === 0) {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const message = messages[0];
    const fromPhone = message.from; // Format: "919876543210" (no +)
    const messageText = message.text?.body || '';

    // Check if this is a verification message
    // User sends "VERIFY_<token>" 
    const verifyMatch = messageText.match(/^VERIFY_([a-f0-9]{64})$/i);
    if (!verifyMatch) {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const token = verifyMatch[1].toLowerCase();
    const normalizedPhone = '+' + fromPhone; // Add + prefix

    // Call verify_phone_session RPC with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const { error } = await supabase.rpc('verify_phone_session', {
      p_token: token,
      p_provider_phone: normalizedPhone,
    });

    if (error) {
      console.error('Verification failed:', error.message);
      // Don't expose internal errors to WhatsApp
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('OK', { status: 200, headers: corsHeaders });
  }
});