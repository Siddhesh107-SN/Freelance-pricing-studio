import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/common/Toast.jsx';
import { Spinner } from './components/common/ui.jsx';
import Shell from './components/layout/Shell.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import BusinessSettings from './pages/BusinessSettings.jsx';
import EstimateFlow from './pages/EstimateFlow.jsx';
import Login from './pages/Login.jsx';
import PreviousEstimates from './pages/PreviousEstimates.jsx';
import PricingSettings from './pages/PricingSettings.jsx';
import Welcome from './pages/Welcome.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Protected><Shell /></Protected>}>
            <Route path="/" element={<Welcome />} />
            <Route path="/estimate/new" element={<EstimateFlow />} />
            <Route path="/estimate/:id" element={<EstimateFlow />} />
            <Route path="/estimates" element={<PreviousEstimates />} />
            <Route path="/pricing" element={<PricingSettings />} />
            <Route path="/settings" element={<BusinessSettings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
