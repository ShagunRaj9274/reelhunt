import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import { ToastProvider } from './context/Toast';
import { WishlistActionsProvider } from './context/WishlistActions';
import { Layout } from './components/Layout';
import { RouteError } from './components/RouteError';
import DiscoverPage from './pages/DiscoverPage';
import './styles/index.css';

// Discover is the landing page, so it ships in the main bundle; the rest are code-split.
const MovieDetailsPage = lazy(() => import('./pages/MovieDetailsPage'));
const WishlistPage = lazy(() => import('./pages/WishlistPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const page = (el) => <Suspense fallback={<div className="page-pad route-loading" aria-busy="true" />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <DiscoverPage /> },
      { path: '/movie/:id', element: page(<MovieDetailsPage />) },
      { path: '/wishlist', element: page(<WishlistPage />) },
      { path: '*', element: page(<NotFoundPage />) },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <WishlistActionsProvider>
          <RouterProvider router={router} />
        </WishlistActionsProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
