// Supabase Edge Functions don't add CORS headers by default; the browser (Expo web)
// preflights every functions.invoke() call, so every response — including errors —
// must carry these.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
