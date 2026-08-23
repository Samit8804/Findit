export type Condition = 'new' | 'used_like_new' | 'used_good' | 'used_fair';
export type PromotionPlan = 'free' | 'featured' | 'top';

export interface ExtraField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
}

export interface WizardCategory {
  name: string;
  icon: string;
  fields: ExtraField[];
}

export const WIZARD_CATEGORIES: WizardCategory[] = [
  {
    name: 'Property',
    icon: 'Home',
    fields: [
      { key: 'bedrooms', label: 'Bedrooms', type: 'select', options: ['1', '2', '3', '4', '5+'] },
      { key: 'bathrooms', label: 'Bathrooms', type: 'select', options: ['1', '2', '3', '4+'] },
      { key: 'area', label: 'Area (sq ft)', type: 'number' },
      { key: 'furnished', label: 'Furnishing', type: 'select', options: ['Unfurnished', 'Semi-Furnished', 'Fully Furnished'] },
    ],
  },
  {
    name: 'Vehicle',
    icon: 'Car',
    fields: [
      { key: 'brand', label: 'Brand', type: 'text' },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'year', label: 'Year of Manufacture', type: 'number' },
      { key: 'kmDriven', label: 'KM Driven', type: 'number' },
      { key: 'fuel', label: 'Fuel Type', type: 'select', options: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'] },
    ],
  },
  {
    name: 'Mobile',
    icon: 'Smartphone',
    fields: [
      { key: 'brand', label: 'Brand', type: 'text' },
      { key: 'model', label: 'Model', type: 'text' },
      { key: 'storage', label: 'Storage', type: 'select', options: ['32 GB', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB'] },
      { key: 'warranty', label: 'Warranty Remaining', type: 'text' },
    ],
  },
  {
    name: 'Electronics',
    icon: 'Tv',
    fields: [
      { key: 'brand', label: 'Brand', type: 'text' },
      { key: 'warranty', label: 'Warranty Remaining', type: 'text' },
      { key: 'accessories', label: 'Accessories Included', type: 'text' },
    ],
  },
  {
    name: 'Home & Garden',
    icon: 'Armchair',
    fields: [
      { key: 'material', label: 'Material', type: 'text' },
      { key: 'dimensions', label: 'Dimensions (L×W×H)', type: 'text' },
      { key: 'ageYears', label: 'Age (years)', type: 'number' },
    ],
  },
  {
    name: 'Jobs',
    icon: 'Briefcase',
    fields: [
      { key: 'company', label: 'Company Name', type: 'text' },
      { key: 'jobType', label: 'Job Type', type: 'select', options: ['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Work From Home'] },
      { key: 'salaryRange', label: 'Salary Range (monthly)', type: 'text' },
      { key: 'experience', label: 'Experience Required', type: 'text' },
    ],
  },
  {
    name: 'Services',
    icon: 'Wrench',
    fields: [
      { key: 'serviceArea', label: 'Service Area', type: 'text' },
      { key: 'experience', label: 'Years of Experience', type: 'number' },
      { key: 'availability', label: 'Availability', type: 'select', options: ['Weekdays', 'Weekends', 'All Days', 'On Call'] },
    ],
  },
  {
    name: 'Business',
    icon: 'Store',
    fields: [
      { key: 'businessType', label: 'Business Type', type: 'text' },
      { key: 'employees', label: 'Employees', type: 'number' },
      { key: 'establishedYear', label: 'Established Year', type: 'number' },
    ],
  },
  {
    name: 'Other',
    icon: 'PackageSearch',
    fields: [],
  },
];

export interface WizardContactPrefs {
  showPhone: boolean;
  showEmail: boolean;
  allowWhatsApp: boolean;
}

export interface WizardData {
  category: string;
  title: string;
  description: string;
  price: string;
  condition: Condition;
  extra: Record<string, string>;
  images: { src: string; name: string; progress: number }[];
  location: { countryIso: string; stateIso: string; city: string };
  locality: string;
  address: string;
  contactPrefs: WizardContactPrefs;
  promotion: PromotionPlan;
}

export const INITIAL_WIZARD: WizardData = {
  category: '',
  title: '',
  description: '',
  price: '',
  condition: 'used_good',
  extra: {},
  images: [],
  location: { countryIso: '', stateIso: '', city: '' },
  locality: '',
  address: '',
  contactPrefs: { showPhone: true, showEmail: true, allowWhatsApp: true },
  promotion: 'free',
};