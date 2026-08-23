import React from 'react';
import Link from 'next/link';
import * as Icons from 'lucide-react';
import { Category } from '@/types';

interface CategoryCardProps {
  category: Category;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category }) => {
  // Dynamically resolve icon from lucide-react
  const IconComponent = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[category.icon] || Icons.Folder;

  return (
    <Link
      href={`/category/${category.slug}`}
      className="group bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-red-100 transition-all duration-300 flex flex-col items-center text-center cursor-pointer"
    >
      <div className="w-14 h-14 rounded-2xl bg-red-50 text-[#E53935] flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-[#E53935] group-hover:text-white transition-all duration-300">
        <IconComponent className="w-7 h-7" />
      </div>
      <h3 className="font-semibold text-[#0F172A] group-hover:text-[#E53935] transition-colors mb-1 text-base">
        {category.name}
      </h3>
      <p className="text-xs text-slate-400 font-medium">
        {category.listingCount.toLocaleString()} ads
      </p>
    </Link>
  );
};
