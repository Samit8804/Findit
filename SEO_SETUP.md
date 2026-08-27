# FindIt SEO Setup Guide

This document prepares FindIt (`https://yourdomain.com`) for Google Search Console and long-term organic indexing.

## 1. Domain Verification

1. In [Google Search Console](https://search.google.com/search-console) click **Add property** → **Domain** (recommended) or **URL prefix**.
   - Domain: `yourdomain.com` (covers all subdomains/protocols)
   - URL prefix: `https://yourdomain.com` (simpler, single protocol)

2. **Verify ownership** via one of:
   - **DNS TXT** (Domain property only) — add the TXT record Google provides to your DNS (Cloudflare / Route 53 / Namecheap). Wait for propagation (5 min – 24 h), then **Verify** in GSC.
   - **HTML file upload** — download the file Google provides and place it at `public/googleXXXXXXXX.html` (served as `https://yourdomain.com/googleXXXXXXXX.html`).
   - **HTML tag** — add the meta tag to `src/app/layout.tsx` inside `<head>` (we already export `metadataBase` from `NEXT_PUBLIC_SITE_URL` so relative verification files resolve correctly).

> **Do not** attempt to automate verification via API — it requires manual DNS/file placement.

3. Set `NEXT_PUBLIC_SITE_URL=https://yourdomain.com` in your production `.env` so canonicals, sitemap and Open Graph use the live domain.

## 2. Sitemap Submission

- Sitemap URL: `https://yourdomain.com/sitemap.xml` (dynamic, `revalidate = 3600`)
  - Includes: approved ads (`status = approved`, not deleted/expired), category + subcategory pages, `category/location` combos (limited to 6×5 useful combos), location pages, business pages, and static public pages.
  - Excludes: `/login`, `/register`, `/dashboard/*`, `/admin/*`, `/messages`, `/favorites`, `/payment/*`, `/api/*` (per `robots.ts` disallow).
- In GSC: **Sitemaps** → **Add a new sitemap** → enter `sitemap.xml` → **Submit**.
- Keep `robots.ts` synced — it advertises: `Sitemap: https://yourdomain.com/sitemap.xml`.

**Behavior:**
- New approved ad → appears in sitemap within ≤1 hour (revalidation).
- Expired/deleted ad → removed from sitemap automatically (filtered by `status` and `expires_at`).

## 3. URL Inspection

- In GSC use **URL Inspection** → paste any public URL (e.g., `https://yourdomain.com/ad/honda-city-vx-automatic-noida`) → **Test live URL**.
- Checks: indexing eligibility, canonical, mobile usability, structured data.

## 4. Index Coverage

- **Monitor:** GSC → **Pages** → *Not indexed* reasons (e.g., `Discovered - currently not indexed`, `Crawled - currently not indexed`).
- **Expected:**
  - Public pages (`/`, `/category/*`, `/location/*`, `/ad/*`, `/business/*`, `/browse`) → *Indexed* over time.
  - Private pages (`/dashboard`, `/admin`, `/login`, etc.) → *Excluded by robots.txt / noindex* (intentional).
- **Fix soft-404s:** Invalid category/location combos return real `404` via `notFound()` — do not create empty thin pages.

## 5. Core Web Vitals (Performance SEO)

The site is built for good CWV out of the box:

- **LCP:** Hero image uses `next/image` with `priority` on homepage; other images lazy-load. Avoid adding large above-the-fold scripts.
- **CLS:** All `next/image` instances have intrinsic sizes; AVIF/WebP preferred via `next.config.ts` `formats: ["image/avif","image/webp"]`.
- **INP:** Client components are code-split; animations are Framer Motion with reduced motion respected.
- **Monitor:** GSC → **Core Web Vitals** → Mobile/Desktop. Also test with PageSpeed Insights and Lighthouse.

## 6. Search Performance

- After indexing stabilizes (2–4 weeks): **Performance** → *Search results* → Queries like `cars for sale in Noida`, `FindIt classified ads` will appear.
- Filter by **Page** to compare category vs. ad vs. business performance.

## 7. Common Indexing Problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Discovered - currently not indexed` | Thin/duplicate pages | Ensure category/location pages have unique intro content (we do) and real listings |
| `Crawled - currently not indexed` | Low value vs. crawl budget | Strengthen internal linking: homepage → categories → locations → featured/related ads (already implemented) |
| `Blocked by robots.txt` on `/ad/*` | Over-broad disallow | Verify `robots.ts` only disallows private paths |
| `Duplicate without user-selected canonical` | Filter params indexed | Canonicals on `/browse` always point to `/browse` (without `?q` etc.); filtered views are `noindex` via header where configured |
| Expired ads still indexed | Sitemap lag | Expired ads get `410 Gone` handling: deleted → `404`, expired → noindex + visible “expired” banner; sitemap drops them next revalidation |

## 8. What We Do NOT Do

- No Google Indexing API for normal ads (reserved for job postings/live streams only).
- No doorway pages, keyword stuffing, fake structured data or AI mass pages.

## 9. Quick Validation Checklist

```bash
npm run build   # must succeed, 0 TypeScript errors
curl https://yourdomain.com/robots.txt      # see sitemap + disallows
curl https://yourdomain.com/sitemap.xml     # only public URLs
# View source of any /ad/<slug>
#  - <title> unique, <meta name="description">, <link rel="canonical">
#  - <meta property="og:*"> with image
#  - <script type="application/ld+json"> for Product + BreadcrumbList (validate at validator.schema.org)
```

Set `NEXT_PUBLIC_SITE_URL` correctly before first production deploy — all canonicals and sitemap URLs derive from it.
