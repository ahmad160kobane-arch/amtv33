import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import Navbar from '@/components/Navbar';
import OfflineBanner from '@/components/OfflineBanner';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';

const siteUrl = 'https://amlive.shop';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'AM Live',
      description: 'منصة AM Live — أفلام ومسلسلات عربية وعالمية حصرية',
      inLanguage: 'ar',
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${siteUrl}/allcontent?type=movie` },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'AM Live',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/icon-512.png`,
        width: 512,
        height: 512,
      },
      sameAs: [`${siteUrl}`],
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'AM Live — أفلام ومسلسلات عربية حصرية',
    template: '%s | AM Live',
  },
  description:
    'شاهد أحدث الأفلام والمسلسلات العربية والعالمية بجودة عالية على منصة AM Live. محتوى حصري ومميز، قنوات مباشرة، وترفيه بلا حدود — مجانًا.',
  keywords: [
    'أفلام عربية',
    'مسلسلات عربية',
    'أفلام اون لاين',
    'مشاهدة مسلسلات مجانا',
    'بث مباشر عربي',
    'أفلام 2025',
    'مسلسلات 2025',
    'منصة بث عربية',
    'مشاهدة مجانية',
    'أفلام حصرية',
    'مسلسلات حصرية',
    'قنوات عربية مباشرة',
    'افلام اجنبية مترجمة',
    'مسلسلات تركية مدبلجة',
    'arabic movies online',
    'arabic series streaming',
    'watch arabic movies free',
    'AM Live',
    'amlive.shop',
  ],
  authors: [{ name: 'AM Live', url: siteUrl }],
  creator: 'AM Live',
  publisher: 'AM Live',
  category: 'entertainment',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ar_AR',
    url: siteUrl,
    siteName: 'AM Live',
    title: 'AM Live — أفلام ومسلسلات عربية حصرية',
    description:
      'شاهد أحدث الأفلام والمسلسلات العربية والعالمية بجودة عالية على AM Live. محتوى حصري ومميز مجانًا.',
    images: [
      {
        url: `${siteUrl}/icon-512.png`,
        width: 512,
        height: 512,
        alt: 'AM Live — منصة الترفيه العربي',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AM Live — أفلام ومسلسلات عربية حصرية',
    description: 'شاهد أحدث الأفلام والمسلسلات العربية والعالمية بجودة عالية على AM Live.',
    images: [`${siteUrl}/icon-512.png`],
  },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'AM Live' },
  alternates: {
    canonical: siteUrl,
  },
};

export const viewport: Viewport = {
  themeColor: '#FFB800',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap" rel="stylesheet" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-tajawal bg-light-bg dark:bg-dark-bg text-light-text dark:text-dark-text min-h-screen">
        <ThemeProvider>
          <AuthProvider>
            <ServiceWorkerRegister />
            <OfflineBanner />
            <Navbar />
            <main className="pt-16">{children}</main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
