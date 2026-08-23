-- ============================================================
-- FindIt — Seed data: categories + locations
-- Run AFTER 0001_ads_system.sql. Idempotent.
-- ============================================================

-- ---------- CATEGORIES ----------
insert into public.categories (name, slug, icon, parent_id, sort_order)
select v.name, v.slug, v.icon, null::uuid, v.ord
from (values
  ('Digital Items','digital-items','Cpu',1),
  ('Community','community','Users',2),
  ('Services','services','Wrench',3),
  ('Entertainment','entertainment','Tv',4),
  ('For Sale','for-sale','ShoppingBag',5),
  ('Property','property','Home',6),
  ('Tickets','tickets','Ticket',7),
  ('Pets and Livestock','pets-and-livestock','Heart',8),
  ('Jobs','jobs','Briefcase',9),
  ('Personals','personals','UserCheck',10),
  ('Vehicles & Motoring','vehicles-and-motoring','Car',11)
) as v(name,slug,icon,ord)
where not exists (select 1 from public.categories c where c.slug = v.slug and c.parent_id is null);

-- Subcategories (root_slug -> subcategory)
insert into public.categories (name, slug, parent_id, sort_order)
select s.name, s.slug, r.id, s.ord
from (values
  ('digital-items','Websites','websites',1),('digital-items','eBooks','ebooks',2),('digital-items','Website Scripts','website-scripts',3),('digital-items','Software','software',4),('digital-items','Other','digital-other',5),
  ('community','Activities','activities',1),('community','Announcements','announcements',2),('community','Local News','local-news',3),('community','Lost and Found','lost-and-found',4),('community','Politics','politics',5),('community','Public Service','public-service',6),('community','Recreation','recreation',7),('community','Obituary','obituary',8),('community','Volunteer','volunteer',9),('community','Online','community-online',10),('community','Garage/Car Boot Sales','garage-sales',11),('community','Museums','museums',12),
  ('services','Hair & Beauty','hair-beauty',1),('services','Chiropractic','chiropractic',2),('services','Dental','dental',3),('services','Medical','medical',4),('services','Financial','financial',5),('services','Legal','legal',6),('services','Work From Home','work-from-home',7),('services','Self Improvement','self-improvement',8),('services','IT','it-services',9),('services','Online Services','online-services',10),('services','Motors','motors-services',11),('services','Other','services-other',12),('services','Health & Fitness','health-fitness',13),('services','DIY','diy',14),('services','Photography','photography-services',15),('services','Employment','employment-services',16),('services','Gardening/Landscape','gardening-landscape',17),('services','AC & Heating','ac-heating',18),('services','Building/Remodeling/Extensions','building-remodeling',19),('services','Carpentry/Joinery','carpentry-joinery',20),('services','Decorating','decorating',21),('services','Plastering/Cementing','plastering-cementing',22),('services','Childcare','childcare',23),('services','Cleaning/Home Chores','cleaning-home-chores',24),('services','Electrical','electrical-services',25),('services','Removals/Packing','removals-packing',26),('services','Plumbing/Pools','plumbing-pools',27),('services','Roofing/Tiling','roofing-tiling',28),('services','Telecommunications','telecom-services',29),('services','Offline Marketing','offline-marketing',30),('services','Printing','printing-services',31),
  ('entertainment','Movies & TV','movies-tv',1),('entertainment','Sporting Goods & Accessories','sporting-goods',2),('entertainment','Music & Instruments','music-instruments',3),('entertainment','Literature','literature',4),('entertainment','Clubs','clubs',5),('entertainment','Board Games','board-games',6),('entertainment','Video Games','video-games',7),('entertainment','Photographers - Cameraman','photographers-cameraman',8),('entertainment','Games Consoles','games-consoles',9),('entertainment','Downloads/Online Gaming','downloads-online-gaming',10),
  ('for-sale','Antiques/Collectibles','antiques-collectibles',1),('for-sale','Clothing, Shoes & Accessories','clothing-shoes-accessories',2),('for-sale','Appliances','appliances',3),('for-sale','Art/Crafts','art-crafts',4),('for-sale','Bicycles','bicycles',5),('for-sale','School & College','school-college',6),('for-sale','Business/Industrial','fs-business-industrial',7),('for-sale','Photography','fs-photography',8),('for-sale','Phones','phones',9),('for-sale','Electrical','electrical-goods',10),('for-sale','Free/Recycle/Exchange','free-recycle-exchange',11),('for-sale','Furniture','furniture',12),('for-sale','Toys','toys',13),('for-sale','Babies & Children','babies-children',14),('for-sale','Gardening','gardening-supplies',15),('for-sale','Food & Supplies','food-supplies',16),('for-sale','Confectionery','confectionery',17),('for-sale','Gifts & Gadgets','gifts-gadgets',18),
  ('property','Acreage/Farms','acreage-farms',1),('property','Business/Industrial','prop-business-industrial',2),('property','Domestic Rentals','domestic-rentals',3),('property','Roommates/Houseshare','roommates-houseshare',4),('property','Holiday Homes','holiday-homes',5),('property','Homes For Sale','homes-for-sale',6),('property','Holiday Rentals','holiday-rentals',7),('property','Student Accommodation','student-accommodation',8),
  ('tickets','Sport','ticket-sport',1),('tickets','Shows','shows-tickets',2),('tickets','Travel','ticket-travel',3),('tickets','Theatre & Ballet','theatre-ballet',4),('tickets','Discounts/Coupons','discounts-coupons',5),('tickets','Cinema','cinema-tickets',6),
  ('pets-and-livestock','Dogs','dogs',1),('pets-and-livestock','Cats','cats',2),('pets-and-livestock','Horses','horses',3),('pets-and-livestock','Exotic Pets','exotic-pets',4),('pets-and-livestock','Farm Livestock','farm-livestock',5),('pets-and-livestock','Free','pets-free',6),('pets-and-livestock','Other','pets-other',7),('pets-and-livestock','Food & Supplies','pet-food-supplies',8),('pets-and-livestock','Accessories','pet-accessories',9),
  ('jobs','Admin/Clerical','admin-clerical',1),('jobs','Automotive','job-automotive',2),('jobs','Banking/Finance','banking-finance-jobs',3),('jobs','Bar/Hotel/Guesthouse','bar-hotel',4),('jobs','IT','job-it',5),('jobs','Business Development','business-development',6),('jobs','Online Business Opportunities','online-biz-opp',7),('jobs','Construction','construction-jobs',8),('jobs','Consultant','consultant',9),('jobs','Customer Service','customer-service-jobs',10),('jobs','Design','design-jobs',11),('jobs','Shipping & Distribution','shipping-distribution',12),('jobs','Education','education-jobs',13),('jobs','Engineering','engineering-jobs',14),('jobs','Entry Level','entry-level',15),('jobs','Executive','executive',16),('jobs','Facilities','facilities',17),('jobs','Franchise','franchise',18),('jobs','General Business','general-business',19),('jobs','General Labor','general-labor',20),('jobs','Government','government-jobs',21),('jobs','Grocery','grocery',22),('jobs','Health, Medical & Fitness','health-medical-fitness',23),('jobs','Human Resources','human-resources',24),('jobs','Installation','installation',25),('jobs','Maintenance & Repair','maintenance-repair',26),('jobs','Insurance','insurance',27),('jobs','Management','management',28),('jobs','Manufacturing','manufacturing',29),('jobs','Sales & Marketing','sales-marketing',30),('jobs','Media','media',31),('jobs','Non-Profit','non-profit',32),('jobs','Real Estate','real-estate-jobs',33),('jobs','Restaurant/Food/Bakery','restaurant-food',34),('jobs','Retail','retail',35),('jobs','Fashion','fashion-jobs',36),('jobs','Science','science',37),('jobs','Skilled Labour','skilled-labour',38),('jobs','Supplies','job-supplies',39),('jobs','Import/Export','import-export',40),('jobs','Telecommunications','telecom-jobs',41),('jobs','Motoring/Transportation','motoring-transportation',42),('jobs','Veterinary','veterinary',43),('jobs','Warehouse/Storage','warehouse-storage',44),('jobs','Travel','travel-jobs',45),
  ('personals','Loans','loans',1),('personals','Penpals','penpals',2),('personals','Fashion Designers - Stylists','fashion-designers',3),('personals','Casual','casual',4),('personals','Services','personal-services',5),
  ('vehicles-and-motoring','Airplanes/Accessories','airplanes',1),('vehicles-and-motoring','All Terrain Vehicles','atv',2),('vehicles-and-motoring','Boats','boats',3),('vehicles-and-motoring','Cars','cars',4),('vehicles-and-motoring','Motorcycles','motorcycles',5),('vehicles-and-motoring','Trucks','trucks',6),('vehicles-and-motoring','Lorries','lorries',7),('vehicles-and-motoring','Vans','vans',8),('vehicles-and-motoring','Parts','vehicle-parts',9),('vehicles-and-motoring','Tyres','tyres',10),('vehicles-and-motoring','Accessories','vehicle-accessories',11),('vehicles-and-motoring','Quad Bikes','quad-bikes',12),('vehicles-and-motoring','Maps','maps',13),('vehicles-and-motoring','Sat Navs','sat-navs',14)
) as s(root, name, slug, ord)
join public.categories r on r.slug = s.root and r.parent_id is null
where not exists (select 1 from public.categories c where c.slug = s.slug);

-- ---------- LOCATIONS ----------
-- Countries
insert into public.locations (level, name, slug, parent_id)
select 'country', v.name, v.slug, null::uuid
from (values ('India','india'),('United States','united-states'),('United Kingdom','united-kingdom'),('United Arab Emirates','united-arab-emirates')) as v(name,slug)
where not exists (select 1 from public.locations l where l.level='country' and l.slug=v.slug);

-- Indian states / UTs (core set used across the app; extend anytime)
insert into public.locations (level, name, slug, parent_id)
select 'state', s.name, s.slug, c.id
from (values
  ('Delhi','delhi','india'),
  ('Uttar Pradesh','uttar-pradesh','india'),
  ('Haryana','haryana','india'),
  ('Maharashtra','maharashtra','india'),
  ('Karnataka','karnataka','india')
) as s(name,slug,country)
join public.locations c on c.level='country' and c.slug=s.country
where not exists (select 1 from public.locations l where l.level='state' and l.slug=s.slug);

-- Cities
insert into public.locations (level, name, slug, parent_id)
select 'city', ct.name, ct.slug, st.id
from (values
  ('Noida','noida','uttar-pradesh'),
  ('Greater Noida','greater-noida','uttar-pradesh'),
  ('Ghaziabad','ghaziabad','uttar-pradesh'),
  ('New Delhi','new-delhi','delhi'),
  ('Gurgaon','gurgaon','haryana'),
  ('Mumbai','mumbai','maharashtra'),
  ('Pune','pune','maharashtra'),
  ('Bangalore','bangalore','karnataka')
) as ct(name,slug,state)
join public.locations st on st.level='state' and st.slug=ct.state
where not exists (select 1 from public.locations l where l.level='city' and l.slug=ct.slug);

-- Localities (sample for NCR cities)
insert into public.locations (level, name, slug, parent_id)
select 'locality', loc.name, loc.slug, city.id
from (values
  ('Sector 62','sector-62','noida'),
  ('Sector 150','sector-150-noida','noida'),
  ('Sector 18','sector-18-noida','noida'),
  ('Alpha 1','alpha-1-gnoida','greater-noida'),
  ('Pari Chowk','pari-chowk','greater-noida'),
  ('Connaught Place','connaught-place','new-delhi'),
  ('Saket','saket','new-delhi'),
  ('MG Road','mg-road-gurgaon','gurgaon'),
  ('DLF Phase 3','dlf-phase-3','gurgaon'),
  ('Vaishali','vaishali','ghaziabad')
) as loc(name,slug,city)
join public.locations city on city.level='city' and city.slug=loc.city
where not exists (select 1 from public.locations l where l.parent_id = city.id and l.slug=loc.slug);