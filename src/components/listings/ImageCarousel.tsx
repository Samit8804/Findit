'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ImageCarouselProps {
  images: string[];
  alt: string;
  intervalMs?: number;
}

export const ImageCarousel: React.FC<ImageCarouselProps> = ({ images, alt, intervalMs = 3500 }) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || images.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [paused, images.length, intervalMs]);

  if (images.length === 0) return null;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[index]} alt={`${alt} — photo ${index + 1}`} className="w-full h-full object-cover" />
        </motion.div>
      </AnimatePresence>

      {images.length > 1 && (
        <>
          {/* Pagination dots */}
          <div className="absolute bottom-2.5 left-0 right-0 flex items-center justify-center gap-1.5 z-10">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setIndex(i);
                }}
                aria-label={`Go to photo ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>

          {/* Counter overlay */}
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/55 backdrop-blur-sm text-white text-[10px] font-semibold z-10">
            {index + 1}/{images.length}
          </div>
        </>
      )}
    </div>
  );
};