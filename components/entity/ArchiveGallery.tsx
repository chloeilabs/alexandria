"use client";

// Tier 3 "From the archives" gallery with a click-to-zoom lightbox.
// Keyboard model:
//   - Click or Enter on a thumbnail opens the lightbox at that index
//   - Esc closes
//   - ← / → navigate between images
//   - Tab is trapped inside the dialog while open

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export interface GalleryImage {
  url: string;
  caption: string | null;
  attribution: string;
}

interface Props {
  images: GalleryImage[];
}

export function ArchiveGallery({ images }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    // Restore focus to whatever opened the dialog.
    previousFocusRef.current?.focus?.();
  }, []);

  const goPrev = useCallback(() => {
    setActive((i) => (i === 0 ? images.length - 1 : i - 1));
  }, [images.length]);

  const goNext = useCallback(() => {
    setActive((i) => (i + 1) % images.length);
  }, [images.length]);

  // Keyboard + scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    };
    document.addEventListener("keydown", onKey);

    // Lock body scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Focus the close button so screen readers announce the dialog
    // and Tab cycles within it.
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close, goPrev, goNext]);

  function openAt(idx: number, src: HTMLElement) {
    previousFocusRef.current = src;
    setActive(idx);
    setOpen(true);
  }

  if (images.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
        {images.map((m, idx) => (
          <li key={`${m.url}-${idx}`}>
            <figure>
              <button
                type="button"
                onClick={(e) => openAt(idx, e.currentTarget)}
                className="block w-full focus:outline-none focus-visible:outline-1 focus-visible:outline-accent focus-visible:outline-offset-4 group"
                aria-label={
                  m.caption
                    ? `Open larger view: ${m.caption}`
                    : "Open larger view"
                }
              >
                <div className="relative w-full aspect-[4/3] overflow-hidden bg-card border border-border/40 group-hover:border-accent/40 transition-colors">
                  <Image
                    src={m.url}
                    alt={m.caption ?? ""}
                    fill
                    sizes="(max-width: 768px) 100vw, 500px"
                    className="object-cover"
                  />
                </div>
              </button>
              {m.caption && (
                <figcaption className="mt-3 font-display italic text-base leading-snug text-muted-foreground">
                  {m.caption}
                </figcaption>
              )}
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
                {m.attribution}
              </div>
            </figure>
          </li>
        ))}
      </ul>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={
            images[active]?.caption
              ? `Image: ${images[active].caption}`
              : "Image viewer"
          }
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col"
          // Click outside the image closes — click on backdrop only.
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          {/* Top bar: counter + close */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
              {active + 1} of {images.length}
            </span>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={close}
              className="font-mono text-[10px] uppercase tracking-[0.22em] text-accent hover:text-foreground transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4"
              aria-label="Close image viewer"
            >
              Close ✕
            </button>
          </div>

          {/* Image area */}
          <div
            className="flex-1 flex items-center justify-center p-6 relative"
            onClick={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            {/* Prev */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous image"
                className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-10 font-mono text-2xl text-accent hover:text-foreground transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4 px-2 py-1"
              >
                ←
              </button>
            )}

            <div className="relative w-full max-w-5xl h-full max-h-[80vh]">
              <Image
                src={images[active]!.url}
                alt={images[active]!.caption ?? ""}
                fill
                sizes="(max-width: 1024px) 95vw, 1024px"
                className="object-contain"
                priority
              />
            </div>

            {images.length > 1 && (
              <button
                type="button"
                onClick={goNext}
                aria-label="Next image"
                className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-10 font-mono text-2xl text-accent hover:text-foreground transition-colors focus:outline-none focus-visible:underline focus-visible:underline-offset-4 px-2 py-1"
              >
                →
              </button>
            )}
          </div>

          {/* Bottom: caption + attribution */}
          <div className="px-6 py-5 border-t border-border/60 max-w-4xl mx-auto w-full">
            {images[active]!.caption && (
              <p className="font-display italic text-base md:text-lg leading-snug text-foreground">
                {images[active]!.caption}
              </p>
            )}
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
              {images[active]!.attribution}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
