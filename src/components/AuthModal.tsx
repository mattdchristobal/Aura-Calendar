import React, { useState } from 'react';
import { User } from '../types';
import { apiLogin, apiCreateUser, apiRecoverCredentials, apiResetPassword } from '../utils/api';
import { loadUsers, saveUsers, saveCurrentUser, preserveUserCredential, getStoredCredential } from '../utils/storage';
import {
  X,
  Users,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Lock,
  User as UserIcon,
  AlertCircle,
  LogIn,
  Eye,
  EyeOff,
  Mail,
  Send,
  Copy,
  Check,
  HelpCircle
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  currentUser: User;
  onSwitchUser: (user: User) => void;
  onOpenAdmin: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUser,
  onSwitchUser,
  onOpenAdmin
}) => {
  const [mode, setMode] = useState<'login' | 'recovery'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Recovery states
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveredUsername, setRecoveredUsername] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [inputRecoveryCode, setInputRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryStep, setRecoveryStep] = useState<1 | 2>(1);
  const [copiedUsername, setCopiedUsername] = useState(false);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const rawInput = usernameInput.trim();
    const rawPass = passwordInput.trim();

    if (!rawInput) {
      setErrorMsg('Please enter a username or email.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Try backend server login first
      const serverResult = await apiLogin(rawInput, rawPass);
      if (serverResult.success && serverResult.user) {
        preserveUserCredential(serverResult.user, rawPass);
        onSwitchUser(serverResult.user);
        setUsernameInput('');
        setPasswordInput('');
        setIsSubmitting(false);
        onClose();
        return;
      }
    } catch (err) {
      console.warn('Backend login attempt fell back to local list:', err);
    }

    // 2. Check permanent vault
    const storedCred = getStoredCredential(rawInput);
    if (storedCred) {
      const expectedPass = (storedCred.password ?? 'password123').trim();
      const isMatch = rawPass === expectedPass || passwordInput === (storedCred.password ?? 'password123');
      if (isMatch) {
        const userObj: User = {
          id: storedCred.id,
          username: storedCred.username,
          name: storedCred.name,
          email: storedCred.email,
          role: storedCred.role,
          avatarColor: storedCred.avatarColor,
          active: storedCred.active !== false,
          createdAt: storedCred.createdAt,
          password: storedCred.password
        };
        preserveUserCredential(userObj, rawPass);
        apiCreateUser(userObj, rawPass).catch(() => {});
        saveCurrentUser(userObj);
        onSwitchUser(userObj);
        setUsernameInput('');
        setPasswordInput('');
        setIsSubmitting(false);
        onClose();
        return;
      }
    }

    // 3. Fallback to comprehensive local list across all sources
    const allStored = loadUsers();
    const map = new Map<string, User>();
    (users || []).forEach((u) => { if (u && u.id) map.set(u.id, u); });
    allStored.forEach((u) => { if (u && u.id) map.set(u.id, u); });
    const searchPool = Array.from(map.values());

    const cleanInput = rawInput.toLowerCase().replace(/^@+/, '');
    const targetUser = searchPool.find((u) => {
      const uName = (u.username || '').trim().toLowerCase().replace(/^@+/, '');
      const uEmail = (u.email || '').trim().toLowerCase();
      const uDisplayName = (u.name || '').trim().toLowerCase();
      const uId = (u.id || '').trim().toLowerCase();
      return uName === cleanInput || uEmail === cleanInput || uDisplayName === cleanInput || uId === cleanInput;
    });

    if (!targetUser) {
      setErrorMsg(`No account found with username or email "${rawInput}". Click "Forgot Credentials?" below to recover your details.`);
      setIsSubmitting(false);
      return;
    }

    if (!targetUser.active) {
      setErrorMsg(`Account "${targetUser.username}" has been disabled by Admin.`);
      setIsSubmitting(false);
      return;
    }

    const expectedPass = (targetUser.password ?? 'password123').trim();
    const isMatch = rawPass === expectedPass || passwordInput === (targetUser.password ?? 'password123');

    if (!isMatch) {
      setErrorMsg('Incorrect password for this user account. Click "Forgot Credentials?" to reset your password.');
      setIsSubmitting(false);
      return;
    }

    // Sync to backend and vault
    preserveUserCredential(targetUser, rawPass);
    apiCreateUser(targetUser, targetUser.password).catch(() => {});
    saveCurrentUser(targetUser);
    onSwitchUser(targetUser);
    setUsernameInput('');
    setPasswordInput('');
    setIsSubmitting(false);
    onClose();
  };

  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const input = recoveryEmail.trim();
    if (!input) {
      setErrorMsg('Please enter your registered email address or username.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanInput = input.toLowerCase().replace(/^@+/, '');
      const res = await apiRecoverCredentials(input);
      if (res.success && res.username) {
        setRecoveredUsername(res.username);
        const code = res.recoveryCode || Math.floor(100000 + Math.random() * 900000).toString();
        setRecoveryCode(code);
        setInputRecoveryCode(code);
        setRecoveryStep(2);
        setSuccessMsg(`Account found! Username is "${res.username}". Reset code: ${code}`);
        return;
      }

      // Local fallback
      const allStored = loadUsers();
      const map = new Map<string, User>();
      (users || []).forEach((u) => { if (u && u.id) map.set(u.id, u); });
      allStored.forEach((u) => { if (u && u.id) map.set(u.id, u); });
      const localFound = Array.from(map.values()).find((u) => {
        const uEmail = (u.email || '').trim().toLowerCase();
        const uName = (u.username || '').trim().toLowerCase().replace(/^@+/, '');
        const uDisplayName = (u.name || '').trim().toLowerCase();
        return uEmail === cleanInput || uName === cleanInput || uDisplayName === cleanInput;
      });

      if (localFound) {
        setRecoveredUsername(localFound.username);
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setRecoveryCode(code);
        setInputRecoveryCode(code);
        setRecoveryStep(2);
        setSuccessMsg(`Account found! Username is "${localFound.username}". Reset code: ${code}`);
      } else {
        setErrorMsg(`No registered account found with "${input}". Please check for typos or register a new account.`);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error looking up credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newPassword.trim() || newPassword.trim().length < 4) {
      setErrorMsg('Password must be at least 4 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanInput = recoveryEmail.trim().toLowerCase().replace(/^@+/, '');
      const newPass = newPassword.trim();
      const res = await apiResetPassword(cleanInput, newPass, inputRecoveryCode.trim());

      // Update storage locally as well
      const allStored = loadUsers();
      const updatedList = allStored.map((u) => {
        const uEmail = (u.email || '').trim().toLowerCase();
        const uName = (u.username || '').trim().toLowerCase().replace(/^@+/, '');
        if (uEmail === cleanInput || uName === cleanInput || u.username === recoveredUsername) {
          return { ...u, password: newPass };
        }
        return u;
      });
      saveUsers(updatedList);

      const targetUser = updatedList.find(
        (u) => u.username === (recoveredUsername || cleanInput) || (u.email || '').toLowerCase() === cleanInput
      );

      setSuccessMsg('Password updated! Signing you in...');
      setTimeout(() => {
        if (res.user || targetUser) {
          const userToLog = res.user || targetUser!;
          saveCurrentUser(userToLog);
          onSwitchUser(userToLog);
          onClose();
        } else {
          setMode('login');
          setUsernameInput(recoveredUsername);
        }
      }, 1000);
    } catch (e: any) {
      setErrorMsg(e?.message || 'Error updating password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-950/80">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-2 rounded-xl bg-indigo-600 text-white shadow-xs shrink-0">
              {mode === 'recovery' ? <KeyRound className="w-4 h-4 sm:w-5 sm:h-5" /> : <Users className="w-4 h-4 sm:w-5 sm:h-5" />}
            </span>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate">
                {mode === 'recovery' ? 'Recover Credentials' : 'Account Sign In & Switch'}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                {mode === 'recovery' ? 'Retrieve your username & reset password' : 'Log in or select registered collaborator profile'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'login' && (
            <>
              {/* Quick Profile Selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Select Active Profile
                </label>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {users.map((u) => {
                    const isCurrent = u.id === currentUser.id;

                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          if (u.active) {
                            onSwitchUser(u);
                            onClose();
                          }
                        }}
                        disabled={!u.active}
                        className={`w-full p-2.5 sm:p-3 rounded-2xl border text-left transition-all flex items-center justify-between ${
                          isCurrent
                            ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/60 ring-2 ring-indigo-500'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        } ${!u.active ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl ${u.avatarColor} text-white font-bold flex items-center justify-center text-xs shrink-0`}>
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">
                                {u.name}
                              </span>
                              <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                                u.role === 'admin'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300'
                                  : u.role === 'member'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                              }`}>
                                {u.role === 'admin' ? 'Admin' : u.role === 'member' ? 'Member' : 'Viewer'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">@{u.username} &bull; {u.email}</div>
                          </div>
                        </div>

                        {isCurrent && (
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Active</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form Login */}
              <form onSubmit={handleLoginSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Username or Email
                  </label>
                  <input
                    type="text"
                    placeholder="Enter username or email..."
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('recovery');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-bold"
                    >
                      Forgot Credentials?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password..."
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{isSubmitting ? 'Signing In...' : 'Log In'}</span>
                </button>
              </form>
            </>
          )}

          {mode === 'recovery' && (
            <div className="space-y-3">
              {recoveryStep === 1 ? (
                <form onSubmit={handleRecoverSubmit} className="space-y-3">
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-amber-600" />
                      <span>Email Credential Recovery</span>
                    </div>
                    <p className="text-[11px] opacity-90">
                      Enter your email to retrieve your username and a secure password reset verification code.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Registered Email
                    </label>
                    <input
                      type="email"
                      placeholder="user@executivetech.com"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 transition-all"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSubmitting ? 'Looking up...' : 'Find My Account & Send Code'}</span>
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      &larr; Back to Sign In
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetSubmit} className="space-y-3">
                  <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Account Username</div>
                    <div className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">@{recoveredUsername}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Verification Code: <strong>{recoveryCode}</strong></div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Verification Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={inputRecoveryCode}
                      onChange={(e) => setInputRecoveryCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 text-center tracking-widest"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      placeholder="Minimum 4 characters..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmitting ? 'Updating...' : 'Set New Password & Sign In'}</span>
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setRecoveryStep(1)}
                      className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      &larr; Back to Email Lookup
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {currentUser.role === 'admin' && mode === 'login' && (
            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenAdmin();
                }}
                className="w-full py-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center gap-2 border border-purple-200 dark:border-purple-800"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Admin User Management & Create Accounts</span>
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
