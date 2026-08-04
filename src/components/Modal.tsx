"use client";

import { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
}

export default function Modal({ open, onClose, children, maxWidthClass = "max-w-2xl" }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-10 sm:py-16">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <div className={`relative w-full ${maxWidthClass} max-h-[calc(100vh-5rem)] overflow-y-auto`}>
        {children}
      </div>
    </div>
  );
}
