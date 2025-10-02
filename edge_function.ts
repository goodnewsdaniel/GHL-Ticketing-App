import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// This is the main Deno request handler
Deno.serve(async (req) => {
  // CORS headers are required for the browser to call this function
  // if you were ever to call it directly. For a webhook, it's good practice.
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle a preflight request for CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // --- Security Check ---
    // We will add a secret key later as an environment variable
    // This is more secure than putting it in the URL
    const secret = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (secret !== Deno.env.get('GHL_WEBHOOK_SECRET')) {
      throw new Error('Unauthorized: Invalid secret key.');
    }

    const payload = await req.json();
    const seatId = payload.product_name; // Adjust if GHL sends it differently

    if (!seatId) {
      throw new Error('Bad Request: Missing product name (seat ID) in payload.');
    }

    // Create an admin client to bypass RLS for the update
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SERVICE_ROLE_KEY')!
    );

    // Update the database to mark the seat as "unavailable"
    const { error } = await supabaseAdmin
      .from('seats')
      .update({ status: 'unavailable' })
      .eq('name', seatId);

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    const responseData = { success: true, seat: seatId, message: 'Seat marked as unavailable.' };
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401, // Use 401 for auth errors, 400 for bad data
    });
  }
});