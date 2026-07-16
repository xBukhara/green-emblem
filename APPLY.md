# Green Emblem — Design Studio Update

## 1. DELETE these from your project first
- app/api/webhooks/stripe/route.ts.ts   (broken duplicate — keep route.ts)
- app/campaigns/premium-qr/             (entire folder)
- app/api/payments/premium-qr/          (entire folder)

## 2. COPY everything in this zip into the project root
Overwrite when prompted. New folders included:
public/, app/api/templates/, app/api/campaigns/request/

## 3. RUN design-studio.sql in Supabase SQL Editor
Creates campaign_templates + RLS, activates pending campaigns/requests.

## 4. PUSH
git add . && git commit -m "feat: design studio + brand refresh" && git push
