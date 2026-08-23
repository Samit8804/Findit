import React from 'react';
import { PackageOpen } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No listings found',
  description = 'Try adjusting your search filters or check back later for new ads.',
  actionLabel = 'Reset Filters',
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-100 shadow-sm my-8">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-[#E53935] mb-4">
        <PackageOpen className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-bold text-[#0F172A] mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mb-6">{description}</p>
      {onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
