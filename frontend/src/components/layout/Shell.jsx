import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const link = ({ isActive }) => `text-sm ${isActive ? 'font-semibold text-ink' : 'text-gray-500 hover:text-ink'}`;

export default function Shell() {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
          <img src="/logo.png" alt="Logic Loops" className="h-7 w-7 rounded-full object-cover" />
          <span>Logic Loops</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-4">
          <NavLink to="/estimates" className={link}>Estimates</NavLink>
          <NavLink to="/pricing" className={link}>Pricing</NavLink>
          <NavLink to="/settings" className={link}>Business</NavLink>
          <span className="hidden text-xs text-gray-400 sm:inline">{user?.name}</span>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-ink">Sign out</button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-32 sm:px-6"><Outlet /></main>
    </div>
  );
}
