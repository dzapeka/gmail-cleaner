import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ViewProvider } from './context/ViewContext';
import { LoginPage } from './components/LoginPage';
import { MainLayout } from './components/MainLayout';

function AppContent() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? (
    <DataProvider>
      <ViewProvider>
        <MainLayout />
      </ViewProvider>
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
