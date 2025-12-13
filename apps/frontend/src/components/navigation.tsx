'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Code2, BookOpen, BarChart3, LogOut, Menu, X, ClipboardList, Settings, ChevronDown, ChevronRight, PenTool, GraduationCap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { logout } from '@/app/actions/auth';
import { cn } from '@/lib/utils';

interface NavigationProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

interface SubMenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface MenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  children?: SubMenuItem[];
}

export function Navigation({ user }: NavigationProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const [expandedMobileMenus, setExpandedMobileMenus] = useState<Set<string>>(new Set());
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileDrawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!mobileDrawerRef.current) return;
      if (!mobileDrawerRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    if (mobileMenuOpen) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
    return;
  }, [mobileMenuOpen]);

  const menuItems: MenuItem[] = [
    { href: '/dashboard', label: 'ダッシュボード', icon: BarChart3 },
    {
      label: '学習',
      icon: GraduationCap,
      children: [
        { href: '/exercises', label: 'コードリーディング', icon: BookOpen },
        { href: '/writing', label: 'コードライティング', icon: PenTool },
      ],
    },
    {
      label: '学習結果',
      icon: ClipboardList,
      children: [
        { href: '/submissions', label: 'コードリーディング', icon: BookOpen },
        { href: '/writing/submissions', label: 'コードライティング', icon: PenTool },
      ],
    },
  ];

  const isMenuActive = (item: MenuItem): boolean => {
    if (item.href) {
      return pathname.startsWith(item.href);
    }
    if (item.children) {
      return item.children.some((child) => pathname.startsWith(child.href));
    }
    return false;
  };

  const toggleMobileMenu = (label: string) => {
    setExpandedMobileMenus((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  // Desktop Navigation Links
  const DesktopNavLinks = () => (
    <div className="space-y-1">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = isMenuActive(item);
        const hasChildren = item.children && item.children.length > 0;

        if (!hasChildren && item.href) {
          // Simple link without children
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                isActive ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        }

        // Menu with children (hover flyout)
        return (
          <div
            key={item.label}
            className="relative group"
            onMouseEnter={() => setHoveredMenu(item.label)}
            onMouseLeave={() => setHoveredMenu(null)}
          >
            <div
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer',
                isActive ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <ChevronRight className={cn('w-4 h-4 transition-transform', hoveredMenu === item.label && 'rotate-90')} />
            </div>

            {/* Flyout submenu with bridge area */}
            {hoveredMenu === item.label && item.children && (
              <>
                {/* Invisible bridge to prevent hover gap */}
                <div className="absolute left-full top-0 w-4 h-full" />
                <div className="absolute left-full top-0 ml-1 pt-0 z-50">
                  <div className="w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = pathname.startsWith(child.href);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 transition-colors',
                            isChildActive
                              ? 'text-cyan-400 bg-cyan-500/10'
                              : 'text-slate-300 hover:text-white hover:bg-slate-800'
                          )}
                        >
                          <ChildIcon className="w-4 h-4" />
                          <span className="text-sm">{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );

  // Mobile Navigation Links (accordion style)
  const MobileNavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="space-y-1">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = isMenuActive(item);
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedMobileMenus.has(item.label);

        if (!hasChildren && item.href) {
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors',
                isActive ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        }

        return (
          <div key={item.label}>
            <button
              type="button"
              onClick={() => toggleMobileMenu(item.label)}
              className={cn(
                'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-colors',
                isActive ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
            </button>

            {isExpanded && item.children && (
              <div className="ml-4 mt-1 space-y-1 border-l border-slate-700 pl-4">
                {item.children.map((child) => {
                  const ChildIcon = child.icon;
                  const isChildActive = pathname.startsWith(child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-xl transition-colors',
                        isChildActive
                          ? 'text-cyan-400 bg-cyan-500/10'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800'
                      )}
                    >
                      <ChildIcon className="w-4 h-4" />
                      <span className="text-sm">{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 flex-col bg-slate-950/80 backdrop-blur-lg border-r border-slate-800/50 z-50">
        <div className="px-5 py-5 border-b border-slate-800/50">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Code2 className="w-8 h-8 text-cyan-400" />
            <span className="text-xl font-bold text-white">PracCode</span>
          </Link>
        </div>

        <div className="flex-1 px-4 py-4">
          <DesktopNavLinks />
        </div>

        <div className="px-4 py-4 border-t border-slate-800/50">
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl transition-colors',
                userMenuOpen
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              )}
            >
              <span className="text-sm truncate">{user.name || user.email}</span>
              <ChevronDown
                className={cn('w-4 h-4 text-slate-400 transition-transform', userMenuOpen && 'rotate-180')}
              />
            </button>

            {userMenuOpen && (
              <div className="absolute left-0 right-0 bottom-12 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden">
                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  設定
                </Link>
                <div className="h-px bg-slate-800" />
                <form action={logout}>
                  <button
                    type="submit"
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    ログアウト
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar + Drawer */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800/50">
        <div className="h-14 px-4 flex items-center justify-between">
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="p-2 text-slate-300 hover:text-white"
            aria-label="menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <Code2 className="w-7 h-7 text-cyan-400" />
            <span className="text-lg font-bold text-white">PracCode</span>
          </Link>
          <div className="w-10" />
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" />
          <div
            ref={mobileDrawerRef}
            className="absolute left-0 top-0 h-full w-72 bg-slate-950 border-r border-slate-800/50 p-4 pt-16"
          >
            <MobileNavLinks onNavigate={() => setMobileMenuOpen(false)} />
            <div className="mt-6 pt-4 border-t border-slate-800/50 space-y-2">
              <div className="text-sm text-slate-400 px-2">{user.name || user.email}</div>
              <Link
                href="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Settings className="w-5 h-5" />
                設定
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  ログアウト
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
