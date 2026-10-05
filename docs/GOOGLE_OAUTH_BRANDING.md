# Google OAuth Consent Screen: Branding Checklist

The "wants to access your Google Account" page that users see when
clicking "Continue with Google" is configured in Google Cloud Console,
not AWS. This checklist documents what to set there. The client
settings (authorized JavaScript origins and redirect URIs) live in the
Google OAuth console checklist in `docs/DEPLOY.md`.

## Why this matters

If the consent screen says "Project 604821040168 wants to access your
Google account", users abandon the flow. If it says "GlyphCity wants
to access your Google account" with the Logo_Mark, they don't.

## Where to set it

console.cloud.google.com → select the project that holds the shared
OAuth client → Google Auth Platform → Branding (and Audience, Clients,
Data Access).

If your project is in **Testing** mode, you can publish to **Production**
once the fields below are filled. While testing, only the listed test
users can sign in (max 100). Production mode allows anyone, but if you
upload a logo Google will require **brand verification** before the
unverified-app warning is removed (1 to 6 weeks, free, paperwork only).

We currently use `openid email profile`. These are _not_ sensitive
scopes, so OAuth scope verification is not required. Brand verification
(triggered by uploading the app logo) is a separate review.

## Fields to set (Branding tab)

Values come from `packages/shared/constants/brand.ts`.

| Field                             | Value                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| App name                          | `GlyphCity` (`APP_NAME`)                                                                        |
| User support email                | `support@areacode.co.za` (`SUPPORT_EMAIL`; company mail stays on areacode.co.za)                |
| App logo                          | Square PNG, 1 MB or less. Use the Logo_Mark (`apps/web/public/icon-512.png`), not the wordmark. |
| Application home page             | `https://glyphcity.com`                                                                         |
| Application privacy policy link   | `https://glyphcity.com/legal/privacy`                                                           |
| Application terms of service link | `https://glyphcity.com/legal/terms`                                                             |
| Authorized domains                | `glyphcity.com`                                                                                 |
| Developer contact information     | Your email                                                                                      |

The privacy policy and terms screens are implemented in
`apps/web/src/screens/PrivacyPolicyScreen.tsx` and `TermsScreen.tsx` and
are routed without the bottom nav so a Google reviewer hitting them
without an account sees the document directly.

The support mailbox stays on areacode.co.za because glyphcity.com sends
mail but receives none (decision 4 in
`docs/decisions/glyphcity-rebrand.md`). Change `CONTACT_MAIL_DOMAIN` in
`brand.ts` and this row together when a glyphcity.com inbox exists.

## Scopes (Data Access tab)

Confirm only these three are listed:

- `.../auth/userinfo.email`
- `.../auth/userinfo.profile`
- `openid`

If anything else appears, you've got a config drift. Remove it.

## Authorized domains and the AWS Cognito leakage problem

Google adds the host of each redirect URI to the Authorized domains
list. The four wired pools redirect through their Cognito Hosted UI
domains:

```
area-code-prod-consumer.auth.us-east-1.amazoncognito.com
area-code-prod-business-v2.auth.us-east-1.amazoncognito.com
area-code-prod-staff-v2.auth.us-east-1.amazoncognito.com
area-code-prod-admin.auth.us-east-1.amazoncognito.com
```

Those leak the AWS pool name onto the consent screen ("to continue to
area-code-prod-consumer..."). A clean glyphcity.com publisher line
needs a custom Cognito Hosted UI domain under glyphcity.com for the
consumer pool, defined in Terraform. `docs/COGNITO_CUSTOM_DOMAIN_RUNBOOK.md`
still describes the retired areacode.co.za setup and must be rewritten
for glyphcity.com before it is used. Once that domain exists:

1. In Google Cloud → Clients → the shared OAuth client, **add** the
   custom domain's `/oauth2/idpresponse` redirect URI. Keep the
   amazoncognito.com one until sign-in works on the new one.
2. Point `VITE_COGNITO_HOSTED_UI_DOMAIN` at the custom domain through
   `./scripts/update-all-amplify-apps.ps1` and rebuild the consumer app.
3. Once stable, remove the old amazoncognito.com redirect URI from the
   client, then remove the matching authorized domain.
4. Business, staff and admin can stay on their amazoncognito.com
   domains. Only the consumer pool is consumer-facing.

You **cannot** delete an authorized domain while any active OAuth
client still references it as a redirect URI. Google blocks it. Update
the client first, then delete the domain.

## Brand verification (required if you upload a logo)

When Google's verification team reviews you, they check two things:

1. **You own the home-page domain.** Verified via Google Search Console.
2. **The home page links to the privacy policy.** Verified by fetching
   the URL and scanning for an anchor whose href or text mentions
   privacy.

### Step 1: verify domain ownership (Search Console)

This must be done with the **same Google account** that owns the Cloud
project (currently `reelagents91@gmail.com`).

1. Go to <https://search.google.com/search-console>.
2. Add property → **Domain** (not URL prefix). Enter `glyphcity.com`.
   Domain verification covers all subdomains in one shot.
3. Search Console gives you a TXT record like
   `google-site-verification=abc123...`.
4. Add it at the apex of the glyphcity.com zone in Terraform: an
   `aws_route53_record` of type `TXT` on `aws_route53_zone.glyphcity` in
   `infra/environments/prod/main.tf`. Never add it by hand in the
   console. Run `terraform plan`, then
   `./scripts/deploy-serverless.ps1 -Environment prod -TerraformOnly`.
   If a TXT record already exists at the apex, add the verification
   value as a second string in the same record. Don't replace it.
5. Wait 5 to 10 min, then click "Verify" in Search Console.

The areacode.co.za verification TXT stays in that zone for the company
(decision 4 in `docs/decisions/glyphcity-rebrand.md`). It does not cover
glyphcity.com.

### Step 2: privacy link on the home page

Already in place. `apps/web/src/screens/AuthLanding.tsx` renders a
visible footer with "Privacy Policy", "Terms", and "Contact" links on
the unauthenticated landing page. The privacy policy itself lives at
`/legal/privacy` and is reachable without login.

If you change either the path or the visibility of that footer, brand
verification will fail on re-submission.

### Step 3: re-submit

In Google Cloud → Branding → "Branding verification issues" panel, tick
"I have fixed the issues" and request re-verification. Turnaround is
usually a few days but can stretch to a few weeks.

## Test users (only relevant in Testing mode)

Add the email addresses of every person who needs to sign in during the
SA pilot:

- The founder
- Each pilot venue owner
- Pilot staff who'll log in via Google

Once you publish to Production this list is irrelevant.

## Publishing to Production

In Audience tab, the publishing status should read **In production**.
Don't click "Back to testing". That re-restricts logins to whitelisted
test users.

The OAuth user cap (100 by default) only applies when requesting
unapproved sensitive or restricted scopes. Since we use only
`openid email profile`, the cap doesn't constrain us in practice.

## Sanity checks after publishing

1. Open an incognito window. Go to `https://glyphcity.com`. Click
   "Continue with Google". The consent screen should show:
   - "Sign in to GlyphCity" title
   - The Logo_Mark
   - Only `openid email profile` permissions listed
   - "glyphcity.com" as the publisher (not the AWS Cognito hostname;
     this only happens once the custom Cognito domain is live)
   - No "this app isn't verified" warning (only after brand
     verification approves)
2. Sign in with a Google account that's not on the test-users list. It
   should work (in Production) or fail with "Access blocked: Authorization
   Error" (in Testing).
3. From an incognito window with no GlyphCity session, navigate
   directly to `https://glyphcity.com/legal/privacy` and
   `https://glyphcity.com/legal/terms`. Both should render without a
   login prompt.

## What this doesn't cover

- The custom Cognito Hosted UI domain under glyphcity.com. The Google
  branding work here and the Cognito domain work are independent. Both
  matter, both should be done.
- Cognito Hosted UI CSS, already applied via the AWS CLI. Affects only
  the rare case where Cognito needs to show its own login form.
