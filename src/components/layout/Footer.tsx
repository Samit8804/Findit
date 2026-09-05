import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Globe,
  Share2,
  Compass,
  Video,
  ShieldCheck,
  Headphones,
  Award,
  HeartHandshake,
} from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-[#0F172A] text-slate-300 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Trust Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 mb-12 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-[#E53935] flex items-center justify-center shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-0.5">100% Free to Post</h4>
              <p className="text-xs text-slate-400">Post your ads easily without any hidden charges.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-0.5">Local Community</h4>
              <p className="text-xs text-slate-400">Connect with trusted buyers and sellers nearby.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-0.5">Verified Ads</h4>
              <p className="text-xs text-slate-400">Enhanced security checks for authentic listings.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-0.5">24/7 Support</h4>
              <p className="text-xs text-slate-400">Dedicated assistance anytime you need help.</p>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-12 mb-12 border-b border-slate-800">
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#E53935] flex items-center justify-center text-white font-black text-lg">
                F
              </div>
              <span className="text-xl font-black tracking-tight text-white">
                Find<span className="text-[#E53935]">It</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-6 max-w-sm leading-relaxed">
              FindIt is your ultimate modern classified advertisement marketplace. Buy, sell or discover properties, vehicles, electronics, jobs and services in your local area.
            </p>
            <div className="flex items-center gap-3">
              <span title="Social links coming soon" className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 cursor-not-allowed">
                <Globe className="w-4 h-4" />
              </span>
              <span title="Social links coming soon" className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 cursor-not-allowed">
                <Share2 className="w-4 h-4" />
              </span>
              <span title="Social links coming soon" className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 cursor-not-allowed">
                <Compass className="w-4 h-4" />
              </span>
              <span title="Social links coming soon" className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 cursor-not-allowed">
                <Video className="w-4 h-4" />
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-4">Marketplace</h4>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/browse" className="hover:text-white transition-colors">Properties</Link></li>
              <li><Link href="/browse" className="hover:text-white transition-colors">Vehicles</Link></li>
              <li><Link href="/browse" className="hover:text-white transition-colors">Mobiles</Link></li>
              <li><Link href="/browse" className="hover:text-white transition-colors">Electronics</Link></li>
              <li><Link href="/browse" className="hover:text-white transition-colors">Jobs & Services</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-4">Business</h4>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/pricing" className="hover:text-white transition-colors">Advertise with Us</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Promoted Listings</Link></li>
              <li><Link href="/business" className="hover:text-white transition-colors">Partner Program</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Enterprise Solutions</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-4">Support & Legal</h4>
            <ul className="space-y-2.5 text-xs">
              <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
              <li><Link href="/safety" className="hover:text-white transition-colors">Safety Tips</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/refund-policy" className="hover:text-white transition-colors">Refund Policy</Link></li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="flex flex-col md:flex-row items-center justify-between text-xs text-slate-500">
          <p>© 2026 FindIt Marketplace Inc. All rights reserved.</p>
          <p className="mt-2 md:mt-0">Crafted with precision for modern local commerce.</p>
        </div>
      </div>
    </footer>
  );
};
