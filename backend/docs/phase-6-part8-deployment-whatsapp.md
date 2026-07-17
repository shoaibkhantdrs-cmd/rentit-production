# Phase 6 Part 8 — Deployment Guide: WhatsApp Business Cloud API

For the dev-setup flow (test number, temporary token), see root `docs/phase-5.md` "Provider setup guide." This covers what production adds — Meta's own verification/approval process has changed shape more than once, so treat the steps below as "what to expect and prepare for," and confirm the exact current flow directly in Meta's Business/WhatsApp Cloard API documentation before relying on specifics like review timelines.

## Test number vs. a real production number

`docs/phase-5.md`'s dev setup uses the free test phone number Meta provisions automatically for development, which can only message a short list of pre-verified recipient numbers. Production requires registering a **real phone number** the business actually owns (a number not already registered to a personal WhatsApp/WhatsApp Business app) through Meta Business Manager, plus completing Meta's Business Verification process for that Business Manager account. This is an identity/business-legitimacy review on Meta's side, not a technical integration step, and historically has taken anywhere from same-day to multiple weeks depending on the business and documentation provided — start this well before a planned launch date, not the week of.

## Permanent access token

The dev `WHATSAPP_ACCESS_TOKEN` from a temporary token expires (historically within 24 hours for the quickstart flow). Production needs a **permanent** System User access token instead: create a System User in Meta Business Manager, assign it the WhatsApp Business Account, generate a token for it with the `whatsapp_business_messaging` permission, and use that long-lived token as `WHATSAPP_ACCESS_TOKEN` in `.env.production`. Rotate it if ever exposed — same handling as any other long-lived secret in this system.

## Message templates for the first contact

WhatsApp's platform rules require using a pre-approved message template for any message sent to a user outside a 24-hour customer-service window (i.e., the business messaging first, rather than replying to an inbound message) — this app's existing `WhatsAppCloudApiService`/use-cases (contact-owner, inquiry notifications) should be checked against which of its message types are the "business-initiated" kind and get those templates submitted for Meta's approval ahead of launch, since an unapproved template is simply rejected at send time in production the same way it would be in the sandbox/test environment.

## Webhook URL

The webhook Meta calls for inbound messages/delivery status must point at the real production backend URL (`https://api.example.com/api/whatsapp/webhook` or wherever it's actually routed), registered in Meta Business Manager's WhatsApp configuration, with the verify token matching what the backend expects — this is a one-time registration step per environment (dev used a tunneling tool like ngrok pointing at localhost; production points directly at the real domain, no tunnel involved).

## Rate limits

WhatsApp Cloud API messaging throughput is tiered by the business's "quality rating" and messaging limits Meta assigns (these scale up automatically with a track record of good engagement, starting from a modest daily limit) — this is Meta-side and not something this codebase's own `createMessagingRateLimiter` (Part 2) controls, though that rate limiter still matters for protecting this app's own resources regardless of what Meta separately allows.
