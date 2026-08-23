export interface AdminBusinessRow {
  slug: string;
  name: string;
  owner: string;
  category: string;
  location: string;
  verified: boolean;
  listings: number;
  subscription: string;
  status: 'Active' | 'Pending Review' | 'Suspended';
}

export const adminBusinesses: AdminBusinessRow[] = [
  { slug: 'apex-modular-kitchens', name: 'Apex Modular Kitchens & Interiors', owner: 'Aarav Kapoor', category: 'Home & Garden', location: 'Noida', verified: true, listings: 24, subscription: 'BUSINESS PRO', status: 'Active' },
  { slug: 'elite-supercars-studio', name: 'Elite Supercars & Luxury Car Studio', owner: 'Rehan Merchant', category: 'Vehicles & Motoring', location: 'Gurgaon', verified: true, listings: 41, subscription: 'BUSINESS PRO', status: 'Active' },
  { slug: 'techcare-repair-hub', name: 'TechCare Laptop & Phone Hub', owner: 'Farah Qureshi', category: 'Services', location: 'Delhi', verified: true, listings: 12, subscription: 'BUSINESS', status: 'Active' },
  { slug: 'greenvalley-nursery', name: 'GreenValley Nursery & Landscaping', owner: 'Sunil Yadav', category: 'Home & Garden', location: 'Greater Noida', verified: false, listings: 7, subscription: 'FREE', status: 'Pending Review' },
  { slug: 'quickfix-plumbing', name: 'QuickFix Plumbing Services', owner: 'Ramesh Pillai', category: 'Services', location: 'Ghaziabad', verified: false, listings: 2, subscription: 'FREE', status: 'Suspended' },
];

export interface AdminPayment {
  orderId: string;
  user: string;
  advertisement: string;
  amount: number;
  method: 'UPI' | 'Card' | 'NetBanking';
  status: 'Success' | 'Pending' | 'Failed' | 'Refunded';
  date: string;
}

export const adminPayments: AdminPayment[] = [
  { orderId: 'FND-ORD-8841', user: 'Demo User', advertisement: 'Luxury 3 BHK Apartment', amount: 117, method: 'UPI', status: 'Success', date: '20 Aug 2026' },
  { orderId: 'FND-ORD-8610', user: 'Aarav Kapoor', advertisement: 'Modular Kitchen Showcase', amount: 235, method: 'Card', status: 'Success', date: '15 Aug 2026' },
  { orderId: 'FND-ORD-8422', user: 'Farah Qureshi', advertisement: 'Repair Services Promo', amount: 58, method: 'UPI', status: 'Success', date: '09 Aug 2026' },
  { orderId: 'FND-ORD-8399', user: 'Priya Sen', advertisement: 'Sofa Set Featured', amount: 117, method: 'Card', status: 'Refunded', date: '01 Aug 2026' },
  { orderId: 'FND-ORD-8920', user: 'Rehan Merchant', advertisement: 'Showroom TOP Listing', amount: 235, method: 'NetBanking', status: 'Pending', date: '22 Aug 2026' },
  { orderId: 'FND-ORD-8300', user: 'Spam Bot 3000', advertisement: 'Bulk Ad Boost x40', amount: 1960, method: 'UPI', status: 'Failed', date: '28 Jul 2026' },
];

export interface PromotionConfig {
  id: string;
  name: string;
  price: number;
  duration: string;
  benefits: string[];
  active: boolean;
}

export const promotionConfigs: PromotionConfig[] = [
  { id: 'boost', name: 'Boost', price: 49, duration: '3 days', benefits: ['Category top slot', 'Small visibility lift'], active: true },
  { id: 'featured', name: 'Featured', price: 99, duration: '7 days', benefits: ['Featured badge', 'Priority search placement', '3x more views'], active: true },
  { id: 'top', name: 'Top Listing', price: 199, duration: '30 days', benefits: ['Homepage spotlight', 'TOP badge + gold border', 'Highest ranking'], active: true },
  { id: 'business', name: 'Business Plan', price: 499, duration: 'per month', benefits: ['Directory profile', 'Verified badge', '10 featured ads/mo'], active: true },
  { id: 'business-pro', name: 'Business Pro Plan', price: 999, duration: 'per month', benefits: ['Unlimited featured ads', 'Banner rotation', 'Account manager'], active: false },
];

export interface Campaign {
  id: string;
  advertiser: string;
  bannerText: string;
  destination: string;
  placement: 'Homepage' | 'Category' | 'Location' | 'Listing' | 'Business';
  start: string;
  end: string;
  price: number;
  status: 'Active' | 'Scheduled' | 'Ended';
  impressions: number;
  clicks: number;
}

export const campaigns: Campaign[] = [
  { id: 'cmp-1', advertiser: 'Elite Supercars Studio', bannerText: 'Certified Luxury Cars — MG Road', destination: '/business/elite-supercars-studio', placement: 'Homepage', start: '15 Aug 2026', end: '15 Sep 2026', price: 4999, status: 'Active', impressions: 128400, clicks: 3412 },
  { id: 'cmp-2', advertiser: 'Apex Modular Kitchens', bannerText: 'Modular Kitchens from ₹1.2L', destination: '/business/apex-modular-kitchens', placement: 'Category', start: '10 Aug 2026', end: '10 Oct 2026', price: 2999, status: 'Active', impressions: 84200, clicks: 1980 },
  { id: 'cmp-3', advertiser: 'City Mall Noida', bannerText: 'Weekend Sale — Flat 50% Off', destination: '#', placement: 'Location', start: '01 Sep 2026', end: '01 Oct 2026', price: 1999, status: 'Scheduled', impressions: 0, clicks: 0 },
  { id: 'cmp-4', advertiser: 'TechCare Hub', bannerText: '1-Hour Doorstep Repair', destination: '/business/techcare-repair-hub', placement: 'Listing', start: '01 Jun 2026', end: '30 Jun 2026', price: 1499, status: 'Ended', impressions: 45600, clicks: 1122 },
];

export const recentActivity = [
  { icon: 'UserPlus', text: 'New user registered — priya@example.com', time: '5 min ago', color: 'text-sky-600 bg-sky-50' },
  { icon: 'Layers', text: 'Ad "iPhone 15 Pro Max" approved automatically', time: '18 min ago', color: 'text-emerald-600 bg-emerald-50' },
  { icon: 'Flag', text: 'Report received on "Cheap Followers" (Spam)', time: '32 min ago', color: 'text-[#E53935] bg-red-50' },
  { icon: 'Wallet', text: 'Payment FND-ORD-8841 completed — ₹117', time: '1 hour ago', color: 'text-violet-600 bg-violet-50' },
  { icon: 'Rocket', text: 'FEATURED promotion activated for Demo User', time: '1 hour ago', color: 'text-amber-600 bg-amber-50' },
  { icon: 'Building2', text: 'GreenValley Nursery submitted verification docs', time: '2 hours ago', color: 'text-slate-600 bg-slate-100' },
];