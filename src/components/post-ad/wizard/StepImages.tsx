'use client';

import React, { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UploadCloud,
  Trash2,
  Star,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';

interface ImageItem {
  src: string;
  name: string;
  progress: number; // 0-100
}

interface StepImagesProps {
  images: ImageItem[];
  onChange: (images: ImageItem[]) => void;
}

export const StepImages: React.FC<StepImagesProps> = ({ images, onChange }) => {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep a live ref so async callbacks always mutate the freshest list.
  const listRef = useRef<ImageItem[]>(images);
  listRef.current = images;

  const setList = useCallback(
    (updater: (prev: ImageItem[]) => ImageItem[]) => {
      const next = updater(listRef.current);
      listRef.current = next;
      onChange(next);
    },
    [onChange]
  );

  const startFakeUpload = useCallback((src: string) => {
    const timer = setInterval(() => {
      const current = listRef.current.find((i) => i.src === src);
      if (!current || current.progress >= 100) {
        clearInterval(timer);
        return;
      }
      setList((prev) =>
        prev.map((i) => (i.src === src ? { ...i, progress: Math.min(i.progress + 20, 100) } : i))
      );
    }, 150);
  }, [setList]);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (list.length === 0) {
        setError('Please select image files only.');
        return;
      }
      setError('');
      for (const file of list) {
        if (listRef.current.length >= 8) {
          setError('Maximum of 8 photos allowed.');
          break;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          const item: ImageItem = { src: ev.target?.result as string, name: file.name, progress: 0 };
          setList((prev) => [...prev, item]);
          setTimeout(() => startFakeUpload(item.src), 120);
        };
        reader.readAsDataURL(file);
      }
    },
    [setList, startFakeUpload]
  );

  const removeImage = (idx: number) => {
    onChange(images.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const setPrimary = (idx: number) => {
    const next = [...images];
    const [item] = next.splice(idx, 1);
    onChange([item, ...next]);
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-[#0F172A] mb-1">Add photos</h3>
      <p className="text-xs text-slate-400 mb-5">
        Up to 8 photos. The first image becomes your cover — drag files in or use the button.
      </p>

      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload images"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
          dragOver ? 'border-[#E53935] bg-red-50/50' : 'border-slate-200 hover:border-[#E53935] hover:bg-red-50/30'
        }`}
      >
        <motion.div animate={dragOver ? { scale: 1.08 } : { scale: 1 }} className="flex flex-col items-center gap-2 pointer-events-none">
          <UploadCloud className="w-9 h-9 text-slate-400" />
          <p className="text-xs font-medium text-slate-500">
            Drag &amp; drop images here, or{' '}
            <span className="text-[#E53935] font-semibold">browse</span>
          </p>
        </motion.div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-[#D32F2F] font-medium mt-2 flex items-center gap-1">
          <ImageIcon className="w-3.5 h-3.5" /> {error}
        </p>
      )}

      {/* Previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          {images.map((img, idx) => (
            <motion.div
              key={`${img.name}-${idx}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`relative aspect-square rounded-xl overflow-hidden border group ${
                idx === 0 ? 'ring-2 ring-[#E53935] ring-offset-2 border-transparent' : 'border-slate-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={`Photo ${idx + 1}: ${img.name}`} className="w-full h-full object-cover" />

              {/* progress overlay */}
              {img.progress < 100 ? (
                <div className="absolute inset-0 bg-black/55 backdrop-blur-xs flex flex-col items-center justify-center gap-2 px-3">
                  <div className="w-full h-1.5 bg-white/25 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#E53935] rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${img.progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-white">{Math.min(img.progress, 100)}%</span>
                </div>
              ) : null}

              {/* controls */}
              {img.progress >= 100 && (
                <div className="absolute inset-x-0 bottom-0 p-1.5 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-0.5">
                    <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move left"
                      className="p-1 rounded-md text-white hover:bg-white/20 disabled:opacity-30">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => move(idx, 1)} disabled={idx === images.length - 1} aria-label="Move right"
                      className="p-1 rounded-md text-white hover:bg-white/20 disabled:opacity-30">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <button type="button" onClick={() => setPrimary(idx)} disabled={idx === 0} aria-label="Set as primary"
                      className="p-1 rounded-md text-amber-300 hover:bg-white/20 disabled:opacity-30">
                      <Star className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => removeImage(idx)} aria-label="Delete photo"
                      className="p-1 rounded-md text-red-300 hover:bg-white/20">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {idx === 0 && img.progress >= 100 && (
                <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-[#E53935] text-white text-[10px] font-bold rounded-md">
                  Primary
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};