import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Users, Settings, BarChart3, Key, ExternalLink, Loader2, FileEdit } from 'lucide-react';
import { supabase } from '../utils/supabase/client';

interface WelcomePageProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export function WelcomePage({ theme, toggleTheme }: WelcomePageProps) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  // Check if user is already logged in and redirect
  useEffect(() => {
    const checkAuth = async () => {
      // Add timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        console.log('[WelcomePage] Auth check timeout, showing page...');
        setChecking(false);
      }, 3000);
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        clearTimeout(timeout);
        
        if (user) {
          // User is logged in - check if teacher or student
          const viewMode = localStorage.getItem('viewMode');
          
          if (viewMode === 'student') {
            navigate('/library/student-wall');
          } else {
            // Default to teacher/library view
            navigate('/docs');
          }
          return;
        }
      } catch (error) {
        console.error('Auth check error:', error);
        clearTimeout(timeout);
      }
      setChecking(false);
    };
    
    checkAuth();
  }, [navigate]);

  const links = [
    {
      title: 'Worksheet Editor PRO',
      description: 'Nový pokročilý editor pracovních listů',
      href: '/admin/worksheet-pro?offline=1',
      icon: FileEdit,
      gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
    },
    {
      title: 'Login pro učitele',
      description: 'Přihlášení do učitelského rozhraní',
      href: '/teacher/login',
      icon: GraduationCap,
      gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
    },
    {
      title: 'Login pro studenty',
      description: 'Přihlášení do studentského portálu',
      href: '/student/login',
      icon: Users,
      gradient: 'linear-gradient(135deg, #10B981 0%, #14B8A6 100%)',
    },
    {
      title: 'Administrace obsahu',
      description: 'Správa knihovny a obsahu Vividbooks',
      href: '/admin',
      icon: Settings,
      gradient: 'linear-gradient(135deg, #F97316 0%, #EF4444 100%)',
    },
    {
      title: 'Aktivita škol',
      description: 'Přehled aktivit a statistik škol',
      href: '/admin/customer-success',
      icon: BarChart3,
      gradient: 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
    },
    {
      title: 'Správa licencí',
      description: 'Administrace licencí a předplatných',
      href: '/admin/licence',
      icon: Key,
      gradient: 'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)',
    },
  ];

  // Show loading while checking auth
  if (checking) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          background: theme === 'dark' 
            ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
        }}
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: theme === 'dark' 
          ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
          : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%)',
      }}
    >
      <div className="w-full max-w-2xl">
      {/* Header */}
        <div className="text-center mb-12">
          <div 
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
              boxShadow: '0 10px 40px rgba(139, 92, 246, 0.3)',
            }}
          >
            <span className="text-white font-bold text-3xl">VB</span>
          </div>
          
          <h1 
            className="text-4xl font-bold mb-3"
            style={{ 
              color: theme === 'dark' ? '#f1f5f9' : '#1e293b',
              letterSpacing: '-0.02em',
            }}
          >
            Vividbooks 4.0
          </h1>
          
          <p 
            className="text-lg"
            style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}
          >
            Vývojový rozcestník
          </p>
        </div>

        {/* Links Grid */}
        <div className="space-y-4">
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="group block"
            >
              <div
                className="flex items-center gap-5 p-5 rounded-2xl transition-all duration-300"
                style={{
                  background: theme === 'dark' 
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(10px)',
                  border: theme === 'dark'
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : '1px solid rgba(0, 0, 0, 0.05)',
                  boxShadow: theme === 'dark'
                    ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                    : '0 4px 20px rgba(0, 0, 0, 0.05)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = theme === 'dark'
                    ? '0 8px 30px rgba(0, 0, 0, 0.4)'
                    : '0 8px 30px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = theme === 'dark'
                    ? '0 4px 20px rgba(0, 0, 0, 0.3)'
                    : '0 4px 20px rgba(0, 0, 0, 0.05)';
                }}
              >
                {/* Icon */}
                <div 
                  className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center"
                  style={{ 
                    background: link.gradient,
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <link.icon className="w-7 h-7 text-white" />
        </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <h3 
                    className="font-semibold text-lg mb-1"
                    style={{ color: theme === 'dark' ? '#f1f5f9' : '#1e293b' }}
                  >
                    {link.title}
                  </h3>
                  <p 
                    className="text-sm"
                    style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                  >
                    {link.description}
            </p>
          </div>

                {/* Arrow */}
                <div 
                  className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                >
                  <ExternalLink className="w-5 h-5" />
        </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Theme Toggle */}
        <div className="mt-10 text-center">
          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: theme === 'dark' 
                ? 'rgba(255, 255, 255, 0.1)'
                : 'rgba(0, 0, 0, 0.05)',
              color: theme === 'dark' ? '#94a3b8' : '#64748b',
            }}
          >
            {theme === 'light' ? '🌙 Tmavý režim' : '☀️ Světlý režim'}
          </button>
        </div>

      {/* Footer */}
        <div 
          className="mt-8 text-center text-sm"
          style={{ color: theme === 'dark' ? '#64748b' : '#94a3b8' }}
        >
          Vividbooks © 2024
        </div>
      </div>
    </div>
  );
}
