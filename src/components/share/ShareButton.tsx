'use client';

import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { ShareModal } from './ShareModal';

interface ShareButtonProps {
  title: string;
  url?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  title,
  url,
  variant = 'outline',
  size = 'md',
  className = '',
}) => {
  const [open, setOpen] = useState(false);

  const shareUrl =
    url || (typeof window !== 'undefined' ? window.location.href : 'https://findit.example');

  return (
    <>
      <Button variant={variant} size={size} className={`gap-2 ${className}`} onClick={() => setOpen(true)}>
        <Share2 className="w-4 h-4" /> Share
      </Button>
      <ShareModal open={open} onClose={() => setOpen(false)} title={title} url={shareUrl} />
    </>
  );
};