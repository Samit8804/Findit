'use client';

import React from 'react';
import {
  CircleCheck,
  Clock3,
  Tag,
  Archive,
  XCircle,
  CalendarClock,
  Pencil,
  Trash2,
  Power,
  Share2,
  MapPin,
  Eye,
  Rocket,
} from 'lucide-react';
import { StoredAd, AdStatus } from '@/lib/adStore';

const STATUS_STYLES: Record<AdStatus, { classes: string; icon: React.ElementType }> = {
  Active: { classes: 'bg-emerald-50 text-emerald-700', icon: CircleCheck },
  Pending: { classes: 'bg-amber-50 text-amber-700', icon: Clock3 },
  'Pending Review': { classes: 'bg-amber-50 text-amber-700', icon: Clock3 },
  Rejected: { classes: 'bg-red-50 text-[#D32F2F]', icon: XCircle },
  Expired: { classes: 'bg-slate-100 text-slate-600', icon: CalendarClock },
  Sold: { classes: 'bg-sky-50 text-sky-700', icon: Tag },
  Archived: { classes: 'bg-slate-100 text-slate-600', icon: Archive },
};

export function StatusBadge({ status }: { status: AdStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.Pending;
  const Icon = s.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${s.classes}`}
    >
      <Icon className="w-3.5 h-3.5" /> {status}
    </span>
  );
}

interface AdCardProps {
  ad: StoredAd;
  onEdit: (ad: StoredAd) => void;
  onDelete: (ad: StoredAd) => void;
  onToggle?: (ad: StoredAd) => void;
  onShare: (ad: StoredAd) => void;
  onBoost?: (ad: StoredAd) => void;
  onMarkSold?: (ad: StoredAd) => void;
}

export const AdCard: React.FC<AdCardProps> = ({ ad, onEdit, onDelete, onShare, onBoost, onMarkSold }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg transition-shadow overflow-hidden flex flex-col">
      {/* Image */}
      <div className="relative aspect-[16/9] bg-slate-100 overflow-hidden">
        {ad.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.images[0]} alt={ad.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <Tag className="w-10 h-10" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <StatusBadge status={ad.status} />
        </div>
        {ad.images.length > 1 && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/55 backdrop-blur-sm text-white text-[10px] font-semibold">
            {ad.images.length} photos
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-grow">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#E53935] mb-1">
          {ad.categoryName} · {ad.subcategoryName}
        </p>
        <h3 className="font-bold text-sm text-[#0F172A] line-clamp-2 leading-snug">{ad.title}</h3>

        <div className="flex items-center gap-3 mt-2 mb-1">
          {ad.price !== null && ad.price > 0 && (
            <span className="text-xl font-black text-[#0F172A]">
              ₹{ad.price.toLocaleString('en-IN')}
            </span>
          )}
          <span className="text-xs text-slate-400 capitalize">{ad.condition.replace(/_/g, ' ')}</span>
        </div>

        <p className="text-xs text-slate-500 flex items-center gap-1 mt-auto pt-3">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {[ad.city, ad.addressText].filter(Boolean).join(' — ') || 'Location not set'}
        </p>

        <p className="text-[11px] text-slate-400 mt-1 pb-4 border-b border-slate-100">
          Posted {new Date(ad.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>

        {/* Quick actions */}
        <div className="grid grid-cols-6 gap-1.5 pt-4">
          <a
            href={`/ad/${ad.id}`}
            title="View ad"
            className="flex flex-col items-center gap-1 px-1 py-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-[#E53935] text-slate-600 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span className="text-[9px] font-semibold">View</span>
          </a>
          <button onClick={() => onEdit(ad)} title="Edit ad"
            className="flex flex-col items-center gap-1 px-1 py-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-[#E53935] text-slate-600 transition-colors">
            <Pencil className="w-4 h-4" />
            <span className="text-[9px] font-semibold">Edit</span>
          </button>
          <button onClick={() => onBoost?.(ad)} title="Boost / Promote"            className="flex flex-col items-center gap-1 px-1 py-2 rounded-xl bg-red-50 text-[#E53935] hover:bg-[#E53935] hover:text-white transition-colors">
            <Rocket className="w-4 h-4" />
            <span className="text-[9px] font-semibold">Boost</span>
          </button>
          <button onClick={() => onMarkSold?.(ad)} title="Mark as sold"
            disabled={ad.status === 'Sold'}
            className="flex flex-col items-center gap-1 px-1 py-2 rounded-xl bg-slate-50 hover:bg-sky-50 hover:text-sky-700 text-slate-600 disabled:opacity-40 transition-colors">
            <Tag className="w-4 h-4" />
            <span className="text-[9px] font-semibold">Sold</span>
          </button>
          <button onClick={() => onDelete(ad)} title="Delete ad"
            className="flex flex-col items-center gap-1 px-1 py-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-[#D32F2F] text-slate-600 transition-colors">
            <Trash2 className="w-4 h-4" />
            <span className="text-[9px] font-semibold">Delete</span>
          </button>
          <button onClick={() => onShare(ad)} title="Share ad"
            className="flex flex-col items-center gap-1 px-1 py-2 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-[#E53935] text-slate-600 transition-colors">
            <Share2 className="w-4 h-4" />
            <span className="text-[9px] font-semibold">Share</span>
          </button>
        </div>
      </div>
    </div>
  );
};