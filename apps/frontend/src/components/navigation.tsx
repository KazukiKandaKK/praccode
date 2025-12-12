'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Code2, BookOpen, BarChart3, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { logout } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

interface NavigationProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Navigation({ user }: NavigationProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const links = [
    { href: '/dashboard', label: 'ダッシュボード', icon: BarChart3 },
    { href: '/exercises', label: '学習', icon: BookOpen },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <Code2 className="w-8 h-8 text-cyan-400" />
            <span className="text-xl font-bold text-white">PracCode</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'text-cyan-400 bg-cyan-500/10'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="hidden md:flex items-center gap-4">
            <div className="text-sm text-slate-400">
              {user.name || user.email}
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            </form>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-slate-900 border-b border-slate-800">
          <div className="px-4 py-4 space-y-2">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'text-cyan-400 bg-cyan-500/10'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}
            <div className="pt-2 border-t border-slate-800">
              <div className="px-4 py-2 text-sm text-slate-400">{user.name || user.email}</div>
              <form action={logout}>
                <button
                  type="submit"
                  className="flex items-center gap-3 w-full px-4 py-3 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

