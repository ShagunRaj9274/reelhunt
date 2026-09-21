import { Link } from 'react-router';
import { EmptyState } from '../components/StatusStates';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="page-pad">
      <EmptyState title="This page doesn't exist" action={<Link to="/" className="btn btn--primary">Browse movies</Link>}>
        <p>Check the address, or head back to discovering movies.</p>
      </EmptyState>
    </div>
  );
}
