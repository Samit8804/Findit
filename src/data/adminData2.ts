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

export const adminBusinesses: AdminBusinessRow[] = [];
// REMOVED: Fake businesses - use real business_profiles

export interface AdminPayment {
  orderId: string;
  user: string;
  advertisement: string;
  amount: number;
  method: 'UPI' | 'Card' | 'NetBanking';
  status: 'Success' | 'Pending' | 'Failed' | 'Refunded';
  date: string;
}

export const adminPayments: AdminPayment[] = [];
// REMOVED: Fake payments - use real orders

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

export const campaigns: Campaign[] = [];
// REMOVED: Fake campaigns

export const recentActivity: any[] = [];
// REMOVED: Fake activity - use real admin_audit_logs