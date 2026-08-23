export interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: 'Active' | 'Suspended' | 'Banned';
  verified: boolean;
  totalAds: number;
  joinedAt: string;
}

export const adminUsers: AdminUser[] = [
  { id: 'u-1', name: 'Rohit Sharma', email: 'rohit@example.com', status: 'Active', verified: true, totalAds: 14, joinedAt: 'Mar 2024' },
  { id: 'u-2', name: 'Priya Sen', email: 'priya@example.com', status: 'Active', verified: false, totalAds: 3, joinedAt: 'Feb 2026' },
  { id: 'u-3', name: 'Vikram Malhotra', email: 'vikram@example.com', status: 'Active', verified: true, totalAds: 9, joinedAt: 'Nov 2023' },
  { id: 'u-4', name: 'Spam Bot 3000', email: 'bot3000@spam.io', status: 'Banned', verified: false, totalAds: 87, joinedAt: 'Aug 2026' },
  { id: 'u-5', name: 'Karan Verma', email: 'karan@example.com', status: 'Suspended', verified: true, totalAds: 5, joinedAt: 'Sep 2024' },
  { id: 'u-6', name: 'Anita Desai', email: 'anita@example.com', status: 'Active', verified: true, totalAds: 21, joinedAt: 'Jan 2022' },
];

export interface AdminAd {
  id: string;
  title: string;
  image: string;
  seller: string;
  category: string;
  location: string;
  status: 'Pending' | 'Active' | 'Rejected' | 'Reported' | 'Expired';
  date: string;
  price: number;
  description: string;
}

export const adminAds: AdminAd[] = [
  { id: 'adm-1', title: 'Luxury 3 BHK Apartment Sector 150', image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=200', seller: 'Apex Real Estate', category: 'Property', location: 'Noida', status: 'Pending', date: '22 Aug 2026', price: 14500000, description: 'Fully furnished 3 BHK with modular kitchen, park facing balcony and 2 parking slots near metro.' },
  { id: 'adm-2', title: 'iPhone 15 Pro Max 256GB', image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=200', seller: 'Rohit Sharma', category: 'For Sale', location: 'Delhi', status: 'Active', date: '20 Aug 2026', price: 119999, description: 'Battery health 99%, bill and box available, warranty till late 2027.' },
  { id: 'adm-3', title: 'Cheap Followers Instant Delivery', image: '', seller: 'Spam Bot 3000', category: 'Other', location: 'Unknown', status: 'Reported', date: '21 Aug 2026', price: 99, description: 'Get 10k followers for just 99 rupees. DM now. Limited offer.' },
  { id: 'adm-4', title: 'Honda City ZX CVT 2022', image: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&q=80&w=200', seller: 'Vikram Malhotra', category: 'Vehicles & Motoring', location: 'Gurgaon', status: 'Active', date: '18 Aug 2026', price: 1250000, description: 'Single owner, 24k km, full service record, ADAS safety pack.' },
  { id: 'adm-5', title: 'Royal Enfield Interceptor 650', image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&q=80&w=200', seller: 'Karan Verma', category: 'Vehicles & Motoring', location: 'Ghaziabad', status: 'Rejected', date: '15 Aug 2026', price: 275000, description: 'Photos show different bike than registration papers — needs re-upload.' },
  { id: 'adm-6', title: 'Velvet L-Shaped Sofa Set', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=200', seller: 'Priya Sen', category: 'Home & Garden', location: 'Greater Noida', status: 'Expired', date: '01 Aug 2026', price: 32000, description: 'Navy blue velvet 6-seater with glass center table. Moving out sale.' },
];

export interface AdminReport {
  id: string;
  adTitle: string;
  reporter: string;
  reason: string;
  details: string;
  date: string;
}

export const adminReports: AdminReport[] = [
  { id: 'rpt-1', adTitle: 'Cheap Followers Instant Delivery', reporter: 'Anita Desai', reason: 'Spam', details: 'Obvious bot spam posted 40 times across categories.', date: '22 Aug 2026' },
  { id: 'rpt-2', adTitle: 'iPhone 13 Pro Sealed Box Rs 19,999', reporter: 'Kabir Sethi', reason: 'Scam', details: 'Seller asks for advance UPI before meeting. Classic scam pattern.', date: '21 Aug 2026' },
  { id: 'rpt-3', adTitle: 'Sony Bravia OLED Duplicate', reporter: 'Manish Kumar', reason: 'Duplicate', details: 'Same TV listed 5 times with slightly different prices.', date: '20 Aug 2026' },
  { id: 'rpt-4', adTitle: 'Puppies for Adoption No Papers', reporter: 'Neha Kapoor', reason: 'Prohibited Content', details: 'Seller is selling protected breed without license documents.', date: '19 Aug 2026' },
  { id: 'rpt-5', adTitle: '2 BHK location mismatch', reporter: 'Sandeep Rathi', reason: 'Wrong Category', details: 'Location on listing does not match actual property.', date: '18 Aug 2026' },
];