export interface DemoAd {
  id: string;
  title: string;
  image: string;
  price: number;
  status: 'Active' | 'Pending' | 'Rejected' | 'Expired' | 'Sold';
  views: number;
  enquiries: number;
  createdAt: string;
  expiresAt: string;
  category: string;
  location: string;
}

export const demoAds: DemoAd[] = [
  {
    id: 'demo-1',
    title: 'Luxury 3 BHK Apartment with Modern Interior in Sector 150',
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=400',
    price: 14500000,
    status: 'Active',
    views: 3420,
    enquiries: 47,
    createdAt: '12 Aug 2026',
    expiresAt: '10 Sep 2026',
    category: 'Property',
    location: 'Noida',
  },
  {
    id: 'demo-2',
    title: 'Apple iPhone 15 Pro Max - 256GB Natural Titanium',
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=400',
    price: 119999,
    status: 'Active',
    views: 1890,
    enquiries: 23,
    createdAt: '14 Aug 2026',
    expiresAt: '12 Sep 2026',
    category: 'For Sale',
    location: 'Delhi',
  },
  {
    id: 'demo-3',
    title: 'Royal Enfield Interceptor 650 - Mark Two Chrome',
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&q=80&w=400',
    price: 275000,
    status: 'Pending',
    views: 0,
    enquiries: 0,
    createdAt: '21 Aug 2026',
    expiresAt: '—',
    category: 'Vehicles & Motoring',
    location: 'Ghaziabad',
  },
  {
    id: 'demo-4',
    title: 'L-Shaped Premium Velvet Sofa Set with Center Table',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=400',
    price: 32000,
    status: 'Sold',
    views: 940,
    enquiries: 18,
    createdAt: '02 Aug 2026',
    expiresAt: 'Sold on 19 Aug',
    category: 'Home & Garden',
    location: 'Greater Noida',
  },
  {
    id: 'demo-5',
    title: 'Weekend Photography Services — Weddings & Events',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=400',
    price: 25000,
    status: 'Expired',
    views: 610,
    enquiries: 9,
    createdAt: '01 Jul 2026',
    expiresAt: '31 Jul 2026',
    category: 'Services',
    location: 'Delhi',
  },
];

export const dashboardStats = [
  { key: 'total', label: 'Total Ads', value: '24', icon: 'LayoutGrid', trend: '+3 this month', color: '#E53935' },
  { key: 'active', label: 'Active Ads', value: '18', icon: 'CircleCheck', trend: '+2 this week', color: '#059669' },
  { key: 'views', label: 'Total Views', value: '48.2K', icon: 'Eye', trend: '+12.4% vs last month', color: '#2563EB' },
  { key: 'enquiries', label: 'Enquiries', value: '316', icon: 'MessageSquare', trend: '+8.1% vs last month', color: '#7C3AED' },
  { key: 'favorites', label: 'Favorites', value: '1,204', icon: 'Heart', trend: '+5.6% vs last month', color: '#DB2777' },
  { key: 'spent', label: 'Amount Spent', value: '₹2,394', icon: 'Wallet', trend: 'Lifetime promotions', color: '#D97706' },
] as const;

export const performanceData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  series: {
    views: [420, 512, 480, 604, 720, 890, 812],
    enquiries: [22, 31, 26, 38, 45, 61, 52],
    favorites: [64, 78, 71, 92, 110, 148, 132],
  },
};

export interface ConversationMsg {
  from: 'me' | 'them';
  text: string;
  time: string;
}

export interface Conversation {
  id: string;
  name: string;
  avatarText: string;
  online: boolean;
  adRef: string;
  unread: number;
  lastTime: string;
  messages: ConversationMsg[];
}

export const conversations: Conversation[] = [
  {
    id: 'conv-1',
    name: 'Rohit Sharma',
    avatarText: 'RS',
    online: true,
    adRef: 'Luxury 3 BHK Apartment, Sector 150',
    unread: 2,
    lastTime: '10:42 AM',
    messages: [
      { from: 'them', text: 'Hi! Is the Sector 150 apartment still available?', time: '10:28 AM' },
      { from: 'me', text: 'Yes, it is. Would you like to schedule a site visit this weekend?', time: '10:33 AM' },
      { from: 'them', text: 'Saturday morning works. What is the exact tower number?', time: '10:40 AM' },
      { from: 'them', text: 'Also, is the club membership included in the price?', time: '10:42 AM' },
    ],
  },
  {
    id: 'conv-2',
    name: 'Priya Sen',
    avatarText: 'PS',
    online: true,
    adRef: 'Apple iPhone 15 Pro Max 256GB',
    unread: 0,
    lastTime: 'Yesterday',
    messages: [
      { from: 'them', text: 'Is the battery health still above 95%?', time: 'Yesterday' },
      { from: 'me', text: 'Yes, 99% with AppleCare till next year.', time: 'Yesterday' },
      { from: 'them', text: 'Perfect. Can we meet at a mall in Sector 18?', time: 'Yesterday' },
    ],
  },
  {
    id: 'conv-3',
    name: 'Karan Verma',
    avatarText: 'KV',
    online: false,
    adRef: 'Royal Enfield Interceptor 650',
    unread: 1,
    lastTime: 'Mon',
    messages: [
      { from: 'them', text: 'What is the last serviced odometer reading?', time: 'Mon' },
      { from: 'me', text: '11,800 km, fully documented.', time: 'Mon' },
      { from: 'them', text: 'Great, sending an offer shortly.', time: 'Mon' },
    ],
  },
];

export type NotificationType =
  | 'message'
  | 'approved'
  | 'rejected'
  | 'payment'
  | 'expiring'
  | 'promotion';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

export const notifications: NotificationItem[] = [
  { id: 'n1', type: 'message', title: 'New message from Rohit Sharma', body: 'Regarding "Luxury 3 BHK Apartment, Sector 150".', time: '10 min ago', unread: true },
  { id: 'n2', type: 'approved', title: 'Ad approved', body: '"iPhone 15 Pro Max" passed review and is now live.', time: '1 hour ago', unread: true },
  { id: 'n3', type: 'promotion', title: 'Promotion activated', body: 'FEATURED boost applied to your apartment listing for 7 days.', time: '3 hours ago', unread: true },
  { id: 'n4', type: 'payment', title: 'Payment successful', body: '₹99 paid for FEATURED promotion. Order FND-ORD-8841.', time: '3 hours ago', unread: false },
  { id: 'n5', type: 'expiring', title: 'Ad expiring soon', body: '"Photography Services" expired on 31 Jul. Renew to keep it live.', time: 'Yesterday', unread: false },
  { id: 'n6', type: 'rejected', title: 'Ad rejected', body: '"Used Office Chairs (x6)" needs better photos. Edit and resubmit.', time: '2 days ago', unread: false },
];

export interface PaymentRecord {
  orderId: string;
  adTitle: string;
  promotion: string;
  amount: number;
  date: string;
  status: 'Success' | 'Pending' | 'Failed';
}

export const payments: PaymentRecord[] = [
  { orderId: 'FND-ORD-8841', adTitle: 'Luxury 3 BHK Apartment', promotion: 'FEATURED · 7 days', amount: 99, date: '20 Aug 2026', status: 'Success' },
  { orderId: 'FND-ORD-8610', adTitle: 'iPhone 15 Pro Max', promotion: 'TOP LISTING · 30 days', amount: 199, date: '15 Aug 2026', status: 'Success' },
  { orderId: 'FND-ORD-8422', adTitle: 'Interior Design Services', promotion: 'BOOST · 3 days', amount: 49, date: '09 Aug 2026', status: 'Success' },
  { orderId: 'FND-ORD-8399', adTitle: 'Sofa Set — Moving Sale', promotion: 'FEATURED · 7 days', amount: 99, date: '01 Aug 2026', status: 'Failed' },
  { orderId: 'FND-ORD-8920', adTitle: 'Royal Enfield Interceptor 650', promotion: 'TOP LISTING · 30 days', amount: 199, date: '22 Aug 2026', status: 'Pending' },
];

export const favoriteListings = [
  {
    id: 'lst-3',
    title: 'Honda City ZX CVT Automatic - 2022 Model (Single Owner)',
    price: 1250000,
    image: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&q=80&w=600',
    location: 'Gurgaon, Haryana',
    seller: 'Vikram Malhotra',
    href: '/ad/lst-3-honda-city-zx-cvt-automatic---2022-model-single-owner',
  },
  {
    id: 'lst-8',
    title: 'Sony Bravia 65" 4K Ultra HD Smart OLED TV (XR-65A80L)',
    price: 189999,
    image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?auto=format&fit=crop&q=80&w=600',
    location: 'Noida, Uttar Pradesh',
    seller: 'Manish Kumar',
    href: '/ad/lst-8-sony-bravia-65-4k-ultra-hd-smart-oled-tv-xr-65a80l',
  },
  {
    id: 'lst-7',
    title: 'Royal Enfield Interceptor 650 - Mark Two Chrome - 2023',
    price: 275000,
    image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&q=80&w=600',
    location: 'Ghaziabad, Uttar Pradesh',
    seller: 'Karan Verma',
    href: '/ad/lst-7-royal-enfield-interceptor-650-mark-two-chrome-2023',
  },
];