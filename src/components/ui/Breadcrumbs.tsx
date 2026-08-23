import React from 'react';
import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="flex items-center space-x-2 text-sm text-slate-500 py-4">
      <Link href="/" className="hover:text-[#E53935] flex items-center transition-colors">
        <Home className="w-4 h-4" />
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            {isLast || !item.href ? (
              <span className="text-[#0F172A] font-medium truncate max-w-[200px] md:max-w-xs">
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="hover:text-[#E53935] transition-colors truncate max-w-[150px] md:max-w-xs">
                {item.label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
