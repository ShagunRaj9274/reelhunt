import { Outlet, ScrollRestoration } from 'react-router';
import { Header } from './Header';
import { Footer } from './Footer';
import { OfflineBanner } from './OfflineBanner';
import { BackToTop } from './BackToTop';

export function Layout() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <OfflineBanner />
      <main id="main" className="main">
        <Outlet />
      </main>
      <Footer />
      <BackToTop />
      {/* Restores the scroll position when going Back to a long list. */}
      <ScrollRestoration />
    </>
  );
}
