import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext.jsx';
import { Button } from '@/components/ui/button';
import { Menu, X, LogOut, Trophy, LayoutDashboard, House } from 'lucide-react';

const Header = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdminPage = location.pathname.startsWith('/admin');

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[hsl(var(--brasil-green))]/95 text-white shadow-[0_10px_35px_hsl(var(--brasil-green)/0.22)] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-[72px] items-center justify-between">
          <Link to="/" className="group flex items-center gap-3">
            <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-secondary text-secondary-foreground shadow-[0_8px_20px_hsl(var(--secondary)/0.25)] transition-transform group-hover:-rotate-3 group-hover:scale-105">
              <Trophy className="h-5 w-5" />
              <span className="absolute -bottom-3 -right-3 h-7 w-7 rounded-full bg-white/35" />
            </div>
            <div>
              <span className="block font-[Manrope] text-lg font-extrabold leading-tight tracking-tight">Bolão do Brasil</span>
              <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">Brasil x Marrocos</span>
            </div>
          </Link>

          <nav className="hidden items-center gap-2 md:flex">
            <Link
              to="/"
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                location.pathname === '/' ? 'bg-white/12 text-secondary' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <House className="h-4 w-4" />
              Início
            </Link>
            {isAuthenticated && (
              <Link
                to="/admin"
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  isAdminPage ? 'bg-white/12 text-secondary' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                Painel
              </Link>
            )}
            {isAuthenticated && isAdminPage && (
              <Button onClick={handleLogout} variant="secondary" size="sm" className="ml-2">
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            )}
          </nav>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-xl border border-white/10 bg-white/10 p-2.5 transition-colors hover:bg-white/15 md:hidden"
            aria-label="Abrir menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <nav className="space-y-2 border-t border-white/10 py-4 md:hidden">
            <Link to="/" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 font-bold">
              <House className="h-4 w-4" /> Início
            </Link>
            {isAuthenticated && (
              <Link to="/admin" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 font-bold">
                <LayoutDashboard className="h-4 w-4" /> Painel administrativo
              </Link>
            )}
            {isAuthenticated && isAdminPage && <Button onClick={handleLogout} variant="secondary" className="w-full"><LogOut /> Sair</Button>}
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
