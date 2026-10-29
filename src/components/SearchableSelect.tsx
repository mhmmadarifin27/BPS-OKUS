'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  sub?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | number | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

/**
 * Dropdown pilihan dengan kotak pencarian (combobox).
 * Memakai positioning "fixed" dari rect tombol agar daftar hasil
 * tidak terpotong container modal yang punya overflow scroll.
 */
export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih...',
  searchPlaceholder = 'Cari...',
  emptyMessage = 'Tidak ada data yang cocok',
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    openUp: boolean;
  } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => String(o.value) === String(value));

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(o => `${o.label} ${o.sub || ''}`.toLowerCase().includes(q))
    : options;

  const computePos = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const desired = 260;
    const openUp = spaceBelow < Math.min(desired, 200) && spaceAbove > spaceBelow;
    const maxH = Math.max(140, Math.min(desired, openUp ? spaceAbove : spaceBelow));
    setMenuStyle({
      top: openUp ? r.top - 6 : r.bottom + 6,
      left: r.left,
      width: r.width,
      maxHeight: maxH,
      openUp,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePos();

    const onScrollOrResize = () => computePos();
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, computePos]);

  useEffect(() => {
    if (open) {
      setQuery('');
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [open]);

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <button
        type="button"
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="input text-xs font-medium text-left w-full flex items-center justify-between gap-2 cursor-pointer"
      >
        <span
          className={cn(
            'truncate',
            selected ? 'text-dark-800' : 'text-dark-400'
          )}
        >
          {selected
            ? selected.sub
              ? `${selected.label} (${selected.sub})`
              : selected.label
            : placeholder}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-dark-400 shrink-0 transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && menuStyle && (
        <div
          ref={menuRef}
          className="fixed z-[70] bg-white border border-dark-200 rounded-xl shadow-xl animate-fade-in flex flex-col"
          style={{
            top: menuStyle.openUp ? undefined : menuStyle.top,
            bottom: menuStyle.openUp
              ? window.innerHeight - menuStyle.top
              : undefined,
            left: menuStyle.left,
            width: menuStyle.width,
            maxHeight: menuStyle.maxHeight,
          }}
        >
          {/* Kotak pencarian */}
          <div className="relative border-b border-dark-100 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-300 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') {
                  setOpen(false);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  const first = filtered[0];
                  if (first) {
                    onChange(String(first.value));
                    setOpen(false);
                  }
                }
              }}
              placeholder={searchPlaceholder}
              className="input pl-9 text-xs py-2 rounded-none border-0 focus:ring-0"
              autoFocus
            />
          </div>

          {/* Daftar hasil */}
          <div className="overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="text-center text-xs text-dark-400 py-4 px-3">
                {emptyMessage}
              </p>
            ) : (
              filtered.map(o => {
                const isActive = String(o.value) === String(value);
                return (
                  <button
                    type="button"
                    key={String(o.value)}
                    onClick={() => {
                      onChange(String(o.value));
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition-colors',
                      isActive
                        ? 'bg-bps-blue-50'
                        : 'hover:bg-dark-50'
                    )}
                  >
                    <span
                      className={cn(
                        'text-xs truncate',
                        isActive ? 'font-bold text-bps-blue' : 'font-medium text-dark-700'
                      )}
                    >
                      {o.label}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {o.sub && (
                        <span className="text-[10px] text-dark-400 whitespace-nowrap">
                          {o.sub}
                        </span>
                      )}
                      {isActive && <Check className="w-3.5 h-3.5 text-bps-blue shrink-0" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
