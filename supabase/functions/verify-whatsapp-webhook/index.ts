import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
const WHATSAPP_APP_SECRET = Deno.env.get('WHATSAPP_APP_SECRET');

// Use Web Crypto API (Deno-compatible) instead of Node's crypto
async function verifyWhatsAppSignature(payload: string, signature: string): Promise<boolean> {
  if (!WHATSAPP_APP_SECRET) return false;
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(WHATSAPP_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  
  const expectedSignature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  const expectedHex = Array.from(new Uint8Array(expectedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const providedSignature = signature.replace('sha256=', '');
  
  // Constant-time comparison
  if (expectedHex.length !== providedSignature.length) return false;
  
  let result = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    result |= expectedHex.charCodeAt(i) ^ providedSignature.charCodeAt(i);
  }
  return result === 0;
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
      const isValid = await verifyWhatsAppSignature(payload, signature);
      if (!isValid) {
        return new Response('Invalid signature', { status: 401, headers: corsHeaders });
      }
    }

    const body = JSON.parse(payload);
    
    // Process WhatsApp Business API webhook
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
      console.error('WhatsApp verification failed:', error.message);
      // Don't expose internal errors to WhatsApp
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    // Return 500 for unhandled errors so WhatsApp retries
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});