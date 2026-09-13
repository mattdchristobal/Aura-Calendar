import React, { useState } from 'react';
import { User, Role, SharedCalendar, Category, CalendarEvent } from '../types';
import {
  Calendar,
  Lock,
  User as UserIcon,
  AlertCircle,
  LogIn,
  Eye,
  EyeOff,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  Mail,
  ArrowRight
} from 'lucide-react';
import { apiLogin, apiRegister } from '../utils/api';
import {
  loadUsers,
  saveCurrentUser,
  preserveUserCredential,
  getStoredCredential,
  loadLastIdentifier,
  saveLastIdentifier
} from '../utils/storage';

interface LoginPageProps {
  users: User[];
  onLogin: (user: User) => void;
  onRegisterUser?: (
    username: string,
    name: string,
    password: string,
    email?: string,
    role?: Role
  ) => Promise<User> | User;
  onAccessShareCode?: (code: string) => Promise<{ success: boolean; error?: string }>;
  shares?: SharedCalendar[];
  categories?: Category[];
  onOpenCategoryPdf?: (categoryId: string) => void;
  onEventsSynced?: (events: CalendarEvent[]) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  users: propUsers,
  onLogin,
  onRegisterUser
}) => {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(() => {
    const localUsers = loadUsers();
    return propUsers.length === 0 && localUsers.length === 0 ? 'signup' : 'signin';
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sign In States
  const [identifier, setIdentifier] = useState(() => loadLastIdentifier() || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userNotFoundIdentifier, setUserNotFoundIdentifier] = useState<string | null>(null);

  // Sign Up States
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Clear messages when tab changes
  const switchTab = (tab: 'signin' | 'signup') => {
    setActiveTab(tab);
    setErrorMsg('');
    setSuccessMsg('');
    setUserNotFoundIdentifier(null);
  };

  // Sign In Handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setUserNotFoundIdentifier(null);

    const cleanInput = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanInput) {
      setErrorMsg('Please enter your username or email address.');
      return;
    }
    if (!cleanPass) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Try server login
      const res = await apiLogin(cleanInput, cleanPass);
      if (res.success && res.user) {
        saveLastIdentifier(cleanInput);
        preserveUserCredential(res.user, cleanPass);
        saveCurrentUser(res.user);
        onLogin(res.user);
        setIsLoading(false);
        return;
      }

      if (res.error) {
        if (res.canRegister || res.error.includes('No account found')) {
          setUserNotFoundIdentifier(cleanInput);
        }
        setErrorMsg(res.error);
        setIsLoading(false);
        return;
      }
    } catch (err) {
      console.warn('Server login error, trying local vault:', err);
    }

    // 2. Fallback to local credentials vault
    const stored = getStoredCredential(cleanInput);
    if (stored) {
      const storedPass = (stored.password || '').trim();
      if (storedPass === cleanPass) {
        const userObj: User = {
          id: stored.id,
          username: stored.username,
          name: stored.name,
          email: stored.email,
          role: stored.role,
          avatarColor: stored.avatarColor,
          active: stored.active !== false,
          createdAt: stored.createdAt
        };
        saveLastIdentifier(cleanInput);
        preserveUserCredential(userObj, cleanPass);
        saveCurrentUser(userObj);
        onLogin(userObj);
        setIsLoading(false);
        return;
      } else {
        setErrorMsg('Incorrect password. Please try again.');
        setIsLoading(false);
        return;
      }
    }

    setUserNotFoundIdentifier(cleanInput);
    setErrorMsg(`No registered account found with "${cleanInput}". Please check your spelling or sign up below.`);
    setIsLoading(false);
  };

  // Sign Up Handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const name = regName.trim();
    const username = regUsername.trim().toLowerCase().replace(/^@+/, '');
    const email = regEmail.trim().toLowerCase();
    const pass = regPassword.trim();
    const confirmPass = regConfirmPassword.trim();

    if (!name) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!username || username.length < 2) {
      setErrorMsg('Username must be at least 2 characters long.');
      return;
    }
    if (!email || !email.includes('@') || !email.includes('.')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!pass || pass.length < 3) {
      setErrorMsg('Password must be at least 3 characters long.');
      return;
    }
    if (pass !== confirmPass) {
      setErrorMsg('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);

    try {
      if (onRegisterUser) {
        const newUser = await onRegisterUser(username, name, pass, email, 'admin');
        saveLastIdentifier(username);
        preserveUserCredential(newUser, pass);
        saveCurrentUser(newUser);
        setSuccessMsg(`Welcome, ${name}! Your Administrator account is ready.`);
        setTimeout(() => {
          onLogin(newUser);
          setIsLoading(false);
        }, 800);
        return;
      }

      const res = await apiRegister({
        username,
        name,
        password: pass,
        email,
        role: 'admin',
        avatarColor: 'bg-indigo-600'
      });
      if (res.success && res.user) {
        saveLastIdentifier(username);
        preserveUserCredential(res.user, pass);
        saveCurrentUser(res.user);
        setSuccessMsg(`Welcome, ${name}! Your account has been registered.`);
        setTimeout(() => {
          onLogin(res.user!);
          setIsLoading(false);
        }, 800);
        return;
      }

      if (res.error) {
        setErrorMsg(res.error);
        setIsLoading(false);
        return;
      }
    } catch (err: any) {
      console.warn('Registration API error, fallback local creation:', err);
    }

    const fallbackUser: User = {
      id: `user_${Date.now()}`,
      username,
      name,
      email,
      role: 'admin',
      avatarColor: 'bg-indigo-600',
      active: true,
      createdAt: new Date().toISOString()
    };

    saveLastIdentifier(username);
    preserveUserCredential(fallbackUser, pass);
    saveCurrentUser(fallbackUser);

    setSuccessMsg(`Welcome, ${name}! Administrator account initialized.`);
    setTimeout(() => {
      onLogin(fallbackUser);
      setIsLoading(false);
    }, 800);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100 relative overflow-hidden font-sans select-none">
      {/* Background Decorative Glow */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-900/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Modal Card */}
      <div className="relative w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 transition-all">
        {/* Header Branding */}
        <div className="p-6 pb-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30 text-white font-bold">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Pro Calendar</h1>
                <p className="text-xs text-slate-400">Executive Scheduling & Unified Calendar</p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs - Sign In and Sign Up */}
          <div className="grid grid-cols-2 gap-1.5 mt-5 p-1 bg-slate-950/70 rounded-2xl border border-slate-800/80">
            <button
              id="login-tab-signin"
              type="button"
              onClick={() => switchTab('signin')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'signin'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>

            <button
              id="login-tab-signup"
              type="button"
              onClick={() => switchTab('signup')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'signup'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Sign Up</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {/* Notification Alerts */}
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1">
                <p className="leading-relaxed font-medium">{errorMsg}</p>
                {userNotFoundIdentifier && (
                  <button
                    type="button"
                    onClick={() => {
                      if (userNotFoundIdentifier.includes('@')) {
                        setRegEmail(userNotFoundIdentifier);
                        setRegUsername(userNotFoundIdentifier.split('@')[0]);
                      } else {
                        setRegUsername(userNotFoundIdentifier);
                      }
                      switchTab('signup');
                    }}
                    className="mt-2 text-xs font-bold text-indigo-300 hover:text-indigo-200 flex items-center gap-1 underline underline-offset-2 cursor-pointer"
                  >
                    <span>Click here to create account for "{userNotFoundIdentifier}"</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <p className="leading-relaxed font-medium">{successMsg}</p>
            </div>
          )}

          {/* ================= STANDARD SIGN IN TAB ================= */}
          {activeTab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-slate-300 text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  <strong>Admins & Members:</strong> Sign in with your username or email address.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Username or Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter your username or email"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] cursor-pointer"
              >
                {isLoading ? (
                  <span>Authenticating...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* ================= SIGN UP TAB (ADMIN REGISTRATION) ================= */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="p-3 rounded-2xl bg-indigo-950/70 border border-indigo-700/60 text-indigo-200 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span className="font-medium">Direct Sign-Up Role:</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-300 border border-indigo-400/40">
                  Administrator (Full Access)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. sarah_admin"
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                      <Mail className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="sarah@company.com"
                      className="w-full pl-8 pr-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 pr-8 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80">
                <span className="text-indigo-400 font-semibold">Note for team members:</span> If an Admin already created
                an account for you, switch to{' '}
                <button
                  type="button"
                  onClick={() => switchTab('signin')}
                  className="text-indigo-300 font-bold hover:underline cursor-pointer"
                >
                  Sign In
                </button>{' '}
                to enter your username & password.
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-[0.99] cursor-pointer"
              >
                {isLoading ? (
                  <span>Creating Administrator Account...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Create Admin Account & Sign In</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer Note */}
        <div className="px-6 py-3 bg-slate-950/60 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500">
            Encrypted session &bull; Enterprise security &bull; Multi-user access
          </p>
        </div>
      </div>
    </div>
  );
};
