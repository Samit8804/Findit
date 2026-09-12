# FindIt - QA Test Plan

## Execution Summary
- **Test Type**: Comprehensive QA + Security + Performance + Accessibility
- **Environment**: Local development, staging (if available), production (safe tests only)
- **Testing Approach**: Manual functional testing + security regression + payment testing
- **Payments**: Razorpay TEST MODE only - NEVER real payments during automated testing
- **Build**: `npm run build` verified before testing

---

## 1. TEST ENVIRONMENT

### 1.1 Development Environment
- **Framework**: Next.js 16.3.1 with App Router
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **Payments**: Razorpay TEST MODE
- **Node Version**: Node.js 20+
- **Browser**: Chrome, Firefox, Edge, Safari (critical workflows)

### 1.2 Staging Environment (If Available)
- Separate Supabase project or same with staging flag
- Environment variables configured for staging URL
- Payment test mode enabled

### 1.3 Production Environment
- **DO NOT perform destructive tests against production**
- Safe tests only (login, logout, navigation, non-destructive actions)
- Monitor for any issues from previous deployments

### 1.4 Test Status Categories
- **PASS**: Test executed and verified working
- **FAIL**: Test executed and verified broken
- **BLOCKED**: Cannot test due to environment/configuration issues
- **NOT TESTED**: No test coverage yet

---

## 2. QUALITY AREAS & TEST CASES

### 2.1 Authentication Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Registration with valid data | User created, redirected to login | |
| Registration with invalid email | Error message displayed | |
| Registration with weak password | Error message displayed | |
| Duplicate registration | Error - email already exists | |
| Login with valid credentials | Successful authentication | |
| Login with incorrect password | Error message displayed | |
| Login with nonexistent account | Error message displayed | |
| Logout | Session cleared, redirected to login | |
| Password reset flow | Reset link sent to email | |
| Session persistence | Remains logged in across page refresh | |
| Session expiration | Logged out after timeout | |
| Unauthorized access to protected page | Redirected to login | |
| Invalid credentials login | Error displayed, account not locked | |

### 2.2 Authorization Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Normal user accesses `/admin` | ACCESS DENIED (403 or redirect) | |
| Moderator accesses admin features | ACCESS DENIED or limited | |
| Admin accesses super_admin only features | ACCESS DENIED | |
| Normal user modifies another user's ad | ACCESS DENIED | |
| Normal user accesses another user's dashboard | ACCESS DENIED | |
| Direct URL access to protected routes | Proper authorization check | |
| Role escalation attempt (user→admin) | DENIED via RLS/server-side | |
| API endpoint without auth token | 401 Unauthorized | |

### 2.3 Account Security Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Logout from one session | Other sessions remain active (unless configured otherwise) | |
| Password change | Old session invalidated or remains valid | |
| Email change | Updated in profile and auth | |
| Suspended account cannot post ads | ACCESS DENIED or limited functionality | |
| Banned account complete block | Cannot access any features | |
| Session after account suspension | Behavior depends on policy | |
| Multiple concurrent sessions | Behavior depends on Supabase config | |

### 2.4 Profile Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Create profile on first login | Auto-created via Supabase trigger | |
| Edit own profile | Changes saved successfully | |
| Edit another user's profile | ACCESS DENIED | |
| Profile image upload | Valid image stored, invalid rejected | |
| Username uniqueness | Error if duplicate | |
| Bio length limit | Truncated or error at limit | |
| Location selection | Valid location from database | |
| Public profile viewable | Yes, appropriate data shown | |
| Private information not exposed | Email, phone only to owner/admin | |

### 2.5 Business Profile Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Create business profile | Additional fields for business | |
| Edit own business | Changes saved, ownership verified | |
| Edit another business | ACCESS DENIED | |
| Business logo upload | Valid image, invalid rejected | |
| Business description | Appropriate length/format | |
| Business verification status | Visible on public page | |
| Public business page | Correctly displays business info | |
| Verification request flow | Submitted, reviewed, approved/rejected | |

### 2.6 Ad Creation Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Valid ad creation | Ad created, pending moderation | |
| Missing required fields | Error messages for each missing field | |
| Invalid price (negative) | Error "Price must be greater than 0" | |
| Very large price (e.g., 999999) | Error or warning displayed | |
| Very long title (e.g., 500 chars) | Truncated or error | |
| Very long description (e.g., 10000 chars) | Truncated or error | |
| Special characters in title | Handled safely, no XSS | |
| HTML in title/description | Rendered safely, no executable script | |
| Script payload in title | ` <script>alert(1)</script> ` → displayed as text | |
| Empty fields | Error messages displayed | |
| Invalid category selection | Error or default category | |
| Invalid location selection | Error or default location | |
| Image upload - valid JPG/PNG | Image stored, preview shown | |
| Image upload - invalid extension | Error "Invalid file type" | |
| Image upload - fake extension (.txt.jpg) | Rejected, not stored | |
| Image upload - very large dimensions | Resized or error "Too large" | |
| Image upload - very large file size | Error "File too large" | |
| Form with all valid data | Ad submitted, success message | |
| Form validation before submit | Client-side validation works | |
| Server-side validation also works | Even if client bypassed | |

### 2.7 Ad Editing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Edit own ad | Changes saved successfully | |
| Change ad price | New price stored, validated | |
| Change ad description | New description stored | |
| Change ad location | New location selected | |
| Change ad title | New title stored, validated | |
| Update ad images | New images added, old retained or replaced | |
| Cancel editing | Changes discarded, ad unchanged | |
| Edit another user's ad | ACCESS DENIED | |
| Non-admin trying to change status to approved | ACCESS DENIED / trigger prevents | |
| Changing is_featured | Blocked by guard_ad_update trigger | |
| Changing views_count/favorites_count | Blocked by guard_ad_update trigger | |

### 2.8 Ad Deletion

| Test Case | Expected | Status |
|-----------|----------|--------|
| Delete own ad | Ad removed, soft delete (deleted_at) | |
| Delete another user's ad | ACCESS DENIED | |
| Deleted ad direct URL | Returns 404 or access denied | |
| Deleted ad in search | Does not appear in search results | |
| Deleted ad in sitemap | Not included (if sitemap filters) | |
| Deleted ad in category pages | Filtered out | |
| Deleted ad in favorites | Removed from favorites | |
| Delete ad with images | Images also removed from storage | |
| Ad with favorites | Removal behavior defined | |

### 2.8 Ad Moderation

| Test Case | Expected | Status |
|-----------|----------|--------|
| Pending ad state | Visible to moderators/admins only | |
| Approved ad state | Publicly visible | |
| Rejected ad state | Not publicly visible, owner notified | |
| Changes requested state | Owner can resubmit | |
| Suspended ad state | Not visible, owner restricted | |
| Expired ad state | Automatically expired or admin action | |
| Sold ad state | Marked as sold, visibility adjusted | |
| Normal user setting status to approved | BLOCKED by database trigger | |
| Normal user setting is_featured | BLOCKED by database trigger | |
| Normal user changing rejection reason | BLOCKED by RLS/triggers | |

### 2.9 Search Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Normal search | Relevant results returned | |
| Empty search | All approved ads or prompt to enter search | |
| No results | Empty state displayed, no crash | |
| Special characters in search | Handled safely, no crash | |
| Very long search string | Handled gracefully, no performance issue | |
| Case differences | Case-insensitive or handled | |
| Multiple words search | AND/OR logic as designed | |
| Price filters | Correctly filter by price range | |
| Category filters | Only ads in selected category | |
| Location filters | Only ads in selected location | |
| Sorting (newest, oldest, price) | Results sorted correctly | |
| Pagination | Works, no loading all records | |
| Search does not crash | With any input | |
| Search performance | Acceptable with large datasets | |

### 2.10 Category Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Category pages load | Correct ads displayed | |
| Subcategories | Drill-down functionality | |
| Empty category | Empty state, no crash | |
| Category filtering | Only ads in that category | |
| Category URLs | Proper slug format, SEO-friendly | |
| Only approved/public ads appear | Draft/rejected filtered out | |
| Breadcrumb navigation | Present and correct | |

### 2.11 Location Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| City/State/Locality pages | Load correctly | |
| Location filters | Ads filtered by location | |
| Location URLs | Working, SEO-friendly | |
| Private user location not exposed | Only public/ad-related locations | |
| Hierarchy navigation | Country → State → City → Locality | |

### 2.12 Favorites

| Test Case | Expected | Status |
|-----------|----------|--------|
| Add to favorites | Ad added to user's favorites | |
| Remove from favorites | Ad removed from favorites | |
| View favorites list | User's saved ads listed | |
| Duplicate favorite | Cannot add same ad twice (unique constraint) | |
| Unauthenticated favorite | Prompt to login or no effect | |
| User A cannot modify User B's favorites | ACCESS DENIED | |
| Favorite count on ad | Correct count displayed | |
| Favorites RLS policies | Working correctly | |

### 2.13 Messaging

| Test Case | Expected | Status |
|-----------|----------|--------|
| Start conversation | Conversation created between two users | |
| Send message | Message delivered to recipient | |
| Receive message | Message appears in conversation | |
| Multiple messages | Threaded conversation | |
| Unread status | Marked unread, count shown | |
| Read status | Marked read after opening | |
| Block user | Cannot send messages to blocked user | |
| Deleted ad in conversation | Conversation behavior defined | |
| Deleted account in conversation | Behavior defined (retain or remove) | |
| Participant-only access | Non-participants cannot read messages | |
| Message rate limiting | 20 messages/minute trigger | |
| Message immutability | Sender cannot edit/delete own messages | |
| Recipient can mark read | Only recipient can mark messages read | |

### 2.14 Message Security

| Test Case | Expected | Status |
|-----------|----------|--------|
| HTML in messages | Rendered as text, not executed | |
| JavaScript in messages | ` <script>alert(1)</script> ` → displayed as text | |
| URLs in messages | Rendered as clickable links or plain text | |
| Very long content | Truncated or error at limit (2000 chars in DB) | |
| Special characters | Handled safely | |
| XSS payloads | Safely escaped | |
| Image tags in messages | `<img>` tags handled or stripped | |

### 2.15 Reporting

| Test Case | Expected | Status |
|-----------|----------|--------|
| Report advertisement | Submitted with reason | |
| Report user | Submitted with reason | |
| Report business | Submitted with reason | |
| Duplicate reports | Allowed but noted, not duplicated processing | |
| Invalid report | Error shown, reason required | |
| User cannot manipulate moderation state | ACCESS DENIED | |
| Reports reviewed by moderators/admins | Only authorized roles | |
| False reports handled appropriately | Defined policy | |
| Admin can view all reports | With appropriate RLS | |

### 2.16 Notifications

| Test Case | Expected | Status |
|-----------|----------|--------|
| In-app notifications | Visited via dashboard/navbar | |
| Mark as read | Status updated | |
| Delete notifications | If supported, removed | |
| Notification preferences | Enabled/disabled working | |
| Promotion emails | Opt-in/opt-out working | |
| Message notifications | Based on preferences | |
| New message notification | Recipient notified | |
| Correct user association | Notifications only for correct user | |
| Multiple devices | Consistent if supported | |

### 2.17 Email Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Welcome email | New user receives on registration | |
| Verification email | Sent, link validates email | |
| Password reset email | Link resets password | |
| Ad submitted email | Confirmation sent | |
| Ad approved email | Notification of approval | |
| Ad rejected email | Notification with reason | |
| New message email | Notification sent to recipient | |
| Payment success email | Sent after successful payment | |
| Payment failure email | Sent after failed payment | |
| Refund email | If supported, sent on refund | |
| Promotion activated email | Sent when promotion starts | |
| Promotion expiry email | Sent when promotion ends | |
| Correct recipient | Only user involved receives | |
| Correct content | Relevant information, no errors | |
| Correct links | Working URLs in emails | |
| No duplicate emails | Same event doesn't send multiple emails | |
| No sensitive information | No passwords, tokens, secrets in emails | |

### 2.18 Email Failure

| Test Case | Expected | Status |
|-----------|----------|--------|
| Simulate email failure | Core operation still succeeds | |
| Ad approval email fails | Ad remains approved | |
| Payment success email fails | Payment still recorded as paid | |
| Welcome email fails | Registration still completes | |
| New message email fails | Message still stored | |
| No rollback on email failure | Business operation not undone | |

### 2.19 Payment Testing (Razorpay TEST MODE)

| Test Case | Expected | Status |
|-----------|----------|--------|
| Create order API | Order created, details returned | |
| Open Razorpay checkout | Checkout opens with correct amount | |
| Successful payment | Order marked paid, promotion activated | |
| Failed payment | Order marked failed, no promotion | |
| Cancelled payment | Order remains cancelled/created | |
| Duplicate webhook | Only one order/promotion created (idempotent) | |
| Delayed webhook | Handled correctly, no duplicate | |
| Invalid webhook signature | Rejected, no action taken | |
| Incorrect amount manipulation | Fails (server determines price) | |
| Expired order | Order status updated or cancelled | |
| Payment without ad | Business subscription works | |
| Payment with ad | Promotion activated on ad | |
| Refund processing | If supported, processed correctly | |

### 2.20 Payment Security

| Test Case | Expected | Status |
|-----------|----------|--------|
| Manipulate browser price from ₹1 to ₹1 | Fails (server uses DB price) | |
| Manipulate promotion type | Fails (server validates) | |
| Set payment status to paid | Fails (signature verification) | |
| Activate Featured without payment | FAILS - backend controlled | |
| Activate Top Listing without payment | FAILS - backend controlled | |
| Activate Boost without payment | FAILS - backend controlled | |
| Modify Razorpay order ID | Fails (signature verification) | |
| Modify payment ID | Fails (signature verification) | |
| Replay old webhook | Idempotent, no duplicate | |
| Modify webhook data | Fails (signature verification) | |

### 2.21 Payment Duplication

| Test Case | Expected | Status |
|-----------|----------|--------|
| Simulate duplicate webhook | Only one order created | |
| | Only one payment record | |
| | Only one promotion activated | |
| | Only one success email sent | |
| Webhook retry scenario | Safe, no state corruption | |

### 2.22 Promotion Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Featured Ad promotion | Active for duration, then expires | |
| Top Listing promotion | Active for duration, then expires | |
| Boost promotion | Active for duration, then expires | |
| Payment required | Cannot activate without valid payment | |
| Correct duration | Matches promotion config (3/7/30 days) | |
| Correct expiration | Automatically expires after duration | |
| Correct ranking | Featured ads prioritized appropriately | |
| Correct status | 'active' → 'expired' after duration | |
| After expiry: promotion stops | No longer featured/top/boosted | |
| Multiple promotions | Only one active per ad (order_id unique) | |
| Business subscription | Different promotion type handled | |

### 2.23 Featured Ranking Test

| Test Case | Expected | Status |
|-----------|----------|--------|
| Ad A = normal | Normal ranking | |
| Ad B = featured | Promotional priority | |
| Ad C = featured but irrelevant | Not for unrelated searches | |
| Ad D = normal but highly relevant | Relevant ads rank well | |
| Featured provides priority | But not completely irrelevant | |
| Search results logic | Relevant + featured ordering | |
| Paid ads don't dominate | Relevance still matters | |

### 2.24 Analytics Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Page view event | Recorded correctly | |
| Ad view event | Recorded correctly | |
| Search event | Recorded with query | |
| Favorite event | Recorded with ad/user | |
| Message event | Recorded | |
| Ad creation event | Recorded | |
| Payment event | Recorded (without sensitive data) | |
| Promotion event | Recorded | |
| Events contain only intended info | No passwords, credentials, private data | |
| Seller sees only own analytics | Correct privacy | |
| Admin sees platform analytics | Correct access | |
| Normal users cannot access admin analytics | ACCESS DENIED | |

### 2.25 Analytics Accuracy

| Test Case | Expected | Status |
|-----------|----------|--------|
| Repeated ad views | Not create unreasonable duplicates (or counted as designed) | |
| Unique visitor counting | As designed | |
| Geographic tracking | If implemented | |

### 2.26 Email Preference Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Message notifications enabled | User receives message notifications | |
| Message notifications disabled | User does not receive | |
| Marketing emails enabled | User receives promos | |
| Marketing emails disabled | User does not receive promos | |
| Promotion emails enabled | User receives promotion updates | |
| Promotion emails disabled | User does not receive promos | |
| Preferences stored correctly | Persisted in user profile | |
| Security-critical emails follow policy | Defined behavior | |

### 2.27 Admin Dashboard

| Test Case | Expected | Status |
|-----------|----------|--------|
| Dashboard access | Only authorized admins | |
| Users management | Admins can view/manage | |
| Advertisements management | Admins can moderate | |
| Reports view | Admins can see reports | |
| Payments view | Admins can see payment summary | |
| Promotions view | Admins can manage | |
| Analytics view | Admins can see platform stats | |
| Moderation actions | Approve/reject/ban working | |
| Audit logs view | Admins can see audit trail | |
| Non-admin access to dashboard | ACCESS DENIED | |

### 2.28 Admin Actions

| Test Case | Expected | Status |
|-----------|----------|--------|
| Approve ad | Ad status changed to approved | |
| Reject ad | Ad status changed to rejected | |
| Request changes | Status set, owner notified | |
| Suspend ad | Ad hidden, owner restricted | |
| Suspend user | User restricted | |
| Ban user | User completely blocked | |
| Verify business | Verification status updated | |
| Process refund | If supported, processed | |
| Creates audit record | Each action logged | |
| Updates database correctly | State changes persisted | |
| Does not expose secrets | No sensitive data in responses | |
| Non-admin cannot perform admin actions | ACCESS DENIED | |

### 2.29 Role Escalation Test

| Test Case | Expected | Status |
|-----------|----------|--------|
| Modify role user→admin via browser | DENIED | |
| Modify role user→admin via API | DENIED | |
| Modify role user→admin via Supabase | DENIED | |
| Modify role user→admin via form | DENIED | |
| Normal user cannot change own role | ACCESS DENIED | |
| Role hierarchy enforced | user < moderator < admin < super_admin | |

### 2.30 IDOR Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| /ads/userB-ad | User A sees own ad only or 404 | |
| /messages/userB-conversation | User A cannot access User B's conversation | |
| /dashboard/orders/userB-order | ACCESS DENIED | |
| /analytics/userB-ad | ACCESS DENIED | |
| Replace any ID in URL/API | DENIED unless authorized | |
| GraphQL/REST API ID manipulation | Proper authorization check | |

### 2.31 XSS Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| `<script>alert(1)</script>` in ad title | Displayed as text, not executed | |
| `<script>alert(1)</script>` in description | Displayed as text, not executed | |
| `<script>alert(1)</script>` in seller bio | Displayed as text, not executed | |
| `<script>alert(1)</script>` in business description | Displayed as text, not executed | |
| `<script>alert(1)</script>` in messages | Displayed as text, not executed | |
| `<script>alert(1)</script>` in search | Handled safely | |
| `alert(1)` payloads | No JavaScript execution | |
| Event handlers in content | Stripped or escaped | |
| Inline styles | Handled safely | |

### 2.32 URL Security

| Test Case | Expected | Status |
|-----------|----------|--------|
| `javascript:alert(1)` URL | Rejected or handled | |
| `data:text/html,...` URL | Rejected or handled | |
| `vbscript:...` URL | Rejected or handled | |
| Unsafe schemes | Blocked | |
| User-submitted website URLs | Validated (https:// only or http://) | |
| Redirect URLs | Only internal or validated external | |
| Open redirect vulnerability | No redirect to malicious sites | |

### 2.33 File Upload Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Valid JPG upload | Stored, preview shown | |
| Valid PNG upload | Stored, preview shown | |
| Valid WebP upload | Stored, preview shown | |
| Large image (2MB+) | Resized or error | |
| Invalid extension (.txt) | Rejected | |
| Fake extension (.jpg.txt) | Rejected | |
| Very large dimensions (5000x5000) | Resized or error | |
| Unsupported MIME type | Rejected | |
| GIF upload | Handled or rejected | |
| SVG with unsafe content | Rejected or sanitized | |
| .exe/.js/.html upload | Rejected definitively | |

### 2.34 File Size Limit

| Test Case | Expected | Status |
|-----------|----------|--------|
| Upload above configured limit | Clear validation error | |
| No server crash | System handles gracefully | |
| User-friendly error message | "File too large, maximum X MB" | |

### 2.35 Database Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Foreign keys enforced | Referential integrity | |
| Unique constraints | Duplicates prevented | |
| Null handling | Works as designed | |
| Duplicate records | Prevented by unique constraints | |
| Invalid states | Check constraints prevent | |
| Orphan records | No foreign key violations | |
| Transaction rollback | Works on errors | |

### 2.36 RLS Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| User A cannot read User B private data | ACCESS DENIED | |
| User A cannot update User B data | ACCESS DENIED | |
| Normal user cannot modify admin records | ACCESS DENIED | |
| Normal user cannot access email jobs | ACCESS DENIED | |
| Normal user cannot modify audit logs | ACCESS DENIED | |
| Admin can read all appropriate data | Working | |
| Public data readable by all | Working | |
| RLS policies not bypassed | Through UI or API | |

### 2.37 API Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Valid request | Correct response | |
| Invalid request | Error response | |
| Missing fields | Error with field names | |
| Unauthorized request | 401 or redirect | |
| Wrong role | 403 or error | |
| Malformed input | Error response, no crash | |
| Very large input | Truncated or error, no crash | |
| Unexpected fields | Ignored or error | |
| Safe error responses | No stack traces, no secrets | |

### 2.38 Rate Limit Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Repeated login attempts | Rate limit activated | |
| Repeated registration | Rate limit activated | |
| Repeated password reset | Rate limit activated | |
| Repeated ad creation | Rate limit activated | |
| Repeated messages | 20/minute trigger (DB) | |
| Repeated reports | Rate limiting | |
| Repeated image uploads | Rate limiting | |
| Repeated payment order creation | Rate limiting | |
| Useful messages when rate-limited | User understands why | |

### 2.39 Performance Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Homepage load time | Under 2-3 seconds | |
| Search response time | Under 2 seconds | |
| Category page load | Under 2 seconds | |
| Ad detail load | Under 2 seconds | |
| Posting form load | Under 2 seconds | |
| Dashboard load | Under 3 seconds | |
| Admin dashboard load | Under 3 seconds | |
| Database query count | Optimized (no N+1) | |
| Image loading | Lazy loaded, optimized | |
| JavaScript bundle size | Reasonable (not megabytes) | |

### 2.40 Large Data Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| 1,000 ads | Pagination works | |
| 10,000 ads | Pagination works, no timeout | |
| 100,000 ads (if possible) | Functional with pagination | |
| Search with large dataset | Works, not crash | |
| Filters with large dataset | Works | |
| Sorting with large dataset | Works | |
| Browser memory not exhausted | Records paged, not loaded all | |

### 2.41 Mobile Testing

| Device | Status |
|--------|--------|
| 360px | Critical pages functional |
| 390px | Critical pages functional |
| 430px | Critical pages functional |
| 768px (tablet) | Functional |
| 1024px (small laptop) | Functional |
| 1440px (desktop) | Functional |

**Critical pages on mobile:**
- Homepage
- Search page
- Category page
- Ad detail page
- Posting form
- Dashboard (if logged in)
- Login/Register

**Look for:**
- Horizontal overflow
- Broken layouts
- Overlapping buttons
- Unreadable text (small tap targets)
- Broken forms
- Broken menus
- Broken image galleries

### 2.42 Browser Testing

| Browser | Status |
|---------|--------|
| Chrome | Critical workflows |
| Firefox | Critical workflows |
| Edge | Critical workflows |
| Safari | Critical workflows (iOS/macOS) |

Focus on:
- Registration/login
- Post ad flow
- Search
- Payment test flow
- Admin access (if applicable)

### 2.43 Accessibility Testing

| Feature | Test |
|---------|------|
| Keyboard navigation | Tab through all interactive elements |
| Focus states | Visible focus on all elements |
| Form labels | Associated with inputs correctly |
| Button labels | Descriptive text | |
| Heading hierarchy | H1, H2, H3 in correct order |
| Image alt text | All informative images have alt |
| Modal accessibility | Focus trapped, ESC to close |
| Screen-reader-friendly | Landmark regions, heading order |
| Important actions not mouse-only | Keyboard accessible |

### 2.44 SEO Testing

| Element | Expected |
|---------|----------|
| Title | Unique, descriptive per page |
| Meta description | Unique, compelling per page |
| Canonical | Correct, no duplicates |
| robots.txt | Appropriate for public/private |
| Sitemap | Contains public approved content |
| Open Graph | Title, description, image for social |
| Structured data | If implemented, valid |
| Headings | H1 per page, hierarchical |
| Image alt text | All informative images have alt |
| URL structure | Clean, descriptive |

### 2.45 Indexability

| Content Type | Indexable |
|-------------|-----------|
| Public approved ads | YES |
| Category pages | YES |
| Location pages | YES |
| Homepage | YES |
| Draft ads | NO |
| Rejected ads | NO |
| Deleted ads | NO |
| Private dashboards | NO |
| Messages | NO |
| Admin pages | NO |
| Do NOT rely on robots.txt as security | |

### 2.46 Sitemap Testing

| Content | Should Contain | Should NOT Contain |
|---------|---------------|-------------------|
| Public ads | ✓ | draft/rejected/deleted |
| Categories | ✓ | private content |
| Locations | ✓ | admin dashboards |
| Sitemap | ✓ | messages, notifications |
| Draft ads | ✗ | |
| Rejected ads | ✗ | |
| Deleted ads | ✗ | |
| Private dashboards | ✗ | |
| Messages | ✗ | |
| Admin pages | ✗ | |

### 2.47 SEO Duplicate Testing

| Issue | Check |
|-------|-------|
| Duplicate titles | Each page has unique title |
| Duplicate descriptions | Each page has unique meta description |
| Duplicate canonical URLs | Each page has correct canonical |
| Duplicate content | No substantial duplicate content | |
| Pagination duplicates | Page 2, 3 etc have rel=next/prev | |

### 2.48 404 Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| Invalid advertisement | 404 page displayed | |
| Invalid category | 404 page displayed | |
| Invalid seller | 404 page displayed | |
| Invalid business | 404 page displayed | |
| Invalid URL | 404 page displayed | |
| Useful error message | No internal errors exposed | |
| Stack traces | Not shown to user | |
| Database details | Not shown to user | |

### 2.48 Error Page Testing

| Error Type | User Faces |
|-----------|-----------|
| 404 | Friendly message, not technical |
| 500 | Generic error, logged server-side |
| Network failure | "Unable to connect, try again" |
| Database failure | "Service temporarily unavailable" |
| Payment failure | Appropriate error, not expose details |

**Do NOT show:**
- Stack traces
- Database query details
- API keys
- Passwords
- Internal IDs

### 2.49 Offline/Network Failure

| Test Case | Expected | Status |
|-----------|----------|--------|
| Slow network | UI shows loading, timeout gracefully | |
| Network disconnect | Error message, retry option | |
| API timeout | Timeout error, not crash | |
| No duplicate submissions | Retry doesn't create duplicates | |
| Form state preserved | Partial data not lost | |

### 2.50 Double Click Testing

| Action | Expected |
|--------|----------|
| Double-click Post Ad | No duplicate ad creation |
| Double-click Send Message | No duplicate message |
| Double-click Pay | No duplicate payment attempt |
| Double-click Save | No duplicate save (idempotent) |
| Double-click Delete | No duplicate deletion |

### 2.51 Form Recovery

| Test Case | Expected | Status |
|-----------|----------|--------|
| Partial ad form | Saved locally or remembered | |
| Browser back/forward | Form state handled | |
| Session timeout | Data not lost unnecessarily | |

### 2.52 Image Gallery Testing

| Test Case | Expected | Status |
|-----------|----------|--------|
| One image | Displayed correctly | |
| Multiple images | Gallery carousel/grid | |
| Missing image | Placeholder shown | |
| Broken image | Placeholder shown, no crash | |
| Large image | Responsive, no layout shift | |
| Mobile gallery | Swipe/tap works, responsive | |
| Desktop gallery | Click/arrow navigation works | |

### 2.53 Notification Badges

| Test Case | Expected | Status |
|-----------|----------|--------|
| Unread messages badge | Correct count | |
| Unread notifications badge | Correct count | |
| Read state | Badge clears when read | |
| Multiple devices | Consistent counts | |

### 2.54 Account Deletion Test

| Test Case | Expected | Status |
|-----------|----------|--------|
| Delete account | Per application policy | |
| Profile data | Removed or anonymized | |
| Ads | Removed or made private | |
| Messages | Removed or made private | |
| Favorites | Cleared | |
| Notifications | Cleared | |
| Business profile | Removed or made private | |
| Analytics data | Handled per policy | |
| Deleted users not exposed | No private data in public areas | |

### 2.55 Moderation Regression

| Test Case | Expected | Status |
|-----------|----------|--------|
| Submit ad | Goes to moderation queue | |
| Review ad | Moderator can view | |
| Approve ad | Status changed, published | |
| Reject ad | Status changed, owner notified | |
| Request changes | Status changed, owner can resubmit | |
| Edit ad | Owner can edit draft/pending | |
| Resubmit after changes | Goes back to queue | |

### 2.56 Payment Regression

| Test Case | Expected | Status |
|-----------|----------|--------|
| Normal ad posting without payment | Works, ad created as draft/pending | |
| Paid promotion requires payment | Fails without valid payment | |
| Payment failure does not activate promotion | Promotion stays inactive | |
| Payment success activates promotion | Promotion activated correctly | |
| Promotion expiry after period | Auto-expires | |

### 2.57 Email Regression

| Test Case | Expected | Status |
|-----------|----------|--------|
| Registration without email | Still completes (if optional) | |
| Email failure does not break | Registration | |
| Email failure does not break | Ad approval | |
| Email failure does not break | Payments | |
| Email failure does not break | Messaging | |
| Email failure does not break | Promotion activation | |

### 2.58 Accessibility Regression

| Test Case | Expected | Status |
|-----------|----------|--------|
| Keyboard navigation still works | After all changes | |
| Focus states visible | After all changes | |
| Screen reader still works | After all changes | |

### 2.59 Build Test

| Command | Expected | Status |
|---------|----------|--------|
| `npm run typecheck` | No TypeScript errors (or genuine fixed) | |
| `npm run lint` | No genuine lint errors | |
| `npm run build` | Production build succeeds | |
| No server/client boundary issues | Components in correct place | |
| Environment variable problems | None or documented | |

### 2.60 Console Error Audit

| Issue | Expected |
|-------|----------|
| No JavaScript errors on page load | |
| No failed resource requests (404) | |
| No CORS errors for same-origin | |
| No hydration mismatches | |
| Warnings only where expected | |

### 2.61 Network Request Audit

| Check | Expected |
|-------|----------|
| No secrets in request URLs | |
| No unnecessary private data | |
| Correct status codes | |
| No duplicate requests (same action) | |
| Reasonable payload sizes | |

### 2.62 Hydration Testing

| Check | Expected |
|-------|----------|
| No hydration mismatches | |
| Dates rendered correctly | |
| Random IDs consistent | |
| Client-only values not on server | |
| Authentication state consistent | |
| Responsive logic consistent | |

### 2.63 Security Regression

| Test | Expected |
|------|----------|
| RLS tests still pass | After all fixes |
| Authorization tests still pass | After all fixes |
| IDOR tests still fail (properly) | After all fixes |
| XSS tests still pass (safe) | After all fixes |
| Payment manipulation tests still fail | After all fixes |
| Role escalation tests still denied | After all fixes |

### 2.64 Test Documentation

| Format | Required |
|--------|----------|
| Test case description | Clear what is tested |
| Expected result | What should happen |
| Actual result | What actually happened |
| Status | PASS/FAIL/BLOCKED/NOT TESTED |
| Severity | CRITICAL/HIGH/MEDIUM/LOW |
| Notes | Any additional info |

### 2.65 Bug Severity

| Severity | Definition |
|----------|-----------|
| CRITICAL | Payment/security/data loss/site unusable |
| HIGH | Major functionality broken, security issue |
| MEDIUM | Important feature malfunction, workaround exists |
| LOW | Minor UI issue, non-blocking |

### 2.66 No Fake Pass Results

| Rule | Action |
|------|--------|
| Never mark PASS unless actually tested | |
| If cannot test: mark BLOCKED or NOT TESTED | |
| Explain why not tested | In notes |
| Do not fabricate results | Honest reporting |
| Do not use fake payment success | Real testing only |

### 2.67 No Mocking Production Results

| Rule | Action |
|------|--------|
| Do not claim payment works | Unless tested with test mode |
| Do not claim email works | Unless tested |
| Do not claim RLS secure | Without testing policies |
| Only claim what was verified | |

### 2.68 Final Bug Fixing

| Priority | Action |
|----------|--------|
| CRITICAL bugs | Fix before completion |
| HIGH bugs | Fix where safe |
| MEDIUM bugs | Document them |
| LOW bugs | As noted, don't make risky changes |

### 2.69 Final Regression

| Workflow | Test |
|----------|------|
| Registration | Full flow |
| Login | Full flow |
| Post Ad | Full flow |
| Moderation | Full flow |
| Search | Full flow |
| Favorite | Full flow |
| Messaging | Full flow |
| Payment | Full flow |
| Promotion | Full flow |
| Analytics | Full flow |
| Email | Full flow |
| Admin | Full flow |

### 2.70 Production Readiness Score

| Category | Score | Deductions |
|----------|-------|------------|
| Security | __/100 | Explain deductions |
| Functionality | __/100 | Explain deductions |
| Performance | __/100 | Explain deductions |
| Accessibility | __/100 | Explain deductions |
| SEO | __/100 | Explain deductions |
| Responsive | __/100 | Explain deductions |
| Payment readiness | __/100 | Explain deductions |
| Email readiness | __/100 | Explain deductions |

### 2.71 Launch Blockers

| 🚨 MUST FIX BEFORE LAUNCH | |
|--------------------------|-----------|
| 1. | |
| 2. | |
| 3. | |
| 4. | |
| 5. | |

Only genuine blockers - not cosmetic issues.

### 2.72 Post-Launch Issues

| ⚠️ CAN FIX AFTER LAUNCH | |
|------------------------|-----------|
| 1. | |
| 2. | |
| 3. | |
| 4. | |
| 5. | |

Non-critical issues for post-launch.

### 2.73 Final Checklist

| Item | Status |
|------|--------|
| Registration | |
| Login | |
| Logout | |
| Password reset | |
| Profiles | |
| Business profiles | |
| Post ad | |
| Edit ad | |
| Delete ad | |
| Moderation | |
| Search | |
| Filters | |
| Categories | |
| Locations | |
| Favorites | |
| Messaging | |
| Notifications | |
| Reports | |
| Payments | |
| Featured ads | |
| Promotions | |
| Analytics | |
| Emails | |
| Admin | |
| SEO | |
| Sitemap | |
| Robots | |
| Security | |
| RLS | |
| Performance | |
| Mobile | |
| Accessibility | |
| Production build | |

### 2.74 Final Report

| Metric | Count |
|--------|-------|
| Total tests | |
| Passed | |
| Failed | |
| Blocked | |
| Not tested | |
| Critical bugs | |
| High bugs | |
| Medium bugs | |
| Low bugs | |
| Bugs fixed | |
| Remaining bugs | |
| Security findings | |
| Performance findings | |
| SEO findings | |
| Accessibility findings | |
| Payment findings | |
| Email findings | |
| Launch blockers | |
| Recommended next steps | |

### 2.75 Final Goal

Determine honestly whether FindIt is ready to move from:
- DEVELOPMENT → STAGING → PRODUCTION

Do not hide problems.
Do not fabricate test results.
Do not use fake payment success.
Do not expose secrets.
Do not weaken security to make tests pass.