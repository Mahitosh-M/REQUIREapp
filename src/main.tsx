import { Capacitor } from '@capacitor/core';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { App } from './App';
import { ToastProvider } from './components/ui';
import { AuthProvider } from './context/AuthContext';
import { CatalogueProvider } from './context/CatalogueContext';
import './styles.css';

const AppRouter = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppRouter>
    <AuthProvider>
      <CatalogueProvider>
        <ToastProvider><App /></ToastProvider>
      </CatalogueProvider>
    </AuthProvider>
  </AppRouter>
);

if (!Capacitor.isNativePlatform() && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').then((registration) => registration.update());
  });
}
