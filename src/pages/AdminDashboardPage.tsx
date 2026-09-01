import { Boxes, Building2, ClipboardList, PackageOpen, ScanSearch, Send, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingState, MetricTile, PageHeader } from '../components/ui';
import { useRequirements } from '../hooks/useRequirements';
import { getFriendlyDataError, getPendingProducts } from '../services/dataService';

export const AdminDashboardPage = () => {
  const { requirements, loading, error } = useRequirements('all');
  const [pending, setPending] = useState(0);
  const [pendingError, setPendingError] = useState('');

  useEffect(() => {
    void getPendingProducts()
      .then((products) => { setPending(products.length); setPendingError(''); })
      .catch((loadError) => setPendingError(getFriendlyDataError(loadError)));
  }, []);

  if (loading) return <LoadingState label="Loading dashboard" />;
  if (error) return <ErrorState message={error} />;

  const required = requirements.filter((row) => row.status === 'required').length;
  const toSend = requirements.filter((row) => row.status === 'to_send').length;
  const incoming = requirements.filter((row) => row.status === 'incoming').length;

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Live operations" title="Dashboard" />
      <div className="metric-grid">
        <Link to="/required"><MetricTile icon={<ClipboardList size={22} />} value={required} label="Required" /></Link>
        <Link to="/to-send"><MetricTile icon={<Send size={22} />} value={toSend} label="To Send" /></Link>
        <Link to="/incoming"><MetricTile icon={<PackageOpen size={22} />} value={incoming} label="Incoming" /></Link>
        <Link to="/product-review"><MetricTile icon={<ScanSearch size={22} />} value={pending} label="Pending Review" /></Link>
      </div>
      {pendingError ? <p className="inline-alert">Product review count: {pendingError}</p> : null}
      <section className="quick-actions-section">
        <h2>Admin work</h2>
        <div className="quick-actions">
          <Link to="/company-orders"><span><Building2 size={21} /></span><div><strong>Company Orders</strong><small>{required} products awaiting fulfilment</small></div></Link>
          <Link to="/products"><span><Boxes size={21} /></span><div><strong>Product Catalogue</strong><small>Edit, approve, merge or deactivate</small></div></Link>
          <Link to="/product-review"><span><ScanSearch size={21} /></span><div><strong>Product Review</strong><small>{pending} products waiting for approval</small></div></Link>
          <Link to="/companies"><span><Building2 size={21} /></span><div><strong>Companies</strong><small>Manage supplier companies</small></div></Link>
          <Link to="/users"><span><Users size={21} /></span><div><strong>Users</strong><small>Manage staff access</small></div></Link>
        </div>
      </section>
    </div>
  );
};
