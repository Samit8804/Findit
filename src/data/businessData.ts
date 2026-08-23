export interface BusinessReview {
  author: string;
  rating: number;
  date: string;
  text: string;
}

export interface Business {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription: string;
  logoText: string;
  cover: string;
  gallery: string[];
  verified: boolean;
  rating: number;
  reviewCount: number;
  location: string;
  citySlug: string;
  category: string;
  website: string;
  whatsapp: string;
  phone: string;
  hours: { days: string; time: string }[];
  services: { name: string; price: string; description: string }[];
  products: { name: string; price: string; image: string }[];
  reviews: BusinessReview[];
  promoted?: boolean;
  featured?: boolean;
}

export const businesses: Business[] = [
  {
    id: 'biz-1',
    slug: 'apex-modular-kitchens',
    name: 'Apex Modular Kitchens & Interiors',
    description:
      'German-engineered modular kitchens, wardrobes and luxury home woodwork with a 10-year warranty.',
    longDescription:
      'Apex has been transforming homes since 2012 with precision German hardware, marine-grade plywood and in-house design consultation. From concept to installation, our 40-person team delivers turnkey interiors for apartments, villas and offices across Delhi NCR.',
    logoText: 'A',
    cover:
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800',
    ],
    verified: true,
    rating: 4.8,
    reviewCount: 320,
    location: 'Sector 18, Noida',
    citySlug: 'noida',
    category: 'Home & Garden',
    website: 'apexkitchens.example.com',
    whatsapp: '+91 98100 11111',
    phone: '+91 98100 11111',
    hours: [
      { days: 'Monday – Saturday', time: '10:00 AM – 8:00 PM' },
      { days: 'Sunday', time: '11:00 AM – 5:00 PM' },
    ],
    services: [
      { name: 'Modular Kitchen Design & Build', price: 'From ₹1.2L', description: 'End-to-end kitchen design with German fittings.' },
      { name: 'Wardrobe & Storage Solutions', price: 'From ₹45K', description: 'Custom sliding and hinged wardrobes.' },
      { name: 'Full Home Interiors', price: 'On quote', description: 'Turnkey interior packages for 2/3 BHK homes.' },
    ],
    products: [
      { name: 'Lacquered Gloss Kitchen', price: '₹2.4L', image: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&q=80&w=600' },
      { name: 'Walnut Finish Wardrobe', price: '₹85K', image: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&q=80&w=600' },
      { name: 'Quartz Countertop', price: '₹38K', image: 'https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?auto=format&fit=crop&q=80&w=600' },
    ],
    reviews: [
      { author: 'Rohit Malhotra', rating: 5, date: 'Jul 2026', text: 'Fantastic finish and on-time delivery. The soft-close hardware feels premium.' },
      { author: 'Anita Desai', rating: 4, date: 'May 2026', text: 'Great designs. Slight delay in shutter delivery but overall very happy.' },
      { author: 'Sandeep Rathi', rating: 5, date: 'Mar 2026', text: 'Best modular kitchen experience in Noida. Highly recommended.' },
    ],
    promoted: true,
    featured: true,
  },
  {
    id: 'biz-2',
    slug: 'elite-supercars-studio',
    name: 'Elite Supercars & Luxury Car Studio',
    description:
      'Certified pre-owned Mercedes, BMW, Audi and Porsche with full inspection reports and finance options.',
    longDescription:
      'Elite Supercars is an authorized multi-brand luxury car showroom on MG Road offering certified pre-owned vehicles, exchange programs, in-house finance and doorstep test drives. Every car passes a 210-point inspection before listing.',
    logoText: 'E',
    cover:
      'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&q=80&w=800',
    ],
    verified: true,
    rating: 4.9,
    reviewCount: 512,
    location: 'MG Road, Gurgaon',
    citySlug: 'gurgaon',
    category: 'Vehicles & Motoring',
    website: 'elitesupercars.example.com',
    whatsapp: '+91 98100 22222',
    phone: '+91 98100 22222',
    hours: [
      { days: 'All Days', time: '10:00 AM – 9:00 PM' },
    ],
    services: [
      { name: 'Certified Pre-Owned Sales', price: 'Varies', description: '210-point inspected luxury cars.' },
      { name: 'In-House Finance & Lease', price: 'From 7.9% p.a.', description: 'Quick approvals with top banks.' },
      { name: 'Exchange Evaluation', price: 'Free', description: 'Instant valuation of your current car.' },
    ],
    products: [
      { name: 'BMW 530i M-Sport (2023)', price: '₹62L', image: 'https://images.unsplash.com/photo-1556189250-72ba954cfc2b?auto=format&fit=crop&q=80&w=600' },
      { name: 'Mercedes GLC 220d', price: '₹58L', image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&q=80&w=600' },
      { name: 'Audi Q7 Technology', price: '₹71L', image: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=600' },
    ],
    reviews: [
      { author: 'Kabir Sethi', rating: 5, date: 'Jun 2026', text: 'Bought a CPO BMW — flawless condition and transparent pricing.' },
      { author: 'Neha Kapoor', rating: 5, date: 'Apr 2026', text: 'Smooth finance process, car delivered within a week.' },
    ],
    promoted: true,
    featured: true,
  },
  {
    id: 'biz-3',
    slug: 'techcare-repair-hub',
    name: 'TechCare Multi-Brand Laptop & Phone Hub',
    description:
      'Genuine-parts repairs, motherboard specialists and express 1-hour doorstep service.',
    longDescription:
      'TechCare repairs all major laptop and smartphone brands using genuine spares. Our motherboard-level lab handles chip-level repairs most service centers refuse, with a 90-day service warranty.',
    logoText: 'T',
    cover:
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1200',
    gallery: [
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&q=80&w=800',
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=800',
    ],
    verified: true,
    rating: 4.7,
    reviewCount: 284,
    location: 'Connaught Place, Delhi',
    citySlug: 'delhi',
    category: 'Services',
    website: 'techcarehub.example.com',
    whatsapp: '+91 98100 33333',
    phone: '+91 98100 33333',
    hours: [
      { days: 'Monday – Saturday', time: '11:00 AM – 8:30 PM' },
      { days: 'Sunday', time: 'Closed' },
    ],
    services: [
      { name: 'Screen & Battery Replacement', price: 'From ₹1,499', description: 'Genuine parts, 90-day warranty.' },
      { name: 'Chip-Level Motherboard Repair', price: 'From ₹2,999', description: 'Advanced lab diagnostics.' },
      { name: 'Data Recovery', price: 'From ₹3,500', description: 'HDD / SSD / phone storage recovery.' },
    ],
    products: [
      { name: 'Refurbished ThinkPad T14', price: '₹32K', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&q=80&w=600' },
      { name: 'Certified Pre-Owned iPhone 13', price: '₹41K', image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=600' },
    ],
    reviews: [
      { author: 'Vivek Anand', rating: 5, date: 'Jul 2026', text: 'Fixed my water-damaged MacBook when Apple quoted a full replacement.' },
      { author: 'Pooja Nair', rating: 4, date: 'Feb 2026', text: 'Quick battery swap at a fair price.' },
    ],
    promoted: true,
  },
];

export const businessCategories = [
  'Interior Design',
  'Automotive',
  'Electronics Repair',
  'Real Estate',
  'Healthcare',
  'Education',
  'Events & Wedding',
  'Travel',
];