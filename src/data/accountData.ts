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

export const demoAds: DemoAd[] = [];
// REMOVED: Fake demo ads - production uses real ads table

export const dashboardStats = [] as const;
// REMOVED: Fake stats - use real getDashboardStats

export const performanceData = { labels: [], series: { views: [], enquiries: [], favorites: [] } };
// REMOVED: Fake performance - use real chart data

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

export const conversations: Conversation[] = [];
// REMOVED: Fake conversations - use real conversations table

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

export const notifications: NotificationItem[] = [];
// REMOVED: Fake notifications

export interface PaymentRecord {
  orderId: string;
  adTitle: string;
  promotion: string;
  amount: number;
  date: string;
  status: 'Success' | 'Pending' | 'Failed';
}

export const payments: PaymentRecord[] = [];
// REMOVED: Fake payments

export const favoriteListings: any[] = [];
// REMOVED: Fake favorites