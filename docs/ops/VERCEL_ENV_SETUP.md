VERCEL ENV VAR SETUP

Purpose

Document for the Vercel environment variables required by the demo. This file contains the exact variable names to add (no secret values here), verification steps, and a Slack-ready message for Vin to paste into the Vercel UI.

Required environment variable names (add to Production and Preview/Development):

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY  # server-only; never expose client-side
- SUPABASE_ANON_KEY          # optional for client-side reads

- GEMINI_API_KEY             # LLM provider (placeholder name: Gemini)
- ANTHROPIC_API_KEY          # alternative LLM provider
- RESEND_API_KEY             # email/sms demo fallback

- TWILIO_ACCOUNT_SID         # already expected to exist in Production+Development
- TWILIO_AUTH_TOKEN
- TWILIO_MESSAGING_SERVICE_SID  # if used

Notes

- Never commit secret values into the repo. Use Vercel's encrypted environment variables UI.
- Add variables at two scopes: Production and Preview (Development). If your team uses a separate Development scope, add there as well.
- For Supabase, prefer SUPABASE_SERVICE_ROLE_KEY server-only, the service role key is required for server-side writes. Do NOT set it in client-exposed contexts.

Verification steps

1. In Vercel: Project → Settings → Environment Variables. Add each variable name and paste the secret value.
2. After adding, either push a trivial commit to the tony branch or click Deploy → Redeploy to trigger a build.
3. Confirm the deployment succeeded on https://better-rx-dme.vercel.app (Production) and open the /demo page at a 390px width viewport. If the site errors at runtime, check Vercel build logs for missing env errors.
4. Optional: For server-side sanity, curl the demo control panel page: `curl -sS https://better-rx-dme.vercel.app/demo` should return an HTML response. If engine endpoints 500, the logs will show which env var was missing.

Slack-ready one-liner for Vin

"Hi — please add these encrypted env vars to the BetterRX Vercel project (Production + Preview): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, RESEND_API_KEY. TWILIO_* are already set. Tag me when done and I'll redeploy and smoke-test /demo at 390px. — Tony"

If Vercel access is not available to you, paste the secret values into a secure channel for someone with Vercel access to add them. Document any missing provider accounts (Gemini/Anthropic/Resend) in wiki/facts/open-questions.md.
