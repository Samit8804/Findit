import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
const TELEGRAM_WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    // Verify Telegram webhook secret
    const secretHeader = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (TELEGRAM_WEBHOOK_SECRET && secretHeader !== TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    
    const message = body.message;
    const callbackQuery = body.callback_query;
    
    let fromUser: any = null;
    let chatId: string | null = null;
    let contactPhone: string | null = null;
    let contactUserId: string | null = null;
    let startParam: string | null = null;

    if (message) {
      fromUser = message.from;
      chatId = String(message.chat.id);
      
      // Check for contact sharing
      if (message.contact) {
        contactPhone = message.contact.phone_number;
        contactUserId = message.contact.user_id ? String(message.contact.user_id) : null;
      }
      
      // Check for /start command with token
      if (message.text?.startsWith('/start')) {
        const parts = message.text.split(' ');
        if (parts.length > 1) {
          startParam = parts[1];
        }
      }
    } else if (callbackQuery) {
      fromUser = callbackQuery.from;
      chatId = String(callbackQuery.message?.chat?.id);
      startParam = callbackQuery.data;
    }

    if (!fromUser || !chatId) {
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let token: string | null = null;
    
    if (startParam?.startsWith('VERIFY_')) {
      token = startParam.substring(7).toLowerCase();
    }

    if (token) {
      // Store token against this chat_id for later contact verification
      const { data: session, error: sessionError } = await supabase
        .from('phone_verification_sessions')
        .update({ 
          telegram_chat_id: chatId,
          telegram_user_id: String(fromUser.id),
          updated_at: new Date().toISOString()
        })
        .eq('token', token)
        .eq('method', 'telegram')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .select('token')
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!session) {
        await sendTelegramMessage(chatId, 'This verification link has expired or is invalid. Please start again from FindIt.');
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      await sendTelegramMessage(chatId, 
        'Please share your phone number to complete verification.\n\n' +
        'Tap the button below 👇',
        {
          reply_markup: {
            keyboard: [[
              { text: '📱 Share Phone Number', request_contact: true }
            ]],
            one_time_keyboard: true,
            resize_keyboard: true,
          },
        }
      );
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    if (contactPhone) {
      // Verify the contact belongs to the sender
      if (contactUserId && contactUserId !== String(fromUser.id)) {
        await sendTelegramMessage(chatId, 'Please share your own phone number using the button above.');
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      // Find the pending session for this chat
      const { data: session, error: sessionError } = await supabase
        .from('phone_verification_sessions')
        .select('token')
        .eq('telegram_chat_id', chatId)
        .eq('telegram_user_id', String(fromUser.id))
        .eq('method', 'telegram')
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionError) throw sessionError;
      if (!session) {
        await sendTelegramMessage(chatId, 'No active verification found for this chat. Please start again from FindIt.');
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      const normalizedPhone = contactPhone.startsWith('+') ? contactPhone : '+' + contactPhone;
      const { error } = await supabase.rpc('verify_phone_session', {
        p_token: session.token,
        p_provider_phone: normalizedPhone,
      });

      if (error) {
        await sendTelegramMessage(chatId, 
          '❌ Verification failed: ' + error.message + '\n\n' +
          'Please try again or contact support.'
        );
        // Return 500 so Telegram retries on transient failures
        return new Response('Internal error', { status: 500, headers: corsHeaders });
      } else {
        await sendTelegramMessage(chatId, 
          '✅ Phone number verified successfully!\n\n' +
          'You can now post ads on FindIt.'
        );
      }
    }

    return new Response('OK', { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    // Return 500 for unhandled errors so Telegram retries
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});

async function sendTelegramMessage(chatId: string, text: string, options: any = {}) {
  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!TELEGRAM_BOT_TOKEN) return;
  
  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...options }),
  });
}