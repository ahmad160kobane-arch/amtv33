import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export default function Logo({ className = "h-8 md:h-10", showText = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Cinematic Icon Mark */}
      <svg viewBox="0 0 40 40" className="h-full max-w-[40px] w-auto flex-shrink-0 drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFCC00" /> {/* Bright Gold */}
            <stop offset="100%" stopColor="#E69500" /> {/* Deep Gold */}
          </linearGradient>
          <linearGradient id="popGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFECB3" />
            <stop offset="100%" stopColor="#FFFFFF" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Glow backdrop for night mode pop */}
        <rect width="36" height="36" x="2" y="2" rx="10" fill="url(#brandGrad)" filter="url(#glow)" className="opacity-0 dark:opacity-60" />
        
        {/* Sharp App Icon Base */}
        <rect width="40" height="40" rx="10" fill="url(#brandGrad)" />
        
        {/* Inner Abstract Lens/Play Button Layout */}
        <path d="M 0 12 C 0 12, 10 12, 12 0" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
        
        {/* Solid Play/Triangle (forms the inner A motif) */}
        <path d="M 14 11.5 L 30 19.5 L 14 27.5 Z" fill="url(#popGrad)" />
        
        {/* Elegant top dot giving an active 'Live' broadcast feel */}
        <circle cx="30" cy="11" r="3" fill="#ffffff" filter="url(#glow)" />
      </svg>
      
      {/* Wordmark */}
      {showText && (
        <div className="flex flex-col items-start justify-center translate-y-[2px]">
          <span className="text-[26px] font-black tracking-widest text-light-text dark:text-dark-text leading-none uppercase">
            AM
          </span>
          <span className="text-[10px] font-bold text-brand-primary tracking-[0.35em] uppercase leading-none mt-1 opacity-90 drop-shadow-sm ml-0.5">
            Streaming
          </span>
        </div>
      )}
    </div>
  );
}
