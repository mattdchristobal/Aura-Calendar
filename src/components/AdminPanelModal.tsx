import React, { useState, useEffect } from 'react';
import { User, Role, CalendarEvent, Category } from '../types';
import { apiResetUsersDatabase } from '../utils/api';
import { resetUsersStorage, deleteUserPermanently } from '../utils/storage';
import { CATEGORY_COLOR_PRESETS, createCategory, DEFAULT_CATEGORIES } from '../utils/categories';
import {
  ShieldCheck,
  UserPlus,
  Users,
  X,
  CheckCircle2,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Copy,
  Link as LinkIcon,
  RefreshCw,
  FileText,
  Upload,
  Calendar,
  Globe,
  Check,
  Clock,
  MapPin,
  Sparkles,
  ExternalLink,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  UserCheck,
  RotateCcw,
  Mail,
  Tag,
  Palette,
  PlusCircle,
  Plus,
  CheckSquare,
  Lock
} from 'lucide-react';

interface AdminPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onCreateUser: (newUser: Omit<User, 'id' | 'createdAt'>, password: string) => void;
  onToggleUserActive: (userId: string) => void;
  onDeleteUser: (userId: string) => void | Promise<void>;
  currentUser: User;
  onImportEvents?: (newEvents: CalendarEvent[]) => void;
  onUpdateUser?: (updatedUser: User) => void;
  categories?: Category[];
  events?: CalendarEvent[];
  onSaveCategory?: (category: Category) => void;
  onDeleteCategory?: (categoryId: string) => void;
  onResetCategories?: () => void;
  initialTab?: 'users' | 'categories';
  onOpenSettings?: (tab?: 'categories') => void;
}

export const AdminPanelModal: React.FC<AdminPanelModalProps> = ({
  isOpen,
  onClose,
  users,
  onCreateUser,
  onToggleUserActive,
  onDeleteUser,
  currentUser,
  onImportEvents,
  onUpdateUser,
  categories = DEFAULT_CATEGORIES,
  events = [],
  onSaveCategory,
  onDeleteCategory,
  onResetCategories,
  initialTab = 'users',
  onOpenSettings
}) => {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<'users' | 'categories'>(initialTab);

  // Set initial tab when prop changes or modal opens
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Category Tag Management State
  const [newCatName, setNewCatName] = useState('');
  const [newCatColorKey, setNewCatColorKey] = useState('indigo');
  const [newCatCustomHex, setNewCatCustomHex] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColorKey, setEditCatColorKey] = useState('blue');
  const [editCatCustomHex, setEditCatCustomHex] = useState('');
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);
  const [catReassignTargetId, setCatReassignTargetId] = useState('work');
  const [categorySuccessToast, setCategorySuccessToast] = useState('');
  const [categoryErrorMsg, setCategoryErrorMsg] = useState('');

  // Admin self-edit state
  const [isAdminEditingSelf, setIsAdminEditingSelf] = useState(false);
  const [adminName, setAdminName] = useState(currentUser?.name || '');
  const [adminUsername, setAdminUsername] = useState(currentUser?.username || '');
  const [adminEmail, setAdminEmail] = useState(currentUser?.email || '');
  const [adminPassword, setAdminPassword] = useState(currentUser?.password || 'password123');
  const [adminAvatarColor, setAdminAvatarColor] = useState(currentUser?.avatarColor || 'bg-indigo-600');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminSelfSuccess, setAdminSelfSuccess] = useState('');

  // Keep admin self-edit state in sync with currentUser
  useEffect(() => {
    if (currentUser) {
      setAdminName(currentUser.name || '');
      setAdminUsername(currentUser.username || '');
      setAdminEmail(currentUser.email || '');
      setAdminPassword(currentUser.password || 'password123');
      setAdminAvatarColor(currentUser.avatarColor || 'bg-indigo-600');
    }
  }, [currentUser]);

  // User creation form
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [avatarColor, setAvatarColor] = useState('bg-emerald-600');
  const [showFormPassword, setShowFormPassword] = useState(false);

  // Edit user state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<Role>('member');
  const [editPassword, setEditPassword] = useState('');
  const [editAvatarColor, setEditAvatarColor] = useState('bg-indigo-600');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Reset database state
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResettingDb, setIsResettingDb] = useState(false);

  // Visible passwords in list map (userId -> boolean)
  const [revealedPasswords, setRevealedPasswords] = useState<{ [id: string]: boolean }>({});

  const [createdCredentialsNotice, setCreatedCredentialsNotice] = useState<{
    username: string;
    pass: string;
    name: string;
    role: Role;
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Collaborator account deletion state & warning confirmation
  const [userPendingDelete, setUserPendingDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteSuccessToast, setDeleteSuccessToast] = useState('');
  const [deleteErrorMsg, setDeleteErrorMsg] = useState('');

  if (!isOpen) return null;

  const colorOptions = [
    { label: 'Indigo', value: 'bg-indigo-600' },
    { label: 'Emerald', value: 'bg-emerald-600' },
    { label: 'Purple', value: 'bg-purple-600' },
    { label: 'Rose', value: 'bg-rose-600' },
    { label: 'Amber', value: 'bg-amber-600' },
    { label: 'Cyan', value: 'bg-cyan-600' }
  ];

  const isAdmin = currentUser.role === 'admin';

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isAdmin) {
      setErrorMsg('Only administrators can create collaborator accounts.');
      return;
    }

    if (!username.trim() || !name.trim() || !password.trim()) {
      setErrorMsg('Please fill in username, display name, and password.');
      return;
    }

    const cleanUsername = username.trim().toLowerCase().replace(/^@+/, '');
    const cleanEmail = email.trim().toLowerCase() || `${cleanUsername}@executivetech.com`;

    // Check duplicate username
    const usernameExists = users.some(
      (u) => (u.username || '').toLowerCase().replace(/^@+/, '') === cleanUsername
    );
    if (usernameExists) {
      setErrorMsg(`Username "${cleanUsername}" is already taken. Please choose another username.`);
      return;
    }

    // Check duplicate email - strictly 1 account per email
    const emailExists = users.some(
      (u) => (u.email || '').trim().toLowerCase() === cleanEmail
    );
    if (emailExists) {
      setErrorMsg(`Email address "${cleanEmail}" is already associated with an account. Each user must have a unique email.`);
      return;
    }

    onCreateUser(
      {
        username: cleanUsername,
        name: name.trim(),
        email: cleanEmail,
        role,
        avatarColor,
        active: true,
        createdByAdmin: currentUser.username
      },
      password.trim()
    );

    setCreatedCredentialsNotice({
      username: cleanUsername,
      pass: password.trim(),
      name: name.trim(),
      role
    });

    setSuccessToast(`Account created for ${name.trim()} (@${cleanUsername}) with role: ${role.toUpperCase()}`);

    // Reset form
    setUsername('');
    setName('');
    setEmail('');
    setPassword('');
  };

  const handleCopyCredentials = () => {
    if (!createdCredentialsNotice) return;
    const text = `AuraCalendar Collaborator Credentials:\nName: ${createdCredentialsNotice.name}\nUsername: ${createdCredentialsNotice.username}\nPassword: ${createdCredentialsNotice.pass}\nRole: ${createdCredentialsNotice.role.toUpperCase()}`;
    navigator.clipboard.writeText(text);
    setSuccessToast('Credentials copied to clipboard!');
  };

  const handleStartEditUser = (u: User) => {
    if (!isAdmin && u.id !== currentUser.id) {
      setErrorMsg("Members can only edit their own account.");
      return;
    }
    setEditingUserId(u.id);
    setEditUsername(u.username);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditPassword(u.password || 'password123');
    setEditAvatarColor(u.avatarColor || 'bg-indigo-600');
    setShowEditPassword(false);
  };

  const handleSaveAdminAccount = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setAdminSelfSuccess('');

    if (!adminName.trim()) {
      setErrorMsg('Full / Display Name cannot be empty.');
      return;
    }

    const cleanUsername = (adminUsername.trim() || currentUser.username).toLowerCase().replace(/^@+/, '');
    const cleanEmail = (adminEmail.trim() || currentUser.email).toLowerCase();

    // Check email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address (e.g. yourname@company.com).');
      return;
    }

    // Check duplicate username
    const duplicateUsername = users.some(
      (other) => other.id !== currentUser.id && other.username.toLowerCase().replace(/^@+/, '') === cleanUsername
    );
    if (duplicateUsername) {
      setErrorMsg(`Username "${cleanUsername}" is already in use by another user.`);
      return;
    }

    // Check duplicate email
    const duplicateEmail = users.some(
      (other) => other.id !== currentUser.id && (other.email || '').trim().toLowerCase() === cleanEmail
    );
    if (duplicateEmail) {
      setErrorMsg(`Email "${cleanEmail}" is already registered to another account.`);
      return;
    }

    if (onUpdateUser) {
      const updatedAdmin: User = {
        ...currentUser,
        name: adminName.trim(),
        username: cleanUsername,
        email: cleanEmail,
        password: adminPassword.trim() || currentUser.password || 'password123',
        avatarColor: adminAvatarColor,
        role: currentUser.role // Preserves their role (admin or member)
      };

      onUpdateUser(updatedAdmin);
      setIsAdminEditingSelf(false);
      setAdminSelfSuccess('Profile, email, and password updated successfully!');
      setSuccessToast(`Account updated: ${updatedAdmin.name} (${updatedAdmin.email})`);
    }
  };

  const handleSaveEditUser = (u: User) => {
    if (!isAdmin && u.id !== currentUser.id) {
      setErrorMsg("Members can only edit their own account.");
      return;
    }
    setErrorMsg('');
    if (!editName.trim()) {
      setErrorMsg('Name cannot be empty.');
      return;
    }

    const cleanUsername = (editUsername.trim() || u.username).toLowerCase().replace(/^@+/, '');
    const cleanEmail = (editEmail.trim() || u.email).toLowerCase();

    // Check email format if provided
    if (cleanEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        setErrorMsg('Please enter a valid email address (e.g. name@company.com).');
        return;
      }
    }

    // Check if new username is taken by another user
    const duplicateUsername = users.some(
      (other) => other.id !== u.id && other.username.toLowerCase().replace(/^@+/, '') === cleanUsername
    );
    if (duplicateUsername) {
      setErrorMsg(`Username "${cleanUsername}" is already in use by another account.`);
      return;
    }

    // Check if new email is taken by another user
    const duplicateEmail = users.some(
      (other) => other.id !== u.id && (other.email || '').trim().toLowerCase() === cleanEmail
    );

    if (duplicateEmail) {
      setErrorMsg(`Email "${cleanEmail}" is already registered to another account. Each account must have a unique email.`);
      return;
    }

    if (onUpdateUser) {
      const updated: User = {
        ...u,
        username: cleanUsername,
        name: editName.trim(),
        email: cleanEmail,
        role: isAdmin ? editRole : u.role, // Members cannot change roles
        avatarColor: editAvatarColor || u.avatarColor || 'bg-indigo-600',
        password: editPassword.trim() || u.password || 'password123'
      };
      onUpdateUser(updated);
      setEditingUserId(null);
      setSuccessToast(`Updated account settings for ${updated.name}`);
    }
  };

  const toggleRevealPassword = (userId: string) => {
    // Only admins or the user themselves can reveal their password
    if (!isAdmin && userId !== currentUser.id) {
      return;
    }
    setRevealedPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleResetUserDatabase = async () => {
    if (!isAdmin) {
      setErrorMsg('Only administrators can reset the user database.');
      return;
    }
    setIsResettingDb(true);
    setErrorMsg('');
    try {
      const res = await apiResetUsersDatabase();
      if (res.success && res.users) {
        resetUsersStorage(res.users);
        setSuccessToast('User database purged and reset to clean baseline accounts with unique emails.');
        setShowResetConfirm(false);
        setTimeout(() => {
          window.location.reload();
        }, 800);
      } else {
        setErrorMsg(res.error || 'Failed to reset database.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error executing database reset.');
    } finally {
      setIsResettingDb(false);
    }
  };

  // Category Tag Action Handlers
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryErrorMsg('');
    if (!newCatName.trim()) {
      setCategoryErrorMsg('Please enter a category tag name.');
      return;
    }

    const trimmed = newCatName.trim();
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      setCategoryErrorMsg(`A category tag named "${trimmed}" already exists.`);
      return;
    }

    const cat = createCategory(trimmed, newCatColorKey, undefined, newCatCustomHex || undefined);
    if (onSaveCategory) {
      onSaveCategory(cat);
      setCategorySuccessToast(`Created category tag "${cat.name}" successfully!`);
      setNewCatName('');
      setNewCatCustomHex('');
    }
  };

  const handleStartEditCategory = (cat: Category) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatColorKey(cat.color || 'blue');
    setEditCatCustomHex(cat.hex || '');
    setCategoryErrorMsg('');
  };

  const handleSaveEditCategory = () => {
    if (!editingCatId) return;
    setCategoryErrorMsg('');
    if (!editCatName.trim()) {
      setCategoryErrorMsg('Category name cannot be empty.');
      return;
    }

    const updated = createCategory(editCatName.trim(), editCatColorKey, editingCatId, editCatCustomHex || undefined);
    if (onSaveCategory) {
      onSaveCategory(updated);
      setCategorySuccessToast(`Updated category tag "${updated.name}" successfully!`);
      setEditingCatId(null);
    }
  };

  const handleConfirmDeleteCategory = () => {
    if (!deletingCatId) return;
    const catToDelete = categories.find((c) => c.id === deletingCatId);
    if (!catToDelete) return;

    if (categories.length <= 1) {
      setCategoryErrorMsg('You must have at least one active category tag.');
      return;
    }

    if (onDeleteCategory) {
      onDeleteCategory(deletingCatId);
      setCategorySuccessToast(`Deleted category tag "${catToDelete.name}".`);
      setDeletingCatId(null);
    }
  };


  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-slate-100 dark:bg-slate-950 animate-in fade-in duration-200 overflow-hidden">
      <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
        
        {/* Full Screen Header */}
        <header className="px-4 sm:px-8 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900/95 backdrop-blur-md shrink-0 shadow-2xs z-30">
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2 sm:p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-500/20 shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                  Manage Users & Accounts
                </h1>
                <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  Full Screen Workspace
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Collaborator accounts, user directory, and role permissions
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors shrink-0 ml-2 cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </header>

        {/* Success Toast */}
        {successToast && (
          <div className="mx-4 sm:mx-8 mt-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successToast}</span>
            </div>
            <button
              onClick={() => setSuccessToast('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-4 sm:px-8 pt-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar bg-slate-50/70 dark:bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('users')}
              className="pb-3 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all shrink-0 whitespace-nowrap cursor-pointer border-purple-600 text-purple-600 dark:text-purple-400"
            >
              <Users className="w-4 h-4" />
              <span>Collaborator Accounts & Roles ({users.length})</span>
            </button>
          </div>

          {onOpenSettings && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSettings('categories');
              }}
              className="mb-2 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
              title="Manage Category Tags in Settings"
            >
              <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Category &amp; Tags &rarr; Settings</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </button>
          )}
        </div>

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10 bg-slate-50/60 dark:bg-slate-950/60">
          <div className="max-w-5xl mx-auto space-y-6">
          
          {/* TAB 1: USERS & ROLES MANAGEMENT */}
          {activeTab === 'users' && (
            <>
              {/* Section 0: Dedicated My Administrator Profile & Account Credentials */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border-2 border-purple-500/40 shadow-xs space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-2xl bg-purple-600 text-white shadow-xs">
                      <ShieldCheck className="w-5 h-5" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {isAdmin ? 'My Administrator Account' : 'My Account Credentials'}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          {isAdmin ? 'Signed-In Admin' : 'Signed-In Member'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isAdmin
                          ? 'Manage your personal profile, display name, password, and the email address used when you signed up.'
                          : 'Manage your personal collaborator profile, display name, password, and registered email address.'}
                      </p>
                    </div>
                  </div>

                  {!isAdminEditingSelf && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminEditingSelf(true);
                        setAdminName(currentUser.name);
                        setAdminUsername(currentUser.username);
                        setAdminEmail(currentUser.email || '');
                        setAdminPassword(currentUser.password || 'password123');
                        setAdminAvatarColor(currentUser.avatarColor || 'bg-indigo-600');
                        setErrorMsg('');
                        setAdminSelfSuccess('');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 active:scale-98"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit My Account & Email</span>
                    </button>
                  )}
                </div>

                {adminSelfSuccess && (
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{adminSelfSuccess}</span>
                  </div>
                )}

                {/* View / Summary Mode */}
                {!isAdminEditingSelf ? (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className={`w-12 h-12 rounded-2xl ${currentUser.avatarColor || 'bg-indigo-600'} text-white font-black text-lg flex items-center justify-center shadow-xs shrink-0`}>
                        {currentUser.name.charAt(0)}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {currentUser.name}
                          </span>
                          <span className="text-xs font-mono text-purple-600 dark:text-purple-400 font-bold">
                            @{currentUser.username}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
                          <span className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span><strong>Registered Email:</strong> {currentUser.email || 'None set'}</span>
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1.5 font-mono">
                            <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                            <span>Password: <strong>{showAdminPassword ? (currentUser.password || 'password123') : '••••••••'}</strong></span>
                            <button
                              type="button"
                              onClick={() => setShowAdminPassword(!showAdminPassword)}
                              className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              title={showAdminPassword ? 'Hide Password' : 'Show Password'}
                            >
                              {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAdminEditingSelf(true);
                          setAdminName(currentUser.name);
                          setAdminUsername(currentUser.username);
                          setAdminEmail(currentUser.email || '');
                          setAdminPassword(currentUser.password || 'password123');
                          setAdminAvatarColor(currentUser.avatarColor || 'bg-indigo-600');
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        Change Name, Email, or Password
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Edit Mode for Admin Profile */
                  <form onSubmit={handleSaveAdminAccount} className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                        <Edit3 className="w-4 h-4 text-purple-600" />
                        <span>Update Administrator Profile & Credentials</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAdminEditingSelf(false)}
                        className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-semibold"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Full / Display Name *
                        </label>
                        <input
                          type="text"
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          placeholder="Your display name"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Username (Login Handle) *
                        </label>
                        <input
                          type="text"
                          value={adminUsername}
                          onChange={(e) => setAdminUsername(e.target.value)}
                          placeholder="e.g. admin_name"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Registered Email Address *
                        </label>
                        <input
                          type="email"
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="Email used during initial sign-up"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                          required
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Update the email address you entered when signing up. You can log in using either this email or your username.
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                            Password *
                          </label>
                        </div>
                        <div className="relative">
                          <input
                            type={showAdminPassword ? 'text' : 'password'}
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="Enter new password..."
                            className="w-full pl-3 pr-9 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowAdminPassword(!showAdminPassword)}
                            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                          >
                            {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Avatar Color Picker */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Avatar Color
                      </label>
                      <div className="flex items-center gap-2">
                        {colorOptions.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setAdminAvatarColor(c.value)}
                            className={`w-7 h-7 rounded-xl ${c.value} transition-all ${
                              adminAvatarColor === c.value
                                ? 'ring-4 ring-offset-2 ring-purple-500 scale-110'
                                : 'opacity-70 hover:opacity-100'
                            }`}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-purple-200/60 dark:border-purple-800/60">
                      <button
                        type="button"
                        onClick={() => setIsAdminEditingSelf(false)}
                        className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 flex items-center gap-1.5 transition-all active:scale-98"
                      >
                        <Check className="w-4 h-4" />
                        <span>Save Account Updates</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Section 1: Create New Collaborator Account */}
              {isAdmin ? (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-xl bg-purple-600 text-white shadow-xs">
                      <UserPlus className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        Create Member / Collaborator Account
                      </h3>
                      <p className="text-xs text-slate-500">
                        Create a login for a team member so they can sign in directly with this username and password
                      </p>
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleCreateAccount} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Username (for Login) *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. sarah_collaboration"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Full / Display Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sarah Smith"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. sarah.smith@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          Initial Password *
                        </label>
                        <button
                          type="button"
                          onClick={() => setPassword(`user${Math.floor(100 + Math.random() * 900)}!`)}
                          className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-bold"
                        >
                          Auto-generate
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showFormPassword ? 'text' : 'password'}
                          placeholder="Set account password..."
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowFormPassword(!showFormPassword)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showFormPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Role Assignment */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Assign Access Role *
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <label
                        className={`p-3 rounded-2xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                          role === 'admin'
                            ? 'border-purple-600 bg-purple-50/80 dark:bg-purple-950/60 ring-2 ring-purple-500/30'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="new_user_role"
                          checked={role === 'admin'}
                          onChange={() => setRole('admin')}
                          className="mt-0.5 text-purple-600 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Admin
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                              Full Access
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Full control to create, edit, & delete events, access settings, and manage team users.
                          </p>
                        </div>
                      </label>

                      <label
                        className={`p-3 rounded-2xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                          role === 'member'
                            ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/60 ring-2 ring-blue-500/30'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="new_user_role"
                          checked={role === 'member'}
                          onChange={() => setRole('member')}
                          className="mt-0.5 text-blue-600 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Member
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              Event Editor
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Can create and edit events, but cannot delete events or access system settings.
                          </p>
                        </div>
                      </label>

                      <label
                        className={`p-3 rounded-2xl border cursor-pointer flex items-start gap-2.5 transition-all ${
                          role === 'viewer'
                            ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/60 ring-2 ring-emerald-500/30'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name="new_user_role"
                          checked={role === 'viewer'}
                          onChange={() => setRole('viewer')}
                          className="mt-0.5 text-emerald-600 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              Viewer
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                              View Only
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                            Can view schedules and export iCal, but cannot modify or delete events.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Avatar Color */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      Profile Avatar Color
                    </label>
                    <div className="flex items-center gap-2">
                      {colorOptions.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setAvatarColor(c.value)}
                          className={`w-7 h-7 rounded-xl ${c.value} transition-all ${
                            avatarColor === c.value
                              ? 'ring-4 ring-offset-2 ring-purple-500 scale-110'
                              : 'opacity-70 hover:opacity-100'
                          }`}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-500/20 transition-all active:scale-98"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Create Member Account & Issue Credentials</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-700/80 flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    Collaborator Provisioning Restricted
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Only Administrators can create and provision new collaborator accounts. As a Member, you can manage and edit your own personal account credentials below.
                  </p>
                </div>
              </div>
            )}

              {/* Success Banner Notice for Admin to copy/share */}
              {createdCredentialsNotice && (
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Account Created! Give these login details to your member to sign in:</span>
                    </div>

                    <button
                      onClick={handleCopyCredentials}
                      className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Credentials</span>
                    </button>
                  </div>

                  <div className="text-xs font-mono bg-white dark:bg-slate-800 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 text-slate-800 dark:text-slate-200 space-y-1">
                    <div><strong>Display Name:</strong> {createdCredentialsNotice.name}</div>
                    <div><strong>Username:</strong> {createdCredentialsNotice.username}</div>
                    <div><strong>Password:</strong> {createdCredentialsNotice.pass}</div>
                    <div><strong>Assigned Role:</strong> {createdCredentialsNotice.role.toUpperCase()}</div>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    The member can now open the app, enter this username and password on the Sign In page, and log in directly.
                  </p>
                </div>
              )}

              {/* Section 2: Account Directory List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-500" />
                    <span>All Registered Collaborator Accounts ({users.length})</span>
                  </h3>
                </div>

                {deleteSuccessToast && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 shadow-xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{deleteSuccessToast}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteSuccessToast('')}
                      className="p-1 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 cursor-pointer"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="space-y-2.5">
                  {users.map((u) => {
                    const isSelf = u.id === currentUser.id;
                    const isEditing = editingUserId === u.id;
                    const userPassword = u.password || 'password123';
                    const isPasswordRevealed = revealedPasswords[u.id];

                    if (isEditing) {
                      return (
                        <div
                          key={u.id}
                          className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border-2 border-purple-500/60 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Editing Account: @{u.username} {isSelf && (isAdmin ? '(Your Admin Account)' : '(Your Account)')}</span>
                            </span>
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="text-xs text-slate-400 hover:text-slate-600"
                            >
                              Cancel
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Full / Display Name *
                              </label>
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                placeholder="Display name"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Username (Login Handle) *
                              </label>
                              <input
                                type="text"
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                                placeholder="Username handle"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Email Address {isSelf && '(Registered Sign-Up Email)'}
                              </label>
                              <input
                                type="email"
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                placeholder="Email address"
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Role Permission
                              </label>
                              <select
                                value={editRole}
                                onChange={(e) => setEditRole(e.target.value as Role)}
                                disabled={isSelf || !isAdmin}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white disabled:opacity-70"
                              >
                                <option value="admin">Admin (Full Event Editor & Settings)</option>
                                <option value="member">Member (Event Editor - No Delete/Settings)</option>
                                <option value="viewer">Viewer (Read-Only Access)</option>
                              </select>
                              {!isAdmin && (
                                <p className="text-[10px] text-slate-500 mt-1">Role assignments can only be changed by an administrator.</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Reset / Update Password
                              </label>
                              <div className="relative">
                                <input
                                  type={showEditPassword ? 'text' : 'password'}
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                  className="w-full pl-2.5 pr-8 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-semibold text-slate-900 dark:text-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => setShowEditPassword(!showEditPassword)}
                                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                                >
                                  {showEditPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                                Avatar Color
                              </label>
                              <div className="flex items-center gap-1.5 pt-0.5">
                                {colorOptions.map((c) => (
                                  <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => setEditAvatarColor(c.value)}
                                    className={`w-6 h-6 rounded-lg ${c.value} transition-all ${
                                      editAvatarColor === c.value
                                        ? 'ring-2 ring-offset-1 ring-purple-500 scale-110'
                                        : 'opacity-70 hover:opacity-100'
                                    }`}
                                    title={c.label}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveEditUser(u)}
                              className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Save Changes</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    const canEditThisUser = isAdmin || isSelf;
                    const canViewPassword = isAdmin || isSelf;

                    return (
                      <div
                        key={u.id}
                        className="p-3.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${u.avatarColor || 'bg-indigo-600'} text-white font-bold flex items-center justify-center text-sm shrink-0`}>
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-xs text-slate-900 dark:text-white">
                                {u.name}
                              </span>
                              {canEditThisUser && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEditUser(u)}
                                  className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-purple-600 transition-colors cursor-pointer"
                                  title="Edit display name, email, or password"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                              )}
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                u.role === 'admin'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                  : u.role === 'member'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                              }`}>
                                {u.role === 'admin' ? 'Admin (Full Access)' : u.role === 'member' ? 'Member (Event Editor)' : 'Viewer (Read-Only)'}
                              </span>
                              {isSelf && (
                                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">(You - Signed In)</span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-2 flex-wrap">
                              <span>user: <strong>@{u.username}</strong></span>
                              <span>&bull;</span>
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-400" />
                                <span>{u.email || 'No email'}</span>
                              </span>
                              <span>&bull;</span>
                              <span>pass: <strong>{canViewPassword && isPasswordRevealed ? userPassword : '••••••••'}</strong></span>
                              {canViewPassword && (
                                <button
                                  type="button"
                                  onClick={() => toggleRevealPassword(u.id)}
                                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
                                  title={isPasswordRevealed ? 'Hide Password' : 'Show Password'}
                                >
                                  {isPasswordRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                              )}
                            </div>

                            {/* Active Category Tags Available to this Member */}
                            <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500 flex-wrap">
                              <Tag className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span className="font-semibold text-slate-700 dark:text-slate-300">Category Tags:</span>
                              <span>{categories ? categories.length : 0} active tags available</span>
                              {categories && categories.length > 0 && (
                                <div className="flex items-center gap-1 ml-1">
                                  {categories.slice(0, 6).map((c) => (
                                    <span
                                      key={c.id}
                                      className="w-2.5 h-2.5 rounded-full inline-block shrink-0 shadow-2xs"
                                      style={{ backgroundColor: c.hex || '#3B82F6' }}
                                      title={c.name}
                                    />
                                  ))}
                                  {categories.length > 6 && (
                                    <span className="text-[9px] text-slate-400 font-mono">+{categories.length - 6}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {canEditThisUser ? (
                            <button
                              onClick={() => handleStartEditUser(u)}
                              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                              title="Edit Name, Email, Password, or Role"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit Account</span>
                            </button>
                          ) : (
                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>View Only</span>
                            </span>
                          )}

                          {isAdmin && (
                            <button
                              onClick={() => onToggleUserActive(u.id)}
                              disabled={isSelf}
                              className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                                u.active
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title={isSelf ? 'Cannot disable your own active account' : undefined}
                            >
                              {u.active ? 'Active' : 'Disabled'}
                            </button>
                          )}

                          {isAdmin && !isSelf && (
                            <button
                              id={`admin-delete-user-${u.id}`}
                              type="button"
                              onClick={() => {
                                setDeleteErrorMsg('');
                                setUserPendingDelete(u);
                              }}
                              className="px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/70 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 transition-colors flex items-center gap-1 cursor-pointer"
                              title={`Delete account for @${u.username}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                          {isSelf && (
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 italic px-2 py-1">
                              (Your Account)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Section 3: Reset & Purge Registered Database (Admin Only) */}
                {isAdmin && (
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-300">
                          <RotateCcw className="w-4 h-4 text-rose-600" />
                          <span>Purge & Cleanse User Accounts Database</span>
                        </div>
                        <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                          Removes duplicated or invalid user registrations and resets all accounts to verified unique email addresses.
                        </p>
                      </div>

                      {!showResetConfirm ? (
                        <button
                          type="button"
                          onClick={() => setShowResetConfirm(true)}
                          className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Purge &amp; Reset Users</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowResetConfirm(false)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isResettingDb}
                            onClick={handleResetUserDatabase}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
                          >
                            {isResettingDb ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            <span>Confirm Reset</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: RELOCATION NOTICE (MOVED TO SETTINGS) */}
          {activeTab === "categories" && (
            <div className="p-8 sm:p-12 text-center space-y-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xs">
                <Tag className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Category &amp; Tags Moved to Settings
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
                  Color-coded category tags and calendar visibility filters are now centrally managed under the <strong>Category &amp; Tags</strong> tab inside the <strong>Settings Menu</strong>.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab("users")}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Back to User Accounts
                </button>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSettings("categories");
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Tag className="w-4 h-4" />
                    <span>Open Category &amp; Tags in Settings</span>
                  </button>
                )}
              </div>
            </div>
          )}

          </div>
        </div>

        {/* Account Deletion Confirmation Warning Modal Dialog */}
        {userPendingDelete && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
            <div
              className="bg-white dark:bg-slate-900 border-2 border-rose-200 dark:border-rose-900/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-account-dialog-title"
              aria-describedby="delete-account-dialog-desc"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900/60 shadow-xs">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 id="delete-account-dialog-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                    Permanently Delete Account?
                  </h3>
                  <p id="delete-account-dialog-desc" className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Please confirm before removing this collaborator.
                  </p>
                </div>
              </div>

              {/* Collaborator Profile Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${userPendingDelete.avatarColor || 'bg-indigo-600'} text-white font-bold flex items-center justify-center text-sm shrink-0 shadow-xs`}>
                  {userPendingDelete.name ? userPendingDelete.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {userPendingDelete.name}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {userPendingDelete.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5">
                    @{userPendingDelete.username} &bull; {userPendingDelete.email || 'No email registered'}
                  </div>
                </div>
              </div>

              {/* Explicit Warning Message */}
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 text-xs leading-relaxed space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-rose-800 dark:text-rose-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>Warning: Permanent &amp; Irreversible Action</span>
                </div>
                <p className="text-[11px] text-rose-700 dark:text-rose-300/90 leading-normal">
                  Are you sure you want to delete this collaborator account? This will permanently revoke <strong>@{userPendingDelete.username}</strong>'s access, delete their login credentials from the database and storage, and remove them from all shared views.
                </p>
              </div>

              {deleteErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{deleteErrorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  id="cancel-delete-user-btn"
                  type="button"
                  disabled={isDeletingUser}
                  onClick={() => {
                    setUserPendingDelete(null);
                    setDeleteErrorMsg('');
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  id="confirm-delete-user-btn"
                  type="button"
                  disabled={isDeletingUser}
                  onClick={async () => {
                    if (!userPendingDelete) return;
                    setIsDeletingUser(true);
                    setDeleteErrorMsg('');
                    try {
                      const deletedUsername = userPendingDelete.username;
                      const targetId = userPendingDelete.id;
                      // Direct client storage purge
                      deleteUserPermanently(targetId);
                      // App.tsx handler (state update + server DELETE)
                      await onDeleteUser(targetId);
                      setDeleteSuccessToast(`Account @${deletedUsername} was successfully deleted.`);
                      setUserPendingDelete(null);
                      setTimeout(() => setDeleteSuccessToast(''), 4500);
                    } catch (err: any) {
                      setDeleteErrorMsg(err?.message || 'Failed to delete account. Please try again.');
                    } finally {
                      setIsDeletingUser(false);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 active:scale-95 text-white transition-all shadow-md shadow-rose-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeletingUser ? 'Deleting Account...' : 'Yes, Delete Account'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
