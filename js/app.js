/* StayExplore Kenya — frontend-only auth, authorization and UI helpers.
   Loaded in <head> (blocking) so access checks run BEFORE the page is painted.
   NOTE: browser-only demo security. Real security needs a server (hashed passwords, sessions, role checks). */
(function () {
'use strict';

/* ---------- constants ---------- */
const K = { acc:'stayexplore_accounts', ses:'stayexplore_session', next:'stayexplore_next',
            flash:'stayexplore_flash', draft:'stayexplore_draft', bookings:'stayexplore_bookings',
            last:'stayexplore_last_booking', favs:'stayexplore_favs_',
            listings:'stayexplore_listings', attractions:'stayexplore_attractions', allbk:'stayexplore_bookings_v2' };
const SESSION_HOURS = 24;
const ROLE_PAGES = {
  tourist:['book.html','payment.html','confirmation.html','bookings.html','review.html','favourites.html','report.html','profile.html'],
  host:['host-dashboard.html','host-add-listing.html','host-edit-listing.html','host-manage-listings.html','host-availability.html','host-manage-bookings.html','host-payments.html','host-reviews.html','host-report-incident.html','host-profile.html'],
  admin:['admin-dashboard.html','admin-listing-approvals.html','admin-manage-users.html','admin-moderate-reviews.html','admin-incident-reports.html','admin-attractions.html','admin-profile.html']
};
const OPEN_PAGES = ['index.html','search.html','details.html','attraction-details.html','how-it-works.html','about.html','contact.html','help.html','privacy.html','terms.html','login.html','register.html'];
const STAYS = {
  'karura-house':{name:'Karura House',place:'Westlands, Nairobi',price:8400,rating:'4.8',cls:'user-house'},
  'high-rise':{name:'High Rise',place:'Kilimani, Nairobi',price:6200,rating:'4.6',cls:'user-mountain'},
  'fernside-retreat':{name:'Fernside Retreat',place:'Karen, Nairobi',price:9400,rating:'4.5',cls:'user-lamu'}
};

/* ---------- safe storage ---------- */
const ls = { get(k){try{return localStorage.getItem(k)}catch{return null}}, set(k,v){try{localStorage.setItem(k,v)}catch{}}, del(k){try{localStorage.removeItem(k)}catch{}} };
const ss = { get(k){try{return sessionStorage.getItem(k)}catch{return null}}, set(k,v){try{sessionStorage.setItem(k,v)}catch{}}, del(k){try{sessionStorage.removeItem(k)}catch{}} };
const readJSON = (store,k,fb)=>{ try{ const v=store.get(k); return v?JSON.parse(v):fb; }catch{ return fb; } };

/* ---------- accounts, hashing, session ---------- */
const getAccounts = ()=>readJSON(ls,K.acc,[]);
const saveAccounts = a=>ls.set(K.acc,JSON.stringify(a));
async function sha(text){
  if(window.crypto && crypto.subtle){
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  let h=5381; for(const c of text) h=((h<<5)+h+c.charCodeAt(0))>>>0; return 'x'+h.toString(16); // fallback only
}
const newSalt = ()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
async function ensureDemoAdmin(){
  const list=getAccounts();
  if(list.some(a=>a.id==='admin-system')) return;
  const salt='demo-admin-salt';
  list.push({id:'admin-system',name:'Njeri Mwangi',email:'admin@stayexplore.co.ke',role:'admin',salt,hash:await sha(salt+'Admin123!')});
  saveAccounts(list);
}
function getSession(){
  const s=readJSON(ls,K.ses,null);
  if(!s || !s.exp || s.exp<Date.now()){ if(s) ls.del(K.ses); return null; }
  return s;
}
function setSession(a){ ls.set(K.ses,JSON.stringify({id:a.id,name:a.name,email:a.email,role:a.role,exp:Date.now()+SESSION_HOURS*3600e3})); }
const roleLabel = r=>r==='admin'?'Admin':r==='host'?'Host':'Tourist';
const routeForRole = r=>r==='host'?'host-dashboard.html':r==='admin'?'admin-dashboard.html':'search.html';
const currentPage = ()=>location.pathname.split('/').pop() || 'index.html';
const setFlash = m=>ss.set(K.flash,m);
function consumeFlash(){ const m=ss.get(K.flash); if(m) ss.del(K.flash); return m; }
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const go = url=>location.replace(url);

/* only same-site known pages the role may open — prevents open redirects and wrong-role loops */
function safeNext(role){
  let n=null; try{ const o=JSON.parse(ss.get(K.next)||'null'); if(o && Date.now()-o.t<10*60e3) n=o.p; }catch{} ss.del(K.next);
  if(!n || !/^[a-z0-9-]+\.html(\?[\w=&%.\-]*)?(#[\w-]*)?$/i.test(n)) return null;
  const file=n.split(/[?#]/)[0];
  return (ROLE_PAGES[role]||[]).includes(file) || OPEN_PAGES.includes(file) ? n : null;
}

/* ---------- access guard: runs immediately, before paint ---------- */
const root=document.documentElement;
const need=root.dataset.auth;               // tourist | host | admin | guest | (none = public)
root.classList.add('se-pending');
let redirecting=false;
function guard(){
  const s=getSession();
  if(s && getAccounts().some(a=>a.id===s.id && a.suspended)){ ls.del(K.ses); redirecting=true; setFlash('This account has been suspended.'); go('login.html'); return false; }
  if(need==='guest' && s){ redirecting=true; go(safeNext(s.role)||routeForRole(s.role)); return false; }
  if(['tourist','host','admin'].includes(need)){
    if(!s){ redirecting=true; ss.set(K.next,JSON.stringify({p:currentPage()+location.search+location.hash,t:Date.now()})); setFlash('Please sign in to continue.'); go('login.html'); return false; }
    if(s.role!==need){ redirecting=true; setFlash(`Access denied. That area is for ${roleLabel(need)} accounts only.`); go(routeForRole(s.role)); return false; }
  }
  return true;
}
guard();
const reveal=()=>{ if(!redirecting) root.classList.remove('se-pending'); };
setTimeout(reveal,2500);                                  // failsafe: never leave a blank page
window.addEventListener('pageshow',e=>{ if(e.persisted && guard()) reveal(); });   // back/forward cache
window.addEventListener('storage',e=>{ if(e.key===K.ses) { if(guard()) location.reload(); } }); // login/logout in another tab

function logout(){ ls.del(K.ses); ss.del(K.draft); setFlash('You have been signed out.'); go('index.html'); }
function requireLogin(msg){ ss.set(K.next,JSON.stringify({p:currentPage()+location.search+location.hash,t:Date.now()})); setFlash(msg||'Please sign in to continue.'); go('login.html'); }

/* ---------- toast ---------- */
function showToast(message){
  let t=document.querySelector('.toast');
  if(!t){ t=document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); t.setAttribute('aria-live','polite'); document.body.appendChild(t); }
  t.textContent=message; t.classList.add('show');
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove('show'),3200);
}
window.showToast=showToast;

/* ---------- shared chrome: nav + footer ---------- */
function navLinks(s){
  const p=currentPage(), hash=location.hash;
  const items=[['index.html','Home'],['search.html','Discover'],['search.html#attractions','Attractions'],['how-it-works.html','How it works'],['about.html','About us']];
  if(s && s.role==='tourist') items.push(['bookings.html','My trips']);
  return items.map(([h,l])=>{
    const f=h.split('#')[0], active = h.includes('#') ? (p===f && hash==='#attractions') : (p===f && hash!=='#attractions');
    return `<a href="${h}" ${active?'class="active" aria-current="page"':''}>${l}</a>`;
  }).join('');
}
function accountActions(s,cls){
  if(!s) return `<a class="${cls==='hp'?'':'btn btn-outline'}" href="login.html">Sign in</a><a class="btn" href="register.html">Create account</a>`;
  const home=routeForRole(s.role);
  const label=s.role==='admin'?'Admin panel':s.role==='host'?'Host dashboard':'My account';
  const target=s.role==='tourist'?'profile.html':home;
  return `<span class="role-pill">${roleLabel(s.role)}</span><a class="${cls==='hp'?'':'btn btn-outline'}" href="${target}">${label}</a><button class="nav-signout" type="button" data-logout>Sign out</button>`;
}
function renderChrome(){
  const s=getSession();
  document.querySelectorAll('[data-site-nav]').forEach(h=>{
    h.innerHTML=`<a class="public-brand" href="index.html"><span class="brand-mark">SE</span><span>StayExplore<small>KENYA</small></span></a><button class="nav-toggle" type="button" aria-label="Menu" aria-expanded="false">☰</button><nav class="public-links" aria-label="Main">${navLinks(s)}</nav><div class="public-actions">${accountActions(s)}</div>`;
  });
  const hp=document.querySelector('.hp-header');
  if(hp){
    const nav=hp.querySelector('.hp-nav'), act=hp.querySelector('.hp-actions');
    if(nav) nav.innerHTML=`<a href="search.html">Discover</a><a href="how-it-works.html">How it works</a><a href="about.html">About us</a>`;
    if(act) act.innerHTML=s?accountActions(s,'hp'):`<a href="login.html">Sign in</a><a class="btn" href="register.html">Sign up</a>`;
    if(!hp.querySelector('.nav-toggle')) hp.insertAdjacentHTML('beforeend','<button class="nav-toggle" type="button" aria-label="Menu" aria-expanded="false">☰</button>');
  }
  document.querySelectorAll('.nav-toggle:not([data-bound])').forEach(b=>{ b.dataset.bound='1'; b.addEventListener('click',()=>{
    const h=b.closest('header'); const open=h.classList.toggle('nav-open'); b.setAttribute('aria-expanded',open);
  });});
  document.querySelectorAll('[data-site-footer]').forEach(f=>{
    f.innerHTML=`<div><div class="brand">StayExplore Kenya</div><p>Thoughtfully matching travellers with Kenyan stays and experiences.</p></div><div><h4>Explore</h4><a href="search.html">Stays</a><a href="search.html#attractions">Attractions</a><a href="how-it-works.html">How it works</a></div><div><h4>Company</h4><a href="about.html">About us</a><a href="contact.html">Contact</a><a href="register.html?role=host">List your property</a></div><div><h4>Support</h4><a href="help.html">Help centre</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a></div>`;
  });
  document.querySelectorAll('[data-logout]:not([data-bound])').forEach(b=>{ b.dataset.bound='1'; b.addEventListener('click',e=>{e.preventDefault();logout();}); });
}

/* ======================================================================
   SHARED SITE DATA — listings & attractions
   One store (localStorage) read by tourist, host and admin screens, so a change
   made by a host or admin is what tourists actually see.
   ====================================================================== */
const IMG = {
  maraSunset:'assets/user-sunset.jpg', maraTent:'assets/mara-safari-tent.jpg', maraDeck:'assets/mara-river-deck.jpg', maraBoma:'assets/mara-boma-firepit.jpg',
  kenyaPeaks:'assets/user-mount-kenya.jpg', kenyaLodge:'assets/user-lodge.jpg', kenyaLake:'assets/kenya-lake-shore.jpg',
  lamuTown:'assets/user-lamu.jpg', coastBeach:'assets/user-beach.jpg',
  nairobiApt:'assets/user-house.jpg', karenCottage:'assets/karen-cottage-garden.jpg', nairobiDusk:'assets/nairobi-dusk-view.jpg'
};
/* region = landscape. Each region carries its own photos: dry savannah / forested highlands / sandy coast / city */
const REGIONS = {
  mara:{ name:'Maasai Mara', test:/narok|mara|maasai|talek|sekenani/i, images:[IMG.maraSunset,IMG.maraDeck,IMG.maraTent,IMG.maraBoma],
         nearby:[['Maasai Mara National Reserve gate','6 km'],['Mara River viewpoint','11 km'],['Maasai cultural village','8 km']] },
  highlands:{ name:'Mount Kenya', test:/nanyuki|laikipia|mt\.?\s*kenya|mount\s*kenya|nyeri|naro\s*moru|meru|timau/i, images:[IMG.kenyaPeaks,IMG.kenyaLodge,IMG.kenyaLake],
         nearby:[['Mount Kenya National Park gate','12 km'],['Sweetwaters Conservancy','28 km'],['Ol Pejeta Conservancy','35 km']] },
  coast:{ name:'the Kenyan coast', test:/lamu|shela|manda|diani|mombasa|malindi|watamu|kilifi|kwale|coast/i, images:[IMG.lamuTown,IMG.coastBeach],
         nearby:[['Lamu Old Town','1.2 km'],['Lamu Fort','1.0 km'],['Shela Beach','3.5 km']] },
  nairobi:{ name:'Nairobi', test:/nairobi|westlands|kilimani|karen|gigiri|lavington|runda|kileleshwa|langata/i, images:[IMG.nairobiApt,IMG.karenCottage,IMG.nairobiDusk],
         nearby:[['Karura Forest','2.1 km'],['Nairobi National Museum','3.2 km'],['Giraffe Centre','11.4 km']] }
};
const CATEGORY_REGION = { Wildlife:'mara', Mountain:'highlands', Nature:'highlands', Culture:'coast', Beach:'coast' };
const regionOf = text => { for(const [k,r] of Object.entries(REGIONS)) if(r.test.test(text||'')) return k; return null; };
const defaultImages = o => { const r = o.region || regionOf(`${o.location||''} ${o.county||''} ${o.name||''}`) || CATEGORY_REGION[o.category] || 'nairobi'; return REGIONS[r].images.slice(0,3); };
const coverOf = o => (o.images && o.images[0]) || defaultImages(o)[0];

const SEED_LISTINGS = [
  {id:'karura-house',name:'Karura House',location:'Westlands, Nairobi',region:'nairobi',price:8400,type:'Apartment',description:'A calm, design-led apartment close to Karura Forest, with crafted details and room to settle in.',amenities:['Wi-Fi','Breakfast','Parking','Air conditioning','Smart TV','24/7 support'],rules:'Check-in from 2pm. Quiet hours 10pm–7am.',rating:4.8,reviews:126,score:94,bookings:38,status:'approved',ownerId:'demo',hostName:'Wanjiku Kamau',submitted:'2026-10-05',images:[IMG.nairobiApt,IMG.karenCottage]},
  {id:'high-rise',name:'High Rise',location:'Kilimani, Nairobi',region:'nairobi',price:6200,type:'Apartment',description:'A bright upper-floor apartment with sunset views over the city, close to cafés, shops and the Ngong Road corridor.',amenities:['Wi-Fi','Parking','Air conditioning'],rules:'No parties. Check-out by 11am.',rating:4.6,reviews:25,score:89,bookings:19,status:'approved',ownerId:'demo',hostName:'Daniel Otieno',submitted:'2026-09-20',images:[IMG.nairobiDusk]},
  {id:'fernside-retreat',name:'Fernside Retreat',location:'Karen, Nairobi',region:'nairobi',price:9400,type:'Guest house',description:'A leafy cottage retreat in Karen with a wraparound garden, thatched roof and slow, unhurried mornings.',amenities:['Breakfast','Garden','Wi-Fi'],rules:'Quiet garden after 9pm.',rating:4.5,reviews:18,score:87,bookings:12,status:'approved',ownerId:'demo',hostName:'Grace Njoroge',submitted:'2026-09-12',images:[IMG.karenCottage,IMG.nairobiDusk]},
  {id:'mt-kenya-forest-lodge',name:'Mt Kenya Forest Lodge',location:'Nanyuki, Mt Kenya region',region:'highlands',price:8500,type:'Lodge',description:"Come relax in this beautiful lodge after a day of hiking. Wake up by the fireplace with a view of the peaks, ready for tomorrow's trail.",amenities:['Wi-Fi','Breakfast','Parking','Fireplace'],rules:'Early trail departures welcome — tell us the night before.',rating:4.7,reviews:26,score:91,bookings:26,status:'approved',ownerId:'demo',hostName:'Wanjiku Kamau',submitted:'2026-09-28',images:[IMG.kenyaLodge,IMG.kenyaPeaks,IMG.kenyaLake]},
  {id:'lamu-old-town-retreat',name:'Lamu Old Town Retreat',location:'Shela, Lamu',region:'coast',price:9800,type:'Guest house',description:'A whitewashed Swahili house on a car-free lane, steps from the sea. Wander the old town, sail at sunset and sleep to the sound of the waves.',amenities:['Wi-Fi','Breakfast','Sea view'],rules:'Respect local dress customs in the old town.',rating:4.9,reviews:31,score:92,bookings:22,status:'approved',ownerId:'demo',hostName:'Fatma Bakari',submitted:'2026-09-15',images:[IMG.lamuTown,IMG.coastBeach]},
  {id:'mara-savannah-camp',name:'Mara Savannah Camp',location:'Talek, Maasai Mara, Narok',region:'mara',price:18500,type:'Tented camp',description:'Canvas suites on the open savannah with guided game drives at dawn, a firepit boma for the evenings and big-cat country on your doorstep.',amenities:['Breakfast','Wi-Fi','Parking','Guided game drives'],rules:'Stay inside the camp after dark; an askari will escort you.',rating:4.9,reviews:54,score:90,bookings:41,status:'approved',ownerId:'demo',hostName:'Joseph Ole Sankale',submitted:'2026-09-02',images:[IMG.maraTent,IMG.maraBoma,IMG.maraDeck]},
  {id:'lamu-retreat',name:'Lamu Retreat',location:'Lamu',region:'coast',price:7800,type:'Guest house',description:'A simple, sunny guest house a short walk from the beach, with a shaded courtyard and sea breezes.',amenities:['Wi-Fi','Breakfast'],rules:'',rating:0,reviews:0,score:78,bookings:0,status:'pending',ownerId:'demo',hostName:'Ali Hassan',submitted:'2026-10-04',images:[IMG.coastBeach]},
  {id:'forest-view-lodge',name:'Forest View Lodge',location:'Nanyuki',region:'highlands',price:7200,type:'Lodge',description:'A quiet lodge on the edge of the forest with lake views, log fires and guided walks.',amenities:['Parking','Breakfast'],rules:'',rating:0,reviews:0,score:76,bookings:0,status:'review',ownerId:'demo',hostName:'Peter Maina',submitted:'2026-10-03',images:[IMG.kenyaLake]}
];
const SEED_ATTRACTIONS = [
  {id:'maasai-mara',name:'Maasai Mara',county:'Narok',category:'Wildlife',region:'mara',tagline:'Iconic savannah landscapes, wildlife and the Great Migration.',
   description:"Explore one of Kenya's most iconic wildlife landscapes: golden grassland dotted with flat-topped acacias, big-cat country and the seasonal river crossings of the Great Migration. Search nearby stays to build a practical trip around the attraction.",
   terrain:'Open, dry savannah with scattered acacia',bestTime:'July – October (Great Migration)',climate:'Warm, dry days and cool evenings',bestFor:'Wildlife, photography, guided experiences',
   images:[IMG.maraSunset,IMG.maraDeck,IMG.maraTent,IMG.maraBoma],status:'published'},
  {id:'mount-kenya',name:'Mount Kenya',county:'Laikipia',category:'Mountain',region:'highlands',tagline:'Alpine lakes, forest trails and dramatic mountain scenery.',
   description:"Africa's second-highest peak rises out of green montane forest, bamboo and moorland to jagged glaciated summits. Hike forest trails, spot rock hyrax and birdlife, and wake to mountain views from the lodges below.",
   terrain:'Lush montane forest, moorland and rocky peaks',bestTime:'January – February and August – September',climate:'Cool and misty; cold at altitude',bestFor:'Hiking, birdwatching, mountain scenery',
   images:[IMG.kenyaPeaks,IMG.kenyaLodge,IMG.kenyaLake],status:'published'},
  {id:'lamu-old-town',name:'Lamu Old Town',county:'Lamu',category:'Culture',region:'coast',tagline:'A historic Swahili town with dhow trips, beaches and quiet lanes.',
   description:"A UNESCO World Heritage town of carved wooden doors, whitewashed lanes and no cars — just donkeys, dhows and warm Indian Ocean water. Sail at sunset, then walk out to wide, powder-white beaches.",
   terrain:'Sandy beaches, coral-stone old town and palm-fringed coast',bestTime:'December – March and July – October',climate:'Hot and humid with cooling sea breezes',bestFor:'Culture, beaches, dhow trips, slow travel',
   images:[IMG.lamuTown,IMG.coastBeach],status:'published'}
];

/* Each sample listing belongs to one named sample host. These are real accounts (password Host123!) so you can sign in and manage them. */
const SAMPLE_PASSWORD='Host123!';
const SAMPLE_HOSTS=[
  {id:'host-wanjiku',name:'Wanjiku Kamau',email:'wanjiku@stayexplore.co.ke',phone:'+254 712 345 678',business:'Wanjiku Stays'},
  {id:'host-daniel',name:'Daniel Otieno',email:'daniel@stayexplore.co.ke',phone:'+254 722 456 789',business:'Kilimani Urban Stays'},
  {id:'host-grace',name:'Grace Njoroge',email:'grace@stayexplore.co.ke',phone:'+254 733 567 890',business:'Fernside Retreat Ltd'},
  {id:'host-fatma',name:'Fatma Bakari',email:'fatma@stayexplore.co.ke',phone:'+254 701 678 901',business:'Lamu Swahili Houses'},
  {id:'host-joseph',name:'Joseph Ole Sankale',email:'joseph@stayexplore.co.ke',phone:'+254 710 789 012',business:'Mara Savannah Camp'},
  {id:'host-ali',name:'Ali Hassan',email:'ali@stayexplore.co.ke',phone:'+254 720 890 123',business:'Lamu Retreat'},
  {id:'host-peter',name:'Peter Maina',email:'peter@stayexplore.co.ke',phone:'+254 730 901 234',business:'Forest View Lodge'}
];
const SAMPLE_OWNER={'karura-house':'host-wanjiku','mt-kenya-forest-lodge':'host-wanjiku','high-rise':'host-daniel','fernside-retreat':'host-grace','lamu-old-town-retreat':'host-fatma','mara-savannah-camp':'host-joseph','lamu-retreat':'host-ali','forest-view-lodge':'host-peter'};
SEED_LISTINGS.forEach(l=>{ l.ownerId=SAMPLE_OWNER[l.id]||l.ownerId; });
async function ensureSampleHosts(){
  const list=getAccounts(); let changed=false;
  for(const h of SAMPLE_HOSTS){
    if(list.some(a=>a.id===h.id)) continue;
    const salt='sample-'+h.id;
    list.push({id:h.id,created:Date.parse('2026-09-01'),name:h.name,email:h.email,role:'host',phone:h.phone,business:h.business,sample:true,salt,hash:await sha(salt+SAMPLE_PASSWORD)}); changed=true;
  }
  if(changed) saveAccounts(list);
}

/* ---------- store helpers ---------- */
const putLS = (k,v)=>{ try{ localStorage.setItem(k,v); return true; }catch{ return false; } };   // returns false when storage is full
function seedStore(){
  if(!ls.get(K.listings)) putLS(K.listings,JSON.stringify(SEED_LISTINGS));
  if(!ls.get(K.attractions)) putLS(K.attractions,JSON.stringify(SEED_ATTRACTIONS));
  if(ls.get('stayexplore_data_v')!=='3') migrateData();
}
/* v2: sample listings are manageable by any host (so bookings on them are visible), and old per-guest bookings move to the shared list */
function migrateData(){
  const L=readJSON(ls,K.listings,[]); L.forEach(l=>{ if(l.ownerId==='seed') l.ownerId='demo'; }); putLS(K.listings,JSON.stringify(L));
  const legacy=readJSON(ls,K.bookings,null);
  if(legacy && !Array.isArray(legacy)){
    const all=readJSON(ls,K.allbk,[]), accs=getAccounts();
    Object.entries(legacy).forEach(([uid,list])=>(list||[]).forEach(b=>{
      const l=L.find(x=>x.name===b.stay), a=accs.find(x=>x.id===uid);
      all.push(Object.assign({stayId:l?l.id:'karura-house',hostId:l?l.ownerId:'demo',guestId:uid,guestName:a?a.name:'Guest',guestEmail:a?a.email:'',status:'confirmed',payment:'paid',fee:Math.round((b.total||0)/1.05*.05),nights:nightsBetween(b.checkin,b.checkout)},b));
    }));
    putLS(K.allbk,JSON.stringify(all)); ls.del(K.bookings);
  }
  /* v3: every sample listing (and booking on it) now belongs to its own sample host */
  const L2=readJSON(ls,K.listings,[]); L2.forEach(l=>{ if((l.ownerId==='demo'||l.ownerId==='seed') && SAMPLE_OWNER[l.id]) l.ownerId=SAMPLE_OWNER[l.id]; }); putLS(K.listings,JSON.stringify(L2));
  const B2=readJSON(ls,K.allbk,[]); B2.forEach(b=>{ const l=L2.find(x=>x.id===b.stayId); if(l) b.hostId=l.ownerId; }); putLS(K.allbk,JSON.stringify(B2));
  ls.set('stayexplore_data_v','3');
}
const getListings = ()=>{ seedStore(); const v=readJSON(ls,K.listings,null); return Array.isArray(v)?v:JSON.parse(JSON.stringify(SEED_LISTINGS)); };
const saveListings = a=>putLS(K.listings,JSON.stringify(a));
const getAttractions = ()=>{ seedStore(); const v=readJSON(ls,K.attractions,null); return Array.isArray(v)?v:JSON.parse(JSON.stringify(SEED_ATTRACTIONS)); };
const saveAttractions = a=>putLS(K.attractions,JSON.stringify(a));
const listingById = id=>getListings().find(l=>l.id===id);
const attractionById = id=>getAttractions().find(a=>a.id===id);
const nearbyStays = a=>getListings().filter(l=>l.status==='approved' && (a.region ? l.region===a.region : (a.county && (l.location||'').toLowerCase().includes(a.county.toLowerCase()))));
const canEditListing = l=>{ const s=getSession(); return !!(s && l && s.role==='host' && l.ownerId===s.id); };

const slug = s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'item';
const uniqueId = (base,taken)=>{ let id=slug(base), n=2; while(taken.includes(id)) id=slug(base)+'-'+(n++); return id; };
const splitList = t=>String(t||'').split(/[,\n]/).map(x=>x.trim()).filter(Boolean);
const AMEN_KEYS = { wifi:/wi-?fi/i, breakfast:/breakfast/i, parking:/parking/i, garden:/garden/i };
const amenSlugs = list=>Object.entries(AMEN_KEYS).filter(([,re])=>(list||[]).some(x=>re.test(x))).map(([k])=>k);
const AMEN_ICON = a=>({'wi-fi':'Wi','breakfast':'Bk','free parking':'Pk','parking':'Pk','air conditioning':'AC','smart tv':'TV','24/7 support':'24','garden':'Gd','fireplace':'Fp','sea view':'Sv','guided game drives':'GD'}[a.toLowerCase()] || a.replace(/[^A-Za-z0-9]/g,'').slice(0,2) || '•');
const STATUS = { approved:['success','Approved'], pending:['warning','Pending'], review:['danger','Needs review'], rejected:['danger','Rejected'], suspended:['danger','Suspended'], published:['success','Published'], draft:['warning','Draft'] };
const badge = st=>{ const [c,l]=STATUS[st]||['info',st]; return `<span class="status ${c}">${l}</span>`; };
const bgStyle = src=>`background-image:url('${esc(src)}')`;
const stars = r=>{ const n=Math.round(r); return '★'.repeat(n)+'☆'.repeat(5-n); };
const shortDate = d=>{ const t=new Date(d+'T00:00:00'); return isNaN(t)?esc(d):t.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}); };
const todayISO = ()=>new Date().toISOString().slice(0,10);
const QUOTA_MSG = 'Your browser has run out of storage for this demo. Try fewer or smaller photos.';

/* downscale an uploaded photo so it fits in browser storage */
function readImage(file,max=1200,quality=.78){
  return new Promise((resolve,reject)=>{
    if(!file || !/^image\//.test(file.type)) return reject(new Error('Please choose an image file (JPG or PNG).'));
    const r=new FileReader();
    r.onerror=()=>reject(new Error('That file could not be read.'));
    r.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('That image could not be opened.'));
      img.onload=()=>{
        const k=Math.min(1,max/Math.max(img.width,img.height)), c=document.createElement('canvas');
        c.width=Math.max(1,Math.round(img.width*k)); c.height=Math.max(1,Math.round(img.height*k));
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL('image/jpeg',quality));
      };
      img.src=r.result;
    };
    r.readAsDataURL(file);
  });
}
async function readImages(form,limit=4){
  const files=[...form.elements].filter(e=>e.type==='file').flatMap(i=>[...(i.files||[])]).slice(0,limit);   // form.elements also includes inputs linked with form="…"
  return Promise.all(files.map(f=>readImage(f)));
}
function bindPreviews(){
  document.querySelectorAll('input[type=file][data-preview]').forEach(i=>{
    if(i.dataset.pv) return; i.dataset.pv='1';
    i.addEventListener('change',()=>{
      const t=document.querySelector(i.dataset.preview), f=i.files&&i.files[0]; if(!t||!f) return;
      if(!/^image\//.test(f.type)){ showToast('Please choose an image file.'); i.value=''; return; }
      t.style.backgroundImage=`url('${URL.createObjectURL(f)}')`; t.style.backgroundSize='cover'; t.style.backgroundPosition='center'; t.textContent='';
      showToast(i.files.length>1?`${i.files.length} photos selected. Save to keep them.`:'Photo selected. Save to keep it.');
    });
  });
}
const setStat = (k,v)=>document.querySelectorAll(`[data-stat="${k}"]`).forEach(e=>e.textContent=v);

/* ---------- tourist: stay list, stay page ---------- */
function stayCardHTML(l){
  const r=+l.rating||0, amen=(l.amenities||[]).slice(0,3).join(' · ');
  return `<article class="card pad list-card filterable" data-price="${+l.price}" data-rating="${r}" data-score="${+l.score||75}" data-region="${esc(l.region||'')}" data-amenities="${amenSlugs(l.amenities).join(',')}"><div class="photo" style="${bgStyle(coverOf(l))}"></div><div><div class="eyebrow">Smart score ${+l.score||75}</div><h3>${esc(l.name)}</h3><div class="rating">${r?`${stars(r)} <span class="small">${r.toFixed(1)} · ${l.reviews||0} reviews</span>`:'<span class="small">New listing · no reviews yet</span>'}</div><p class="small">${esc(l.location)}${amen?' · '+esc(amen):''}</p></div><div><div class="price">KES ${Math.round(l.price).toLocaleString('en-KE')}<small>/night</small></div><a class="btn btn-sm" href="details.html?id=${encodeURIComponent(l.id)}">View stay</a></div></article>`;
}
function attractionCardHTML(a){
  return `<article class="card"><div class="photo" style="${bgStyle(coverOf(a))}"></div><div class="pad"><div class="eyebrow">${esc(a.category)} · ${esc(a.county)}</div><h3>${esc(a.name)}</h3><p class="small">${esc(a.tagline||'')}</p><a class="btn btn-sm" href="attraction-details.html?id=${encodeURIComponent(a.id)}">Explore attraction</a></div></article>`;
}
function initAttractionList(){
  const box=document.querySelector('#attractionList'); if(!box) return;
  const items=getAttractions().filter(a=>a.status==='published');
  box.innerHTML=items.length?items.map(attractionCardHTML).join(''):`<div class="card pad full empty"><h3>No attractions published yet.</h3><p class="small">Please check back soon.</p></div>`;
}
let currentStay=null;
function initStayPage(){
  const root=document.querySelector('[data-stay-page]'); if(!root) return;
  const id=new URLSearchParams(location.search).get('id')||'karura-house', l=listingById(id), s=getSession();
  const preview=!!(s && l && (s.role==='admin' || canEditListing(l)));
  if(!l || (l.status!=='approved' && !preview)){
    document.title='Stay not available — StayExplore Kenya';
    root.innerHTML=`<section class="page"><div class="eyebrow">Stay</div><h1>This stay isn't available.</h1><p class="sub">It may have been removed, or it is waiting for approval.</p><div class="actions" style="margin-top:20px"><a class="btn" href="search.html">Browse stays</a></div></section>`; return;
  }
  currentStay=l; document.title=`${l.name} — StayExplore Kenya`;
  const imgs=(l.images&&l.images.length?l.images:defaultImages(l)), r=+l.rating||0, reg=REGIONS[l.region]||REGIONS[regionOf(l.location)]||null;
  const gallery=imgs.length===1
    ? `<div class="photo-row wrap" style="grid-template-columns:1fr"><div class="photo" style="${bgStyle(imgs[0])}"></div></div>`
    : `<div class="photo-row wrap"><div class="photo" style="${bgStyle(imgs[0])}"></div><div class="photo-stack">${imgs.slice(1,3).map(i=>`<div class="photo" style="${bgStyle(i)}"></div>`).join('')}</div></div>`;
  const bars=[['Cleanliness',.1],['Location',0],['Comfort',-.1],['Value',-.2]].map(([n,d])=>{ const v=Math.min(5,Math.max(1,r+d)); return `<div class="rating-row"><span>${n}</span><div class="rating-track"><span style="width:${(v/5*100).toFixed(0)}%"></span></div><strong>${v.toFixed(1)}</strong></div>`; }).join('');
  const ratingCard=r?`<div class="card pad rating-summary"><div class="detail-card-heading"><div><div class="eyebrow">Guest rating</div><h2>${r.toFixed(1)}</h2></div><div class="rating-stars" aria-label="${r.toFixed(1)} out of 5 stars">${stars(r)}</div></div><p class="small">${r>=4.7?'Excellent':'Very good'} · ${l.reviews||0} verified reviews</p><div class="rating-bars">${bars}</div></div>`
    :`<div class="card pad rating-summary"><div class="eyebrow">Guest rating</div><h2>New</h2><p class="small">This is a new listing. Verified guest reviews will appear after the first stays.</p></div>`;
  const amen=(l.amenities||[]).map(a=>`<div class="amenity-item"><span class="amenity-icon">${esc(AMEN_ICON(a))}</span><div><strong>${esc(a)}</strong><small>Included</small></div></div>`).join('')||'<p class="small">The host has not listed amenities yet.</p>';
  const nearby=reg?`<div class="card pad" style="margin-top:20px"><h2>Nearby attractions</h2><div class="map"><span class="pin" style="left:35%;top:35%"></span><span class="pin" style="left:65%;top:60%"></span><span class="pin" style="left:52%;top:75%"></span></div><div class="grid grid-3" style="margin-top:12px">${reg.nearby.map(([n,d])=>`<div><strong>${n}</strong><div class="small">${d}</div></div>`).join('')}</div></div>`:'';
  const reviews=r?`<div class="card pad" style="margin-top:20px"><h2>Verified guest reviews</h2><div class="timeline"><div><div class="rating">★★★★★</div><strong>Beautiful and peaceful</strong><p class="small">Clean, comfortable and a thoughtful host. Exactly as pictured.</p></div><div><div class="rating">★★★★☆</div><strong>Great location</strong><p class="small">The stay worked well for exploring the area and nearby attractions.</p></div></div></div>`:'';
  const banner=l.status!=='approved'?`<div class="notice" style="margin-bottom:16px"><strong>Preview.</strong> This listing is “${esc((STATUS[l.status]||[,l.status])[1])}” and is not visible to tourists yet.</div>`:'';
  root.innerHTML=`${gallery}<section class="page" style="padding-top:30px"><div class="grid detail-layout"><div>${banner}<div class="eyebrow">${esc(l.type||'Stay')}</div><h1>${esc(l.name)}</h1><p class="rating">${esc((l.location||'').toUpperCase())}${r?` · ${r.toFixed(1)} (${l.reviews||0} REVIEWS)`:' · NEW LISTING'}</p><p class="sub" style="margin-top:18px">${esc(l.description)}</p><section class="detail-info-grid" aria-label="Stay ratings and amenities">${ratingCard}<div class="card pad amenities-card"><div class="eyebrow">What this stay offers</div><h2>Amenities</h2><div class="amenities-grid">${amen}</div></div></section>${l.rules?`<div class="card pad" style="margin-top:20px"><h2>House rules</h2><p class="small" style="font-size:13px">${esc(l.rules)}</p></div>`:''}${nearby}${reviews}</div><aside><div class="card pad" style="position:sticky;top:95px"><div class="price">KSh ${Math.round(l.price).toLocaleString('en-KE')} <small>/ night</small></div><div class="grid grid-2" style="margin-top:18px"><div class="field"><label>CHECK IN</label><input type="date" value="2026-10-14" data-draft="checkin" required></div><div class="field"><label>CHECK OUT</label><input type="date" value="2026-10-18" data-draft="checkout" required></div></div><div class="field" style="margin-top:14px"><label>GUESTS</label><select data-draft="guests"><option>2 guests</option><option>1 guest</option><option>3 guests</option></select></div><a class="btn" style="display:flex;margin-top:16px" href="book.html" data-reserve>Reserve</a><a class="home-link" style="display:block;text-align:center;margin-top:13px" href="favourites.html" data-fav="${esc(l.id)}" data-label="♡ Save to favourites">♡ Save to favourites</a><a class="home-link" style="display:block;text-align:center;margin-top:9px" href="report.html">Report this listing</a></div></aside></div></section>`;
}

/* ---------- tourist: attraction page ---------- */
function initAttractionPage(){
  const root=document.querySelector('[data-attraction-page]'); if(!root) return;
  const id=new URLSearchParams(location.search).get('id')||'maasai-mara', a=attractionById(id), s=getSession();
  if(!a || (a.status!=='published' && !(s && s.role==='admin'))){
    document.title='Attraction not found — StayExplore Kenya';
    root.innerHTML=`<div class="eyebrow">Attraction</div><h1>Attraction not found.</h1><p class="sub">This attraction isn't available right now.</p><div class="actions" style="margin-top:20px"><a class="btn" href="search.html#attractions">Browse attractions</a></div>`; return;
  }
  document.title=`${a.name} — StayExplore Kenya`;
  const imgs=(a.images&&a.images.length?a.images:defaultImages(a)), stays=nearbyStays(a);
  const findHref=a.region?`search.html?region=${encodeURIComponent(a.region)}`:`search.html?q=${encodeURIComponent(a.county||a.name)}`;
  const fact=(t,v)=>v?`<div class="kpi"><div class="eyebrow">${t}</div><strong>${esc(v)}</strong></div>`:'';
  root.innerHTML=`${a.status!=='published'?`<div class="notice" style="margin-bottom:14px"><strong>Draft preview.</strong> Only administrators can see this until it is published.</div>`:''}<div class="eyebrow">${esc(a.category)} · ${esc(a.county)}</div><h1>${esc(a.name)}.</h1><p class="sub">${esc(a.tagline||'')}</p><div class="photo attraction-hero" style="${bgStyle(imgs[0])}"></div>${imgs.length>1?`<div class="thumb-row">${imgs.slice(1,4).map(i=>`<div class="photo" style="${bgStyle(i)}"></div>`).join('')}</div>`:''}<div class="grid grid-3 facts">${fact('Landscape',a.terrain)}${fact('Best time to go',a.bestTime)}${fact('Climate',a.climate)}</div><div class="grid grid-2" style="margin-top:20px"><div class="card pad"><h2>Why visit</h2><p>${esc(a.description||'')}</p><div class="actions"><a class="btn" href="${findHref}">Find nearby stays</a><button class="btn btn-outline" type="button" data-fav="${esc(a.id)}" data-label="♡ Save attraction">♡ Save attraction</button></div></div><div class="card pad"><h2>Nearby</h2><div class="kpi"><strong>Accommodation</strong><span class="small">${stays.length} recommended stay${stays.length===1?'':'s'}</span></div><div class="kpi" style="margin-top:10px"><strong>Best for</strong><span class="small">${esc(a.bestFor||'Sightseeing and day trips')}</span></div></div></div><h2 style="margin-top:34px">Stays near ${esc(a.name)}</h2>${stays.length?`<div class="grid grid-3">${stays.slice(0,3).map(l=>`<article class="card"><div class="photo" style="${bgStyle(coverOf(l))}"></div><div class="pad"><h3>${esc(l.name)}</h3><p class="small">${esc(l.location)} · KSh ${Math.round(l.price).toLocaleString('en-KE')}/night</p><a class="btn btn-sm" href="details.html?id=${encodeURIComponent(l.id)}">View stay</a></div></article>`).join('')}</div>`:`<div class="card pad empty"><p class="small">No approved stays near this attraction yet.</p></div>`}`;
}

/* ---------- host: manage listings, edit listing, dashboard numbers ---------- */
function hostListings(){ return getListings().filter(canEditListing); }
function initHostListings(){
  const body=document.querySelector('[data-host-listings]'); if(!body) return;
  const s=getSession();
  const draw=()=>{
    const mine=hostListings();
    body.innerHTML=mine.length?mine.map(l=>`<tr><td><strong>${esc(l.name)}</strong></td><td>${esc(l.location)}</td><td>${money(l.price)}</td><td>${badge(l.status)}</td><td>${l.bookings||0}</td><td class="row-actions"><a class="home-link" href="host-edit-listing.html?id=${encodeURIComponent(l.id)}">Edit</a> · <a class="home-link" href="details.html?id=${encodeURIComponent(l.id)}">View</a>${l.ownerId===s.id?` · <button type="button" class="link-danger" data-del="${esc(l.id)}">Delete</button>`:''}</td></tr>`).join(''):`<tr><td colspan="6" class="small" style="padding:24px">You have no listings yet. Use “Add stay” to create your first one.</td></tr>`;
    const c=st=>mine.filter(l=>l.status===st).length;
    setStat('approved',`${c('approved')} approved`); setStat('pending',`${c('pending')+c('review')} pending`);
  };
  body.addEventListener('click',e=>{
    const b=e.target.closest('[data-del]'); if(!b) return;
    const l=listingById(b.dataset.del); if(!l || !confirm(`Delete “${l.name}”? This cannot be undone.`)) return;
    if(saveListings(getListings().filter(x=>x.id!==l.id))){ draw(); showToast('Listing deleted'); }
  });
  draw();
}
const STATUS_LINE = { approved:'Approved · Visible to tourists', pending:'Pending review · Not yet visible to tourists', review:'Needs review · Not yet visible to tourists', rejected:'Rejected · Edit and save to resubmit', suspended:'Suspended · Not visible to tourists' };
function fillListingForm(form,l){
  const set=(n,v)=>{ const el=form.querySelector(`[name="${n}"]`); if(el) el.value=v??''; };
  ['name','location','price','description','rules'].forEach(n=>set(n,l[n]));
  set('amenities',(l.amenities||[]).join(', '));
  const sel=form.querySelector('[name="type"]');
  if(sel){ if(l.type && ![...sel.options].some(o=>o.value===l.type||o.text===l.type)) sel.add(new Option(l.type,l.type)); sel.value=l.type||sel.value; }
  const st=form.querySelector('[name="status"]'); if(st) st.value=l.status;
  form.dataset.id=l.id;
}
function paintHostEdit(l){
  document.title=`Edit ${l.name} — StayExplore Kenya`;
  document.querySelectorAll('[data-listing="title"]').forEach(e=>e.textContent=`Edit ${l.name}`);
  document.querySelectorAll('[data-listing="name"]').forEach(e=>e.textContent=l.name);
  document.querySelectorAll('[data-listing="status"]').forEach(e=>e.textContent=STATUS_LINE[l.status]||l.status);
  document.querySelectorAll('[data-listing="link"]').forEach(e=>e.href=`details.html?id=${encodeURIComponent(l.id)}`);
  const c=document.querySelector('#listingCover'); if(c){ c.style.backgroundImage=`url('${coverOf(l)}')`; }
}
function initHostEdit(){
  const form=document.querySelector('#listingForm[data-mode="host-edit"]'); if(!form) return;
  const l=listingById(new URLSearchParams(location.search).get('id')||'');
  if(!l || !canEditListing(l)){ setFlash('That listing could not be found in your account.'); go('host-manage-listings.html'); return; }
  fillListingForm(form,l); paintHostEdit(l);
}

/* shared save for host add / host edit / admin edit */
async function handleListing(form){
  const mode=form.dataset.mode, s=getSession(), v=n=>(form.querySelector(`[name="${n}"]`)?.value||'').trim();
  const f={ name:v('name'), location:v('location'), price:Math.round(+v('price')), type:v('type')||'Apartment', description:v('description'), amenities:splitList(v('amenities')), rules:v('rules') };
  if(f.name.length<3) return formMessage(form,'Please enter a property name (at least 3 characters).');
  if(!f.location) return formMessage(form,'Please enter the location.');
  if(!(f.price>0)) return formMessage(form,'Enter a nightly price greater than zero.');
  if(f.description.length<10) return formMessage(form,'Please add a short description (at least 10 characters).');
  let imgs; try{ imgs=await readImages(form); }catch(e){ return formMessage(form,e.message); }
  const list=getListings(), region=regionOf(`${f.location} ${f.name}`);
  if(mode==='host-add'){
    const l=Object.assign({id:uniqueId(f.name,list.map(x=>x.id)),region,rating:0,reviews:0,score:78,bookings:0,status:'pending',ownerId:s.id,hostName:s.name,submitted:todayISO(),images:[]},f);
    l.images=imgs.length?imgs:defaultImages(l);
    list.unshift(l);
    if(!saveListings(list)) return formMessage(form,QUOTA_MSG);
    setFlash('Listing submitted. An administrator will review it before it goes live.'); redirecting=true; go('host-manage-listings.html'); return;
  }
  const l=list.find(x=>x.id===form.dataset.id);
  if(!l) return formMessage(form,'This listing no longer exists.');
  if(mode==='host-edit' && !canEditListing(l)) return formMessage(form,'You can only edit your own listings.');
  if(mode==='admin-edit' && s.role!=='admin') return formMessage(form,'Only administrators can do that.');
  Object.assign(l,f,{region:region||l.region,updated:Date.now()});
  if(imgs.length) l.images=imgs;
  let msg='Listing changes saved';
  if(mode==='host-edit' && l.status==='rejected'){ l.status='pending'; msg='Changes saved and listing resubmitted for review'; }
  if(mode==='admin-edit'){ const st=v('status'); if(STATUS[st]) l.status=st; msg='Listing updated'; }
  if(!saveListings(list)) return formMessage(form,QUOTA_MSG);
  [...form.elements].filter(e=>e.type==='file').forEach(i=>i.value='');
  if(mode==='host-edit') paintHostEdit(l); else window.dispatchEvent(new CustomEvent('se-listings-changed'));
  showToast(msg);
}

/* ---------- admin: listing approvals (+ edit) ---------- */
function initAdminListings(){
  const body=document.querySelector('[data-admin-listings]'); if(!body) return;
  const form=document.querySelector('#listingForm[data-mode="admin-edit"]'), panel=document.querySelector('#adminListingPanel');
  const order={review:0,pending:1,approved:2,suspended:3,rejected:4};
  const draw=()=>{
    const all=getListings().slice().sort((a,b)=>(order[a.status]??9)-(order[b.status]??9));
    body.innerHTML=all.map(l=>{
      const id=esc(l.id), pend=l.status==='pending'||l.status==='review';
      const acts=(pend||l.status==='rejected'||l.status==='suspended'?`<button type="button" class="btn btn-sm" data-set="approved" data-id="${id}">Approve</button> `:'')
        +(pend?`<button type="button" class="btn btn-danger btn-sm" data-set="rejected" data-id="${id}">Reject</button> `:'')
        +(l.status==='approved'?`<button type="button" class="btn btn-danger btn-sm" data-set="suspended" data-id="${id}">Suspend</button> `:'')
        +`<button type="button" class="btn btn-outline btn-sm" data-edit="${id}">${l.status==='review'?'Review':'Edit'}</button>`;
      return `<tr><td><strong>${esc(l.name)}</strong></td><td>${hostCell(l)}</td><td>${esc(l.location)}</td><td>${shortDate(l.submitted||todayISO())}</td><td>${badge(l.status)}</td><td class="row-actions">${acts}</td></tr>`;
    }).join('')||`<tr><td colspan="6" class="small" style="padding:24px">No listings yet.</td></tr>`;
    const c=st=>all.filter(l=>l.status===st).length;
    setStat('pending',c('pending')+c('review')); setStat('approved',c('approved')); setStat('rejected',c('rejected')+c('suspended'));
  };
  body.addEventListener('click',e=>{
    const set=e.target.closest('[data-set]'), ed=e.target.closest('[data-edit]');
    if(set){
      const list=getListings(), l=list.find(x=>x.id===set.dataset.id); if(!l) return;
      l.status=set.dataset.set; l.updated=Date.now();
      if(saveListings(list)){ draw(); showToast(`${l.name}: ${STATUS[l.status][1].toLowerCase()}`); }
    }
    if(ed && form){
      const l=listingById(ed.dataset.edit); if(!l) return;
      fillListingForm(form,l); form.querySelectorAll('input[type=file]').forEach(i=>i.value='');
      document.querySelector('#adminListingTitle').textContent=`Edit “${l.name}”`;
      const c=document.querySelector('#adminListingCover'); if(c) c.style.backgroundImage=`url('${coverOf(l)}')`;
      panel.hidden=false; panel.scrollIntoView({behavior:'smooth',block:'start'});
    }
  });
  document.querySelector('#adminListingCancel')?.addEventListener('click',()=>{ panel.hidden=true; });
  window.addEventListener('se-listings-changed',draw);
  draw();
}

/* ---------- admin: attractions ---------- */
function initAdminAttractions(){
  const body=document.querySelector('[data-admin-attractions]'); if(!body) return;
  const form=document.querySelector('#attractionForm'), title=document.querySelector('#attractionFormTitle'), cancel=document.querySelector('#attractionCancel'), cover=document.querySelector('#attractionCover');
  const reset=()=>{ form.reset(); delete form.dataset.id; title.textContent='Add attraction'; cancel.hidden=true; form.querySelector('[type=submit]').textContent='Save attraction'; if(cover){ cover.style.backgroundImage=''; cover.textContent='Choose a photo or leave blank for a landscape-matched default'; } };
  const draw=()=>{
    body.innerHTML=getAttractions().map(a=>{ const id=esc(a.id), pub=a.status==='published';
      return `<tr><td><strong>${esc(a.name)}</strong></td><td>${esc(a.county)}</td><td>${esc(a.category)}</td><td>${nearbyStays(a).length}</td><td>${badge(a.status)}</td><td class="row-actions"><button type="button" class="btn btn-outline btn-sm" data-aedit="${id}">Edit</button> <button type="button" class="btn ${pub?'btn-outline':''} btn-sm" data-atoggle="${id}">${pub?'Unpublish':'Publish'}</button> <button type="button" class="link-danger" data-adel="${id}">Delete</button></td></tr>`; }).join('')||`<tr><td colspan="6" class="small" style="padding:24px">No attractions yet.</td></tr>`;
  };
  body.addEventListener('click',e=>{
    const ed=e.target.closest('[data-aedit]'), tg=e.target.closest('[data-atoggle]'), dl=e.target.closest('[data-adel]');
    if(ed){
      const a=attractionById(ed.dataset.aedit); if(!a) return;
      const set=(n,v)=>{ const el=form.querySelector(`[name="${n}"]`); if(el) el.value=v??''; };
      ['name','county','category','tagline','description','terrain','bestTime'].forEach(n=>set(n,a[n]));
      form.dataset.id=a.id; title.textContent=`Edit ${a.name}`; cancel.hidden=false; form.querySelector('[type=submit]').textContent='Save changes';
      if(cover){ cover.style.backgroundImage=`url('${coverOf(a)}')`; cover.style.backgroundSize='cover'; cover.style.backgroundPosition='center'; cover.textContent=''; }
      form.scrollIntoView({behavior:'smooth',block:'center'});
    }
    if(tg){ const list=getAttractions(), a=list.find(x=>x.id===tg.dataset.atoggle); if(!a) return; a.status=a.status==='published'?'draft':'published'; if(saveAttractions(list)){ draw(); showToast(`${a.name} ${a.status==='published'?'published':'moved to draft'}`); } }
    if(dl){ const a=attractionById(dl.dataset.adel); if(!a||!confirm(`Delete “${a.name}”? This cannot be undone.`)) return; if(saveAttractions(getAttractions().filter(x=>x.id!==a.id))){ if(form.dataset.id===a.id) reset(); draw(); showToast('Attraction deleted'); } }
  });
  cancel.addEventListener('click',reset);
  window.addEventListener('se-attractions-changed',()=>{ draw(); reset(); });
  draw();
}
async function handleAttraction(form){
  const v=n=>(form.querySelector(`[name="${n}"]`)?.value||'').trim();
  const f={ name:v('name'), county:v('county'), category:v('category')||'Wildlife', tagline:v('tagline'), description:v('description'), terrain:v('terrain'), bestTime:v('bestTime') };
  if(f.name.length<2) return formMessage(form,'Please enter the attraction name.');
  if(!f.county) return formMessage(form,'Please enter the county.');
  let imgs; try{ imgs=await readImages(form,3); }catch(e){ return formMessage(form,e.message); }
  const list=getAttractions(), region=regionOf(`${f.county} ${f.name}`)||CATEGORY_REGION[f.category]||null;
  let msg;
  if(form.dataset.id){
    const a=list.find(x=>x.id===form.dataset.id); if(!a) return formMessage(form,'This attraction no longer exists.');
    Object.assign(a,f,{region:regionOf(`${f.county} ${f.name}`)||a.region||region}); if(imgs.length) a.images=imgs; msg='Attraction updated';
  } else {
    const a=Object.assign({id:uniqueId(f.name,list.map(x=>x.id)),region,bestFor:'',climate:'',images:[],status:'draft'},f);
    a.images=imgs.length?imgs:defaultImages(a); list.push(a); msg='Attraction saved as draft';
  }
  if(!saveAttractions(list)) return formMessage(form,QUOTA_MSG);
  showToast(msg); window.dispatchEvent(new CustomEvent('se-attractions-changed'));
}
/* ---------- profiles (tourist, host, admin) ---------- */
function paintAvatar(){
  const s=getSession(); if(!s) return; const a=getAccounts().find(x=>x.id===s.id);
  document.querySelectorAll('[data-avatar]').forEach(el=>{
    const ini=el.querySelector('[data-user="initials"]');
    if(a&&a.avatar){ el.style.backgroundImage=`url('${a.avatar}')`; el.style.backgroundSize='cover'; el.style.backgroundPosition='center'; if(ini) ini.hidden=true; }
    else { el.style.backgroundImage=''; if(ini) ini.hidden=false; }
  });
}
function bindUser(){
  const s=getSession(); if(!s) return;
  document.querySelectorAll('[data-user="name"]').forEach(e=>e.tagName==='INPUT'?e.value=s.name:e.textContent=s.name);
  document.querySelectorAll('[data-user="email"]').forEach(e=>e.tagName==='INPUT'?e.value=s.email:e.textContent=s.email);
  document.querySelectorAll('[data-user="initials"]').forEach(e=>e.textContent=s.name.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase());
  document.querySelectorAll('.user-chip').forEach(e=>e.textContent=s.name);
  paintAvatar();
}
function initProfile(){
  const form=document.querySelector('[data-profile-form]'), s=getSession(); if(!form||!s) return;
  const a=getAccounts().find(x=>x.id===s.id)||s;
  ['phone','country','business'].forEach(n=>{ const el=form.querySelector(`[name="${n}"]`); if(el && a[n]!==undefined) el.value=a[n]; });
}
async function handleProfile(form){
  const s=getSession(), list=getAccounts(), a=list.find(x=>x.id===s.id);
  if(!a) return formMessage(form,'We could not find your account. Please sign out and sign in again.');
  const v=n=>(form.querySelector(`[name="${n}"]`)?.value||'').trim();
  const name=v('name').replace(/\s+/g,' '), email=v('email').toLowerCase();
  if(name.length<2) return formMessage(form,'Please enter your full name.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return formMessage(form,'Please enter a valid email address.');
  if(list.some(x=>x.id!==a.id && x.email===email)) return formMessage(form,'Another account already uses that email address.');
  a.name=name; a.email=email;
  ['phone','country','business'].forEach(n=>{ if(form.querySelector(`[name="${n}"]`)) a[n]=v(n); });
  if(!putLS(K.acc,JSON.stringify(list))) return formMessage(form,QUOTA_MSG);
  ls.set(K.ses,JSON.stringify(Object.assign({},getSession(),{name:a.name,email:a.email})));   // keep the same expiry
  bindUser(); showToast(form.dataset.success||'Profile updated');
}
function initPhotoUpload(){
  document.querySelectorAll('[data-photo-input]').forEach(inp=>inp.addEventListener('change',async()=>{
    const f=inp.files&&inp.files[0]; if(!f) return;
    try{
      const data=await readImage(f,320,.85), s=getSession(), list=getAccounts(), a=list.find(x=>x.id===s.id);
      if(!a) throw new Error('Account not found.');
      a.avatar=data; if(!putLS(K.acc,JSON.stringify(list))) throw new Error(QUOTA_MSG);
      paintAvatar(); showToast('Profile photo updated');
    }catch(e){ showToast(e.message||'That photo could not be used.'); }
    inp.value='';
  }));
}

/* ======================================================================
   BOOKINGS — one shared list read by tourist, host and admin screens
   ====================================================================== */
const getAllBookings = ()=>readJSON(ls,K.allbk,[]);
const saveAllBookings = a=>putLS(K.allbk,JSON.stringify(a));
const userBookings = ()=>{ const s=getSession(); return s?getAllBookings().filter(b=>b.guestId===s.id):[]; };
const hostBookings = ()=>{ const ids=new Set(hostListings().map(l=>l.id)); return getAllBookings().filter(b=>ids.has(b.stayId)); };
const addDays = (d,n)=>{ const t=new Date(d+'T00:00:00Z'); t.setUTCDate(t.getUTCDate()+n); return t.toISOString().slice(0,10); };
const bookingState = b=>b.status==='cancelled'?'cancelled':(b.checkout<todayISO()?'completed':'confirmed');
const BK_BADGE = { confirmed:'<span class="status success">Confirmed</span>', completed:'<span class="status info">Completed</span>', cancelled:'<span class="status danger">Cancelled</span>' };
const fmtRange = b=>`${fmtDate(b.checkin)} – ${fmtDate(b.checkout)}`;
const fmtStamp = t=>new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
const joinedOf = a=>a.created||+((String(a.id).match(/\d{10,}/)||[0])[0]);

/* returns a message when the dates can't be booked, '' when they are free */
function stayConflict(stayId,ci,co){
  const l=listingById(stayId);
  if(getAllBookings().some(b=>b.stayId===stayId && b.status!=='cancelled' && ci<b.checkout && co>b.checkin)) return 'Those dates are already booked. Please choose different dates.';
  if(l && (l.blocked||[]).some(r=>ci<addDays(r.to,1) && co>r.from)) return 'The host is not accepting bookings for some of those dates. Please choose different dates.';
  return '';
}
function addBooking(b){
  const s=getSession(), all=getAllBookings(); all.unshift(b);
  if(!saveAllBookings(all)) return false;
  const L=getListings(), l=L.find(x=>x.id===b.stayId); if(l){ l.bookings=(l.bookings||0)+1; saveListings(L); }
  ls.set(K.last+s.id,JSON.stringify(b)); return true;
}
function cancelBooking(ref,by){
  const all=getAllBookings(), b=all.find(x=>x.ref===ref); if(!b || b.status==='cancelled') return false;
  b.status='cancelled'; b.cancelledBy=by; b.payment='refunded'; b.cancelledAt=Date.now();
  if(!saveAllBookings(all)) return false;
  const L=getListings(), l=L.find(x=>x.id===b.stayId); if(l){ l.bookings=Math.max(0,(l.bookings||0)-1); saveListings(L); }
  return true;
}
/* called when the guest pays. Returns an error message, or '' when the booking was saved */
function completeBooking(){
  const s=getSession(); if(!s) return 'Please sign in to book.';
  const d=getDraft()||Object.assign({stayId:'karura-house',checkin:'2026-10-14',checkout:'2026-10-18',guests:'2 guests'},STAYS['karura-house']);
  const l=listingById(d.stayId||'karura-house');
  if(!l || l.status!=='approved') return 'This stay is not open for booking right now.';
  if(!d.checkin || !d.checkout || nightsBetween(d.checkin,d.checkout)<1) return 'Please choose valid dates.';
  const c=stayConflict(l.id,d.checkin,d.checkout); if(c) return c;
  const p=priceOf(Object.assign({},d,{price:l.price})), taken=new Set(getAllBookings().map(b=>b.ref)); let ref;
  do{ ref='SE-'+new Date().getFullYear()+'-'+String(Math.floor(1000+Math.random()*9000)); }while(taken.has(ref));
  const b={ref,stayId:l.id,stay:l.name,place:l.location,hostId:l.ownerId,checkin:d.checkin,checkout:d.checkout,guests:d.guests||'2 guests',nights:p.n,subtotal:p.sub,fee:p.fee,total:p.total,status:'confirmed',payment:'paid',guestId:s.id,guestName:s.name,guestEmail:s.email,phone:d.phone||'',created:Date.now()};
  if(!addBooking(b)) return QUOTA_MSG;
  ss.del(K.draft); return '';
}

/* ---------- tourist: My bookings ---------- */
function initTouristBookings(){
  const body=document.querySelector('[data-user-bookings]'); if(!body) return;
  const draw=()=>{
    const list=userBookings().sort((a,b)=>b.created-a.created), today=todayISO();
    body.innerHTML=list.length?list.map(b=>{ const st=bookingState(b);
      return `<tr><td><strong>${esc(b.stay)}</strong><div class="small">${esc(b.place)} · ${esc(b.ref)}</div></td><td>${fmtRange(b)}</td><td>${esc(parseInt(b.guests)||1)}</td><td>${money(b.total)}</td><td>${BK_BADGE[st]}</td><td class="row-actions"><a class="home-link" href="confirmation.html?ref=${encodeURIComponent(b.ref)}">View</a>${st==='completed'?' · <a class="home-link" href="review.html">Review</a>':''}${st==='confirmed'&&b.checkin>=today?` · <button type="button" class="link-danger" data-cancel="${esc(b.ref)}">Cancel</button>`:''}</td></tr>`; }).join('')
      :`<tr><td colspan="6" class="small" style="padding:24px">You have no bookings yet. <a class="home-link" href="search.html">Find a stay</a></td></tr>`;
    const n=k=>list.filter(b=>bookingState(b)===k).length, set=(k,v)=>document.querySelectorAll(`[data-bind="${k}"]`).forEach(e=>e.textContent=v);
    set('upcoming',`${n('confirmed')} trip${n('confirmed')===1?'':'s'}`); set('history',`${n('completed')} stay${n('completed')===1?'':'s'}`);
  };
  body.addEventListener('click',e=>{ const b=e.target.closest('[data-cancel]'); if(!b || !confirm('Cancel this booking? Your payment will be refunded.')) return; if(cancelBooking(b.dataset.cancel,'guest')){ draw(); showToast('Booking cancelled'); } });
  draw();
}

/* ---------- host: bookings, payments, availability, dashboard ---------- */
function initHostBookings(){
  const body=document.querySelector('[data-host-bookings]'); if(!body) return;
  const draw=()=>{
    const list=hostBookings().sort((a,b)=>b.created-a.created);
    body.innerHTML=list.length?list.map(b=>{ const st=bookingState(b);
      return `<tr><td><strong>${esc(b.guestName)}</strong><div class="small">${esc(b.guestEmail||'')}${b.phone?' · '+esc(b.phone):''}</div></td><td>${esc(b.stay)}<div class="small">${esc(b.ref)}</div></td><td>${fmtRange(b)}</td><td>${money(b.total)}<div class="small">${b.nights||nightsBetween(b.checkin,b.checkout)} nights · ${esc(b.guests)}</div></td><td>${BK_BADGE[st]}</td><td>${st==='confirmed'?`<button type="button" class="btn btn-outline btn-sm" data-cancel="${esc(b.ref)}">Cancel</button>`:''}</td></tr>`; }).join('')
      :`<tr><td colspan="6" class="small" style="padding:24px">No bookings yet. When a guest books one of your stays it appears here straight away.</td></tr>`;
    const n=k=>list.filter(b=>bookingState(b)===k).length;
    setStat('bk-upcoming',n('confirmed')); setStat('bk-done',n('completed')); setStat('bk-cancelled',n('cancelled'));
  };
  body.addEventListener('click',e=>{ const b=e.target.closest('[data-cancel]'); if(!b || !confirm('Cancel this booking? The guest will be refunded and the dates reopen.')) return; if(cancelBooking(b.dataset.cancel,'host')){ draw(); showToast('Booking cancelled'); } });
  draw();
}
function initHostPayments(){
  const body=document.querySelector('[data-host-payments]'); if(!body) return;
  const list=hostBookings().sort((a,b)=>b.created-a.created), paid=list.filter(b=>b.payment==='paid');
  body.innerHTML=list.length?list.map(b=>`<tr><td>${esc(b.ref)}</td><td>${esc(b.guestName)}</td><td>${fmtStamp(b.created)}</td><td>${esc(b.stay)}</td><td>${money(b.total)}</td><td>${b.payment==='paid'?'<span class="status success">Paid</span>':'<span class="status warning">Refunded</span>'}</td></tr>`).join('')
    :`<tr><td colspan="6" class="small" style="padding:24px">No payments yet.</td></tr>`;
  const gross=paid.reduce((t,b)=>t+b.total,0), fees=paid.reduce((t,b)=>t+(b.fee||0),0);
  setStat('pay-gross',money(gross)); setStat('pay-fees',money(fees)); setStat('pay-earn',money(gross-fees));
}
function initHostDashboard(){
  if(!document.querySelector('[data-stat="host-active"]')) return;
  const mine=hostListings(), a=mine.filter(l=>l.status==='approved').length, p=mine.filter(l=>l.status==='pending'||l.status==='review').length;
  setStat('host-active',a); setStat('host-active-sub',`${a} approved · ${p} pending`); setStat('host-pending',`${p} listing${p===1?'':'s'}`);
  const B=hostBookings(), live=B.filter(b=>bookingState(b)==='confirmed'), paid=B.filter(b=>b.payment==='paid');
  setStat('host-upcoming',live.length); setStat('host-upcoming-sub',`${B.length} booking${B.length===1?'':'s'} in total`);
  setStat('host-income',money(paid.reduce((t,b)=>t+b.total-(b.fee||0),0))); setStat('host-income-sub',`From ${paid.length} paid booking${paid.length===1?'':'s'}`);
  const rated=mine.filter(l=>+l.rating>0), rv=rated.reduce((t,l)=>t+(l.reviews||0),0), avg=rv?rated.reduce((t,l)=>t+l.rating*(l.reviews||0),0)/rv:0;
  setStat('host-rating',avg?avg.toFixed(1):'New'); setStat('host-rating-sub',`${rv} guest review${rv===1?'':'s'}`);
  const body=document.querySelector('[data-host-recent]');
  if(body){ const rec=B.slice().sort((x,y)=>y.created-x.created).slice(0,5);
    body.innerHTML=rec.length?rec.map(b=>`<tr><td>${esc(b.guestName)}</td><td>${esc(b.stay)}</td><td>${fmtRange(b)}</td><td>${BK_BADGE[bookingState(b)]}</td></tr>`).join(''):`<tr><td colspan="4" class="small" style="padding:18px">No bookings yet.</td></tr>`; }
}
function initHostAvailability(){
  const cal=document.querySelector('#calendar'); if(!cal) return;
  const sel=document.querySelector('#availListing'), mine=hostListings();
  if(!mine.length){ cal.innerHTML='<p class="small">Add a listing to manage its availability.</p>'; return; }
  sel.innerHTML=mine.map(l=>`<option value="${esc(l.id)}">${esc(l.name)}</option>`).join('');
  let y=new Date().getUTCFullYear(), m=new Date().getUTCMonth();
  const pad=n=>String(n).padStart(2,'0');
  const draw=()=>{
    const id=sel.value, l=listingById(id), B=getAllBookings().filter(b=>b.stayId===id && b.status!=='cancelled'), blocks=l.blocked||[], today=todayISO();
    const first=new Date(Date.UTC(y,m,1)), days=new Date(Date.UTC(y,m+1,0)).getUTCDate(), off=(first.getUTCDay()+6)%7;
    document.querySelector('#calTitle').textContent=first.toLocaleDateString('en-GB',{month:'long',year:'numeric',timeZone:'UTC'});
    let h=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>`<div class="day"><strong>${d}</strong></div>`).join('')+'<div class="day empty"></div>'.repeat(off);
    for(let d=1;d<=days;d++){
      const ds=`${y}-${pad(m+1)}-${pad(d)}`, bk=B.find(b=>ds>=b.checkin && ds<b.checkout), bi=blocks.findIndex(r=>ds>=r.from && ds<=r.to);
      if(bk) h+=`<div class="day booked" data-ref="${esc(bk.ref)}" title="${esc(bk.guestName)}"><strong>${d}</strong><br><span class="small">${esc(bk.guestName.split(' ')[0])}</span></div>`;
      else if(bi>-1) h+=`<div class="day blocked" data-block="${bi}"><strong>${d}</strong><br><span class="small">Blocked</span></div>`;
      else if(ds<today) h+=`<div class="day"><strong>${d}</strong></div>`;
      else h+=`<div class="day available"><strong>${d}</strong><br><span class="small">Open</span></div>`;
    }
    cal.innerHTML=h;
    const up=B.filter(b=>b.checkout>=today).sort((a,b)=>a.checkin.localeCompare(b.checkin));
    document.querySelector('#availList').innerHTML=up.length?up.map(b=>`<div class="kpi" style="margin-top:8px"><strong>${esc(b.guestName)}</strong><span class="small">${fmtRange(b)} · ${esc(b.ref)}</span></div>`).join(''):'<p class="small">No upcoming bookings for this stay.</p>';
  };
  cal.addEventListener('click',e=>{
    const bk=e.target.closest('[data-ref]'), bl=e.target.closest('[data-block]');
    if(bk){ const b=getAllBookings().find(x=>x.ref===bk.dataset.ref); if(b) showToast(`${b.guestName} · ${fmtRange(b)} · ${b.ref}`); }
    if(bl){ const L=getListings(), l=L.find(x=>x.id===sel.value); if(!l||!canEditListing(l)||!confirm('Reopen these blocked dates?')) return; const r=(l.blocked||[])[+bl.dataset.block]; l.blocked=(l.blocked||[]).filter(x=>x!==r&&!(x.from===r.from&&x.to===r.to)); if(saveListings(L)){ draw(); showToast('Dates reopened'); } }
  });
  sel.addEventListener('change',draw);
  document.querySelector('#calPrev').addEventListener('click',()=>{ m--; if(m<0){ m=11; y--; } draw(); });
  document.querySelector('#calNext').addEventListener('click',()=>{ m++; if(m>11){ m=0; y++; } draw(); });
  document.querySelector('#blockBtn').addEventListener('click',()=>{
    const from=document.querySelector('#blockFrom').value, to=document.querySelector('#blockTo').value;
    if(!from||!to||to<from) return showToast('Choose a start date and an end date on or after it.');
    if(to<todayISO()) return showToast('You can only block dates from today onwards.');
    const L=getListings(), l=L.find(x=>x.id===sel.value); if(!l||!canEditListing(l)) return;
    if(getAllBookings().some(b=>b.stayId===l.id && b.status!=='cancelled' && from<b.checkout && addDays(to,1)>b.checkin)) return showToast('Those dates include a confirmed booking. Cancel it first.');
    (l.blocked=l.blocked||[]).push({from,to});
    if(!saveListings(L)) return showToast(QUOTA_MSG);
    document.querySelector('#blockFrom').value=document.querySelector('#blockTo').value=''; y=+from.slice(0,4); m=+from.slice(5,7)-1; draw(); showToast('Availability updated');
  });
  draw();
}

/* ---------- admin: users (real accounts), dashboard ---------- */
function hostCell(l){
  const acc=getAccounts().find(a=>a.id===l.ownerId);
  return acc?`${esc(acc.name)}<div class="small">${esc(acc.email)}${acc.sample?' · sample account':''}</div>`:`${esc(l.hostName||'—')}<div class="small">No account</div>`;
}
function initAdminUsers(){
  const body=document.querySelector('[data-admin-users]'); if(!body) return;
  const me=getSession(), filter=document.querySelector('#userFilter');
  const draw=()=>{
    const accs=getAccounts(), L=getListings(), B=getAllBookings(), f=filter?filter.value:'all';
    const rows=accs.filter(a=>f==='all'||a.role===f).sort((a,b)=>joinedOf(b)-joinedOf(a));
    body.innerHTML=rows.map(a=>{
      const owned=new Set(L.filter(l=>l.ownerId===a.id).map(l=>l.id));
      const act=a.role==='host'?`${owned.size} listing${owned.size===1?'':'s'} · ${B.filter(b=>owned.has(b.stayId)).length} bookings`:a.role==='tourist'?`${B.filter(b=>b.guestId===a.id).length} booking${B.filter(b=>b.guestId===a.id).length===1?'':'s'}`:'—';
      const j=joinedOf(a);
      return `<tr><td><strong>${esc(a.name)}</strong>${a.sample?' <span class="small">· sample</span>':''}</td><td>${esc(a.email)}</td><td>${esc(roleLabel(a.role))}</td><td>${j?fmtStamp(j):'—'}</td><td class="small">${act}</td><td>${a.suspended?'<span class="status danger">Suspended</span>':'<span class="status success">Active</span>'}</td><td>${a.role==='admin'||a.id===me.id?'':`<button type="button" class="btn ${a.suspended?'':'btn-danger '}btn-sm" data-susp="${esc(a.id)}">${a.suspended?'Reactivate':'Suspend'}</button>`}</td></tr>`; }).join('')||`<tr><td colspan="7" class="small" style="padding:24px">No users match.</td></tr>`;
    setStat('u-total',accs.length); setStat('u-hosts',accs.filter(a=>a.role==='host').length); setStat('u-tourists',accs.filter(a=>a.role==='tourist').length);
  };
  body.addEventListener('click',e=>{
    const b=e.target.closest('[data-susp]'); if(!b) return;
    const accs=getAccounts(), a=accs.find(x=>x.id===b.dataset.susp); if(!a||a.role==='admin') return;
    if(!a.suspended && !confirm(`Suspend ${a.name}? They will be signed out and unable to sign in.`)) return;
    a.suspended=!a.suspended; if(putLS(K.acc,JSON.stringify(accs))){ draw(); showToast(a.suspended?'Account suspended':'Account reactivated'); }
  });
  filter&&filter.addEventListener('change',draw); draw();
}
function initAdminDashboard(){
  if(!document.querySelector('[data-stat="admin-total"]')) return;
  const all=getListings(), p=all.filter(l=>l.status==='pending'||l.status==='review').length, accs=getAccounts(), B=getAllBookings();
  setStat('admin-total',all.length); setStat('admin-pending-sub',`${p} pending approval`); setStat('admin-pending',`${p} pending`);
  setStat('admin-users',accs.length); setStat('admin-users-sub',`${accs.filter(a=>a.role==='host').length} hosts · ${accs.filter(a=>a.role==='tourist').length} tourists`);
  setStat('admin-bookings',B.length); setStat('admin-bookings-sub',`${B.filter(b=>bookingState(b)==='confirmed').length} upcoming`);
  const body=document.querySelector('[data-admin-recent]');
  if(body){
    const items=[...all.map(l=>({t:Date.parse(l.submitted)||0,item:l.name,type:'Listing',owner:(getAccounts().find(a=>a.id===l.ownerId)||{name:l.hostName||'—'}).name,badge:badge(l.status)})),
                 ...B.map(b=>({t:b.created,item:b.ref+' · '+b.stay,type:'Booking',owner:b.guestName,badge:BK_BADGE[bookingState(b)]}))].sort((a,b)=>b.t-a.t).slice(0,6);
    body.innerHTML=items.map(i=>`<tr><td>${esc(i.item)}</td><td>${i.type}</td><td>${esc(i.owner)}</td><td>${i.badge}</td></tr>`).join('');
  }
}

/* ---------- host / admin application shell ---------- */
function initShell(){
  const shell=document.querySelector('[data-shell]');
  if(!shell || shell.dataset.ready) return;
  const role=need, active=document.body.dataset.active||'', s=getSession();
  const host=[['dashboard','Host overview','host-dashboard.html'],['listings','Manage listings','host-manage-listings.html'],['add','Add listing','host-add-listing.html'],['availability','Availability','host-availability.html'],['bookings','Manage bookings','host-manage-bookings.html'],['payments','Payment tracking','host-payments.html'],['reviews','Guest reviews','host-reviews.html'],['incident','Report incident','host-report-incident.html'],['profile','Host profile','host-profile.html']];
  const admin=[['dashboard','Admin overview','admin-dashboard.html'],['approvals','Listing approvals','admin-listing-approvals.html'],['users','Manage users','admin-manage-users.html'],['reviews','Moderate reviews','admin-moderate-reviews.html'],['incidents','Incident reports','admin-incident-reports.html'],['attractions','Manage attractions','admin-attractions.html'],['profile','Admin profile','admin-profile.html']];
  const nav=(role==='host'?host:admin).map(([id,l,h])=>`<a href="${h}" ${active===id?'class="active" aria-current="page"':''}>${l}</a>`).join('');
  const content=shell.innerHTML;                    // copy BEFORE replacing (avoids duplicated content)
  shell.dataset.ready='1';
  shell.innerHTML=`<aside class="app-sidebar"><a class="side-brand" href="index.html"><span class="brand-mark">SE</span><span>StayExplore<small>KENYA</small></span></a><div class="side-section">${role==='host'?'Hosting':'Administration'}</div><nav class="side-nav">${nav}</nav><div class="side-section">Account</div><nav class="side-nav"><a href="index.html">View website</a><a href="#" data-logout>Sign out</a></nav></aside><main class="app-main"><header class="app-top"><span class="user-chip">${esc(s?.name||roleLabel(role))}</span><span class="role-pill role-pill-dark">${roleLabel(role)}</span></header><div class="app-content">${content}</div></main>`;
}

/* ---------- auth forms ---------- */
function formMessage(form,text){
  let m=form.querySelector('.form-error');
  if(!m){ m=document.createElement('div'); m.className='form-error'; m.setAttribute('role','alert');
    const btn=form.querySelector('[type=submit]'), anchor=btn&&[...form.children].find(c=>c===btn||c.contains(btn));   // submit may be nested in a wrapper row
    form.insertBefore(m,anchor||null); }
  m.textContent=text; m.hidden=!text;
}
async function handleRegister(form){
  const f=n=>form.querySelector(`[name="${n}"]`);
  const name=f('name').value.trim(), email=f('email').value.trim().toLowerCase(), password=f('password').value, role=f('role').value;
  if(!['tourist','host'].includes(role)) return formMessage(form,'Administrator accounts cannot be created here.');
  const list=getAccounts();
  if(list.some(a=>a.email===email)) return formMessage(form,'An account with this email already exists. Please sign in instead.');
  const salt=newSalt();
  const account={id:'user-'+Date.now(),created:Date.now(),name,email,role,salt,hash:await sha(salt+password)};
  list.push(account); saveAccounts(list); setSession(account);
  setFlash(`Welcome to StayExplore, ${name.split(' ')[0]}! Your ${roleLabel(role).toLowerCase()} account is ready.`);
  go(safeNext(role)||routeForRole(role));
}
async function handleLogin(form){
  await ensureDemoAdmin(); await ensureSampleHosts();
  const email=form.querySelector('[name="email"]').value.trim().toLowerCase();
  const password=form.querySelector('[name="password"]').value;
  const list=getAccounts(); const a=list.find(x=>x.email===email);
  let ok=false;
  if(a){
    if(a.hash) ok=(await sha(a.salt+password))===a.hash;
    else if(a.password!==undefined && a.password===password){ ok=true; a.salt=newSalt(); a.hash=await sha(a.salt+password); delete a.password; saveAccounts(list); } // upgrade legacy plain-text account
  }
  if(!ok) return formMessage(form,'Incorrect email or password. If you are new here, create an account first.');
  if(a.suspended) return formMessage(form,'This account has been suspended. Please contact support.');
  setSession(a);
  setFlash(`Welcome back, ${a.name.split(' ')[0]}.`);
  go(safeNext(a.role)||routeForRole(a.role));
}

/* ---------- bookings, drafts, favourites ---------- */
const money=n=>'KSh '+Math.round(n).toLocaleString('en-KE');
const fmtDate=d=>new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const nightsBetween=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5);
const getDraft=()=>readJSON(ss,K.draft,null);
function priceOf(d){ const n=nightsBetween(d.checkin,d.checkout), sub=n*d.price, fee=Math.round(sub*0.05); return {n,sub,fee,total:sub+fee}; }
const favKey=()=>{ const s=getSession(); return s?K.favs+s.id:null; };
const getFavs=()=>{ const k=favKey(); return k?readJSON(ls,k,[]):[]; };

function initDateInputs(){
  const today=new Date().toISOString().slice(0,10);
  const inn=document.querySelector('[data-draft="checkin"]'), out=document.querySelector('[data-draft="checkout"]');
  if(!inn||!out) return;
  const sync=()=>{ inn.min=today; const m=new Date(inn.value||today); m.setDate(m.getDate()+1); out.min=m.toISOString().slice(0,10); if(out.value && out.value<=inn.value) out.value=out.min; };
  inn.addEventListener('change',sync); sync();
}
function stayBrief(id){ const l=listingById(id); return l?{stayId:l.id,name:l.name,place:l.location,price:l.price,rating:String(l.rating||'')}:Object.assign({stayId:'karura-house'},STAYS['karura-house']); }
function readDraftFromPage(){
  const d=currentStay?Object.assign({},getDraft()||{},stayBrief(currentStay.id)):Object.assign({stayId:'karura-house'},STAYS['karura-house'],getDraft()||{}); d.stay=d.name;
  document.querySelectorAll('[data-draft]').forEach(el=>{ d[el.dataset.draft]=el.value; });
  return d;
}
function initBookingFlow(){
  const page=currentPage();
  const reserve=document.querySelector('[data-reserve]');
  if(reserve) reserve.addEventListener('click',e=>{
    const d=readDraftFromPage();
    if(!d.checkin||!d.checkout||nightsBetween(d.checkin,d.checkout)<1){ e.preventDefault(); showToast('Choose a check-out date after your check-in date.'); return; }
    const busy=stayConflict(d.stayId,d.checkin,d.checkout); if(busy){ e.preventDefault(); showToast(busy); return; }
    ss.set(K.draft,JSON.stringify(d));
  });
  if(page==='book.html'||page==='payment.html'){
    const saved=getDraft(); const d=Object.assign({stayId:'karura-house'},STAYS['karura-house'],saved||{});
    if(!saved){ d.checkin='2026-10-14'; d.checkout='2026-10-18'; d.guests='2 guests'; }
    document.querySelectorAll('[data-draft]').forEach(el=>{ if(d[el.dataset.draft]) el.value=d[el.dataset.draft]; });
    const paint=()=>{
      Object.assign(d,Object.fromEntries([...document.querySelectorAll('[data-draft]')].map(e=>[e.dataset.draft,e.value])));
      if(!d.checkin||!d.checkout||nightsBetween(d.checkin,d.checkout)<1) return;
      const p=priceOf(d), set=(k,v)=>document.querySelectorAll(`[data-bind="${k}"]`).forEach(e=>e.textContent=v);
      set('range',`${fmtDate(d.checkin)} – ${fmtDate(d.checkout)} · ${d.guests||'2 guests'}`);
      set('nightsline',`${p.n} night${p.n>1?'s':''} × ${money(d.price)}`); set('sub',money(p.sub)); set('fee',money(p.fee)); set('total',money(p.total)); set('stay',d.name);
      ss.set(K.draft,JSON.stringify(d));
    };
    document.querySelectorAll('[data-draft]').forEach(e=>e.addEventListener('change',paint)); paint();
  }
  if(page==='confirmation.html'){
    const s=getSession(), ref=new URLSearchParams(location.search).get('ref'); const b=s&&(ref?getAllBookings().find(x=>x.ref===ref&&x.guestId===s.id):readJSON(ls,K.last+s.id,null));
    if(b){ const set=(k,v)=>document.querySelectorAll(`[data-bind="${k}"]`).forEach(e=>e.textContent=v);
      set('ref',b.ref); set('checkin',fmtDate(b.checkin)); set('checkout',fmtDate(b.checkout)); set('stay',b.stay); }
  }
}
function initFavourites(){
  document.querySelectorAll('[data-fav]').forEach(btn=>{
    const id=btn.dataset.fav, paint=()=>{ const on=getFavs().includes(id); btn.textContent=(on?'♥ Saved':btn.dataset.label||'♡ Save'); btn.setAttribute('aria-pressed',on); };
    paint();
    btn.addEventListener('click',e=>{
      e.preventDefault();
      const k=favKey(); if(!k){ requireLogin('Please sign in to save favourites.'); return; }
      let f=getFavs(); const on=f.includes(id); f=on?f.filter(x=>x!==id):[...f,id]; ls.set(k,JSON.stringify(f)); paint();
      showToast(on?'Removed from favourites':'Saved to favourites');
    });
  });
  const stays=document.querySelector('#favStays'), atts=document.querySelector('#favAttractions');
  if(!stays) return;
  const draw=()=>{
    const f=getFavs(), LS_=getListings(), AT_=getAttractions(), s=f.filter(i=>LS_.some(l=>l.id===i)), a=f.filter(i=>AT_.some(x=>x.id===i));
    stays.innerHTML=s.length?s.map(i=>{const x=LS_.find(l=>l.id===i);return `<article class="card"><div class="photo" style="${bgStyle(coverOf(x))}"></div><div class="pad"><h3>${esc(x.name)}</h3><div class="rating">${+x.rating?'★ '+(+x.rating).toFixed(1):'New listing'}</div><p class="small">${esc(x.location)} · ${money(x.price)}/night</p><div class="actions"><a class="btn btn-sm" href="details.html?id=${encodeURIComponent(i)}">View stay</a><button class="btn btn-outline btn-sm" type="button" data-unfav="${i}">Remove</button></div></div></article>`}).join(''):`<div class="card pad full empty"><div class="eyebrow">Saved stays</div><h2>No saved stays yet.</h2><p class="small">Tap “Save to favourites” on any stay to keep it here.</p><a class="btn btn-sm" href="search.html">Find a stay</a></div>`;
    atts.innerHTML=a.length?a.map(i=>{const x=AT_.find(t=>t.id===i);return `<article class="card"><div class="photo" style="${bgStyle(coverOf(x))}"></div><div class="pad"><h3>${esc(x.name)}</h3><p class="small">${esc(x.category)} · ${esc(x.county)}</p><div class="actions"><a class="btn btn-sm" href="attraction-details.html?id=${encodeURIComponent(i)}">View</a><button class="btn btn-outline btn-sm" type="button" data-unfav="${i}">Remove</button></div></div></article>`}).join(''):`<div class="card pad full empty"><div class="eyebrow">Saved attractions</div><h2>No saved attractions yet.</h2><p class="small">Explore destinations and save the ones you want to visit.</p><a class="btn btn-sm" href="search.html#attractions">Explore attractions</a></div>`;
    document.querySelectorAll('[data-unfav]').forEach(b=>b.addEventListener('click',()=>{ ls.set(favKey(),JSON.stringify(getFavs().filter(x=>x!==b.dataset.unfav))); draw(); showToast('Removed from favourites'); }));
  };
  draw();
}

/* ---------- search / filter / sort ---------- */
function initSearch(){
  const list=document.querySelector('#stayList'); if(!list) return;
  const $=s=>document.querySelector(s);
  list.innerHTML=getListings().filter(l=>l.status==='approved').map(stayCardHTML).join('');
  const cards=[...list.querySelectorAll('.filterable')];
  const params=new URLSearchParams(location.search); let region=REGIONS[params.get('region')]?params.get('region'):'';
  if(params.get('q')) $('#liveSearch').value=params.get('q');
  const note=document.createElement('div'); note.className='notice region-note'; note.hidden=true;
  list.parentElement.insertBefore(note,list);
  const paintNote=()=>{ note.hidden=!region; if(region){ note.innerHTML=`Showing stays near <strong>${esc(REGIONS[region].name)}</strong>. <a href="#" data-clear-region class="home-link">Show all stays</a>`; } };
  note.addEventListener('click',e=>{ if(e.target.closest('[data-clear-region]')){ e.preventDefault(); region=''; paintNote(); apply(); } });
  const apply=()=>{
    const q=($('#liveSearch').value||'').toLowerCase().trim();
    const min=parseFloat($('#minPrice').value)||0, max=parseFloat($('#maxPrice').value)||Infinity;
    const ratings=[...document.querySelectorAll('[data-min-rating]:checked')].map(c=>+c.dataset.minRating);
    const minRating=ratings.length?Math.min(...ratings):0;
    const amen=[...document.querySelectorAll('[data-amenity]:checked')].map(c=>c.dataset.amenity);
    let shown=0;
    cards.forEach(c=>{
      const ok=(!region||c.dataset.region===region) && c.textContent.toLowerCase().includes(q) && +c.dataset.price>=min && +c.dataset.price<=max && +c.dataset.rating>=minRating && amen.every(a=>c.dataset.amenities.split(',').includes(a));
      c.hidden=!ok; if(ok) shown++;
    });
    const sort=$('#sortBy').value, key={Recommended:['score',-1],'Lowest price':['price',1],'Highest rated':['rating',-1]}[sort]||['score',-1];
    [...cards].sort((a,b)=>(+a.dataset[key[0]]-+b.dataset[key[0]])*key[1]).forEach(c=>list.appendChild(c));
    $('#resultCount').textContent=`${shown} stay${shown===1?'':'s'} found · smart score enabled`;
    $('#noResults').hidden=shown>0;
  };
  ['#liveSearch','#minPrice','#maxPrice'].forEach(s=>$(s).addEventListener('input',apply));
  ['#sortBy'].forEach(s=>$(s).addEventListener('change',apply));
  document.querySelectorAll('[data-min-rating],[data-amenity]').forEach(c=>c.addEventListener('change',apply));
  $('#applyFilters').addEventListener('click',apply);
  $('#resetFilters').addEventListener('click',()=>{ document.querySelectorAll('#filters input').forEach(i=>i.type==='checkbox'?i.checked=false:i.value=''); region=''; paintNote(); apply(); });
  paintNote(); apply();
}

/* ---------- misc widgets ---------- */
function bindForms(){
  document.querySelectorAll('form').forEach(form=>{
    form.noValidate=false;
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      if(!form.checkValidity()){ form.reportValidity(); return; }
      const btn=form.querySelector('[type=submit]'); if(btn?.disabled) return;
      if(btn){ btn.disabled=true; btn.dataset.label=btn.textContent; }
      try{
        formMessage(form,'');
        if(form.id==='registerForm') await handleRegister(form);
        else if(form.id==='loginForm') await handleLogin(form);
        else if(form.hasAttribute('data-profile-form')) await handleProfile(form);
        else if(form.id==='listingForm') await handleListing(form);
        else if(form.id==='attractionForm') await handleAttraction(form);
        else {
          if(form.dataset.next==='confirmation.html'){ const err=completeBooking(); if(err){ formMessage(form,err); if(btn) btn.disabled=false; return; } }
          if(form.dataset.next==='payment.html'){ const d=getDraft()||{}; const ph=form.querySelector('[data-phone]'); if(ph){ d.phone=ph.value; ss.set(K.draft,JSON.stringify(d)); } }
          if(form.dataset.next){ go(form.dataset.next); return; }
          if(form.dataset.success){ showToast(form.dataset.success); }
        }
      } finally { if(btn && !redirecting && !form.dataset.next){ btn.disabled=false; } }
    });
  });
  document.querySelectorAll('[data-row-action]').forEach(b=>b.addEventListener('click',()=>{
    const row=b.closest('tr'), st=row&&row.querySelector('.status');
    if(st){ st.textContent=b.dataset.rowAction; st.className='status '+(b.dataset.rowClass||'success'); }
    b.disabled=true; b.textContent='Done'; showToast(b.dataset.toast||`${b.dataset.rowAction} successfully`);
  }));
  document.querySelectorAll('[data-toast]:not([data-row-action])').forEach(b=>b.addEventListener('click',()=>showToast(b.dataset.toast)));
}
function bindTabs(){
  document.querySelectorAll('[data-tab-group]').forEach(group=>{
    const buttons=[...group.querySelectorAll('.tab[data-target]')], panels=[...group.parentElement.querySelectorAll('[data-tab-panel]')];
    const activate=t=>{ buttons.forEach(b=>{const on=b.dataset.target===t;b.classList.toggle('active',on);b.setAttribute('aria-selected',on);}); panels.forEach(p=>p.hidden=p.dataset.tabPanel!==t); };
    buttons.forEach(b=>b.addEventListener('click',()=>{ activate(b.dataset.target); history.replaceState(null,'',b.dataset.target==='attractions'?'#attractions':location.pathname+location.search); renderChrome(); }));
    const fromHash=location.hash==='#attractions'&&buttons.some(b=>b.dataset.target==='attractions');
    activate(fromHash?'attractions':(buttons.find(b=>b.classList.contains('active'))||buttons[0]).dataset.target);
    window.addEventListener('hashchange',()=>{ activate(location.hash==='#attractions'?'attractions':buttons[0].dataset.target); renderChrome(); });
  });
}
function bindMisc(){
  document.querySelectorAll('[data-rating]').forEach(g=>{ const b=g.querySelectorAll('button'); b.forEach((x,i)=>x.addEventListener('click',()=>{ b.forEach((y,j)=>y.classList.toggle('active',j<=i)); g.dataset.value=i+1; })); });
  document.querySelectorAll('form').forEach(f=>{ const g=f.querySelector('[data-rating]'); if(g) f.addEventListener('submit',e=>{ if(!g.dataset.value){ e.stopImmediatePropagation(); e.preventDefault(); showToast('Please choose a star rating.'); } },true); });
  document.querySelectorAll('[data-action="change-photo"]').forEach(b=>b.addEventListener('click',()=>document.querySelector(b.dataset.input||'[data-photo-input]')?.click()));
  document.querySelectorAll('.calendar .day.available,.calendar .day.blank-open').forEach(d=>d.addEventListener('click',()=>d.classList.toggle('selected')));
  bindUser();
  const r=new URLSearchParams(location.search).get('role'), sel=document.querySelector('#registerForm [name=role]');
  if(sel && r==='host') sel.value='host';
}

/* ---------- boot ---------- */
document.addEventListener('DOMContentLoaded',async()=>{
  try{
    if(redirecting) return;
    ensureDemoAdmin(); ensureSampleHosts(); seedStore();
    initShell(); renderChrome();
    initSearch(); initAttractionList(); initStayPage(); initAttractionPage();
    initHostListings(); initHostEdit(); initHostDashboard(); initHostBookings(); initHostPayments(); initHostAvailability(); initTouristBookings();
    initAdminListings(); initAdminAttractions(); initAdminUsers(); initAdminDashboard();
    bindTabs(); initDateInputs(); initProfile();
    initBookingFlow(); initFavourites(); bindPreviews(); initPhotoUpload(); bindForms(); bindMisc();
    const m=consumeFlash(); if(m) setTimeout(()=>showToast(m),120);
  } finally { reveal(); }
});
})();
