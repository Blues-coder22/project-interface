# StayExplore Kenya: Frontend Website

## Update 5: map search, nearby recommendations, messaging
- **Map (Leaflet + OpenStreetMap + Browser Geolocation, as in the project document).** The homepage has a map of every approved stay and published attraction in Kenya. Search a place, attraction or stay (instant, built-in list of Kenyan places; press Enter or choose "Search all of Kenya" to query OpenStreetMap for anything else), or tap "Use my location". Pick a radius and filter by Attractions / Stays. Leaflet is bundled in `vendor/leaflet/`; only the map tiles and the optional OpenStreetMap place search need internet.
- **Bidirectional recommendations by real distance (km).** Choose an attraction and the stays around it are listed first; choose a stay and the attractions around it come first. Each list has a "View all N … near X" link that opens Search filtered to that area, nearest first (stays and attractions tabs both honour it, and Search has a working "View map").
- **Homepage sections are live and linked.** Featured Stays and Popular Attractions come from the store (unpublished / unapproved items disappear), each with "View all N stays →" / "View all N attractions →" next to the heading, plus "N stays nearby" / "N attractions nearby" on every card.
- **More of Kenya:** 8 more attractions (Amboseli, Lake Nakuru, Lake Naivasha & Hell's Gate, Nairobi National Park, Karura Forest, Diani, Fort Jesus, Watamu) and two more stays (Diani, Naivasha). They reuse the supplied photos; replace them from the admin and host forms.
- **Pins for hosts and admins:** listing and attraction forms have a map picker (click, drag, or "Use my current location"). A listing without a pin gets an approximate location from its place name, and the admin integrity checks flag it.
- **Messaging (tourist ↔ host).** "Message host" on every stay and on My bookings; hosts reply from Messages and can start a chat with guests who have booked. One conversation per guest and stay, unread badges in the navigation, plain-text only, 1000-character limit, other open tabs update live. Admins cannot read private messages. Real-time chat is listed as future work in the project document, so this is a simple inbox.
- **Fixed:** `index.html` loaded `app.js` twice, which started everything twice on the homepage. The duplicate tag is removed and the script now ignores a second load.

## Update 4: trust & safety (reviews, moderation, incidents, listing integrity)
Still browser-only (interface first); the rules below are what a backend should later enforce.
- **Verified reviews:** only a *completed* booking can be reviewed, by the guest who made it, once, within 14 days of the stay. On My bookings, a "Mark completed (demo)" shortcut stands in for the stay finishing so you can try the flow.
- **Simultaneous reveal:** the guest's review of the listing and the host's review of the guest stay sealed until both are submitted, or the 14-day window closes. Neither side can read the other's before submitting. Public reviews show first name only and a "Verified stay" tag; listing ratings recalculate from revealed, un-moderated reviews.
- **Moderation (admin):** Moderate reviews lists every review with status (Published / Sealed / Hidden / Removed). Hosts can report a review; admins can Hide, Restore, Remove or Dismiss the flag. Ratings update immediately.
- **Incident reports:** tourists (Report an incident, or Report on a booking / listing) and hosts (Report incident) file reports. Theft, abuse or harassment and physical safety or assault are **critical**: they show an emergency notice (999 / 112), sort to the top of the admin queue and are counted on the dashboard. Admins open a report to add internal notes, change status, suspend the listing, host or guest, and must send the reporter a message when closing. Reporters see their reports and the outcome.
- **Listing integrity:** the admin approval screen runs checks (duplicate listing, price range, host account, own photos, description length, amenities, open critical incidents) and warns before approving. Changing the name, location or type of an approved listing sends it back to review.
- Evidence uploads record file names only in this demo.

## Update 3: every sample listing has its own host
Sample listings now belong to named hosts, who are real accounts you can sign in as (password for all: `Host123!`):

| Host | Email | Listings |
|---|---|---|
| Wanjiku Kamau | wanjiku@stayexplore.co.ke | Karura House, Mt Kenya Forest Lodge |
| Daniel Otieno | daniel@stayexplore.co.ke | High Rise |
| Grace Njoroge | grace@stayexplore.co.ke | Fernside Retreat |
| Fatma Bakari | fatma@stayexplore.co.ke | Lamu Old Town Retreat |
| Joseph Ole Sankale | joseph@stayexplore.co.ke | Mara Savannah Camp |
| Ali Hassan | ali@stayexplore.co.ke | Lamu Retreat (pending) |
| Peter Maina | peter@stayexplore.co.ke | Forest View Lodge (needs review) |

A host sees only their own listings and the bookings on them. A newly registered host starts with none. Bookings on a sample listing appear for that sample host.

## Update 2: bookings now flow to hosts and admins
- **One shared bookings list** (`stayexplore_bookings_v2`). Paying creates a booking that the tourist (My bookings), the host (Manage bookings, Payment tracking, Availability, Dashboard) and the admin (Users, Dashboard) all read.
- **Double-booking protection:** overlapping dates are refused at Reserve and again at payment. Hosts can block dates; cancelled bookings reopen the dates and refund the payment. Tourists and hosts can both cancel.
- **Host pages are real:** all example rows removed from Manage bookings, Payment tracking, Availability (live calendar), and the dashboard numbers. The Bookings column on Manage listings counts real bookings.
- **Hosts see all listings:** the sample listings are shared sample stock that any host can manage (so bookings on them are visible), plus the host's own listings.
- **Admin pages are real:** Manage users lists registered accounts (role filter, activity, Suspend/Reactivate, enforced at sign-in). Listing approvals shows the real host name and email (sample listings are tagged "Sample host"). Dashboard shows real users, bookings and recent activity.
- Data from the previous release is migrated automatically on first load.

## What changed in this release (attractions, listings, profiles)
- **Attractions:** every attraction now has its own page (`attraction-details.html?id=maasai-mara | mount-kenya | lamu-old-town`) with its own photos, landscape, best time to go, climate and nearby stays. Maasai Mara = dry savannah, Mount Kenya = forested mountain, Lamu = sandy coast. All 12 supplied photos are used in `assets/`.
- **Shared data store:** listings and attractions live in one browser store (`localStorage`: `stayexplore_listings`, `stayexplore_attractions`), seeded on first load. Host, admin and tourist screens all read from it, so a host/admin change is what tourists see.
- **Host:** Manage listings, Edit listing (`host-edit-listing.html?id=...`), Add listing (with photo upload) and Delete now really save. New listings start as *Pending*. Editing a *Rejected* listing resubmits it.
- **Admin:** Listing approvals can Approve / Reject / Suspend and Edit any listing (including status and photos). Manage attractions can Add / Edit / Publish / Unpublish / Delete. Dashboard counts are live.
- **Profiles (tourist, host, admin):** name, email, phone, country / business name and profile photo save to the account and persist. Changing the email works for the next sign-in, and duplicates are rejected.
- **Fixes:** the shared `formMessage` helper no longer throws when a submit button is nested in a wrapper; the demo admin is found by id so changing its email never creates a second admin; post-login redirects keep `?id=` query strings.

Notes: seeded demo listings (owner `demo`) can be edited by any host account. Photos you upload are down-scaled and stored in the browser (about 5 MB limit; a clear message is shown if it is full). Clear site data in the browser to reset to the seed data.

---


This package contains the updated StayExplore Kenya website screens based on the supplied mockups.

## What changed in this version (bug-fix release)
- **No more page flashing:** `js/app.js` now loads in `<head>`; the access check runs before anything is painted and the page stays hidden (`html.se-pending`) until the check, navigation and role layout are ready. Redirects use `location.replace`, so Back no longer bounces through login or protected pages.
- **Authentication:** passwords are salted + SHA-256 hashed (no plain text); sessions persist across tabs for 24 h; sign-out/sign-in in one tab updates the others; the back/forward cache is re-checked; signed-in users are redirected away from Login/Register; error messages show inline.
- **Authorization:** `data-auth` on `<html>` (`tourist | host | admin | guest`) controls access. Browsing (search, stay and attraction details, info pages) is public; booking, payment, trips, favourites, reviews, reports and profile need a Tourist account. Post-login redirects are validated (no open redirects, no wrong-role loops).
- **Real-site behaviour:** live search/price/rating/amenity filters and sorting, date-aware booking totals, bookings saved per user, persistent favourites, profiles show the signed-in user, admin approve/suspend buttons update the row, mobile menu, shared header/footer, Help, Contact, Privacy, Terms and 404 pages.
- **Layout fixes:** stray `>` characters in buttons, search filter column/checkbox alignment, details-page booking card width, empty gap under the auth header, host calendar starting on the wrong weekday, sidebar overflow, mobile navigation.

## Frontend only
There is no PHP, MySQL, API, Firebase or other backend in this package. Authentication and authorization are simulated in the browser with `localStorage` and `sessionStorage` so the interface can demonstrate the intended user flow.

## Authentication flow
1. A new user must register first.
2. Registration creates either a Tourist or Host account.
3. The user must then sign in with the registered email and password.
4. The account role determines the area the user can access.
5. Tourist-only pages reject Host and Admin accounts.
6. Host-only pages reject Tourist and Admin accounts.
7. Admin-only pages reject Tourist and Host accounts.
8. Directly typing a protected URL without signing in redirects to Login.

A pre-created system administrator demo account is included so the Admin screens can be demonstrated:
- Email: `admin@stayexplore.co.ke`
- Password: `Admin123!`

This demo account represents an administrator account created by the platform, not a public self-registration option.

## Important security note
Because this is frontend-only, the browser is responsible for the demo authentication state. It demonstrates logical authentication and authorization for the coursework interface, but it is **not production security**. Real authentication must be moved to a server/database with password hashing, sessions/tokens and server-side role checks.

## Main flow
Home → Register → Login → Tourist/Host/Admin area → role-specific screens.

Tourist booking flow:
Search → Accommodation details → Booking → Payment → Confirmation → My bookings → Review.

Host flow:
Host dashboard → Add/Edit/manage listings → Availability → Bookings → Payments → Reviews → Incidents → Profile.

Admin flow:
Admin dashboard → Listing approvals → Users → Reviews → Incidents → Attractions → Profile.
