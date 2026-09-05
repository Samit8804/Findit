export interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: 'Active' | 'Suspended' | 'Banned';
  verified: boolean;
  totalAds: number;
  joinedAt: string;
}

export const adminUsers: AdminUser[] = [];

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

export const adminAds: AdminAd[] = [];

export interface AdminReport {
  id: string;
  adTitle: string;
  reporter: string;
  reason: string;
  details: string;
  date: string;
}

export const adminReports: AdminReport[] = [];
