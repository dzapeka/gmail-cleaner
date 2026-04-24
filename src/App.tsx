import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ViewProvider } from './context/ViewContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { LoginPage } from './components/LoginPage';
import { MainLayout } from './components/MainLayout';

function AppContent() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? (
    <DataProvider>
      <PreferencesProvider>
        <ViewProvider>
          <MainLayout />
        </ViewProvider>
      </PreferencesProvider>
    </DataProvider>
  ) : (
    <LoginPage />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
