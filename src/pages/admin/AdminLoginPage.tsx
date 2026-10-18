import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  User as UserIcon,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles,
  Key,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { isFirebaseConfigured, DEFAULT_DATABASE_URL } from '../../config/firebase';

export const AdminLoginPage: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/admin/dashboard';

  // If already authenticated, redirect immediately
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedId = identifier.trim();
    const trimmedPass = password.trim();

    if (!trimmedId || !trimmedPass) {
      setErrorMessage('Please provide both administrator ID/username and password.');
      return;
    }

    try {
      setLoading(true);
      await login(trimmedId, trimmedPass);
      toast.success('Administrator Verified', 'Welcome to CampusNotes Admin Hub.');
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Admin login error:', err);

      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        setErrorMessage('Invalid administrator credentials. Please check your username/email and password.');
      } else if (msg.includes('Access Denied')) {
        setErrorMessage(msg);
      } else if (msg.includes('network-request-failed')) {
        setErrorMessage('Network connection error. Check your internet connection.');
      } else {
        setErrorMessage(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFillDevCredentials = () => {
    setIdentifier('admin');
    setPassword('admin');
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-6 sm:py-12">
      <div className="w-full max-w-md space-y-5 sm:space-y-6">
        {/* Portal Icon & Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-lg bg-blue-600 text-white items-center justify-center mb-1 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Administrator Login
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Sign in to manage CampusNotes study materials
          </p>
        </div>

        {/* Development Setup Callout */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2">
            <Key className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-semibold text-slate-800">Initial Setup Credentials</p>
              <p className="text-[11px] text-slate-500">
                User: <code className="bg-slate-200/70 px-1 py-0.5 rounded font-mono font-medium">admin</code> &bull; Password: <code className="bg-slate-200/70 px-1 py-0.5 rounded font-mono font-medium">admin</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleFillDevCredentials}
            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 active:text-blue-900 underline whitespace-nowrap self-start sm:self-auto min-h-[32px] inline-flex items-center"
          >
            Use Setup Credentials
          </button>
        </div>

        {/* Warning if Firebase not configured */}
        {!isFirebaseConfigured && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Firebase Notice</span>
            </div>
            <p className="text-amber-800 leading-relaxed break-words">
              Firebase configuration pending in <code>.env</code>. Local development credentials (<code className="font-mono font-semibold">admin/admin</code>) are active.
            </p>
          </div>
        )}

        {/* Login Form Card */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed font-medium break-words">{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Admin ID / Username or Email
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin"
                  className="w-full min-h-[44px] pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Enter <strong className="text-slate-600 font-mono">admin</strong> or your registered email address.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin"
                  className="w-full min-h-[44px] pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 text-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In as Administrator</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-400">
              Ordinary public users cannot access administrative operations.
            </p>
          </div>
        </div>

        {/* First-time Admin Provisioning Documentation Accordion */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            className="w-full min-h-[44px] px-4 sm:px-5 py-3 flex items-center justify-between text-left text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Production Admin Provisioning Guide</span>
            </span>
            {showSetupGuide ? (
              <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
            )}
          </button>

          {showSetupGuide && (
            <div className="px-4 sm:px-5 pb-5 pt-1 text-xs text-slate-600 space-y-3 border-t border-slate-200/80 animate-in fade-in">
              <p className="leading-relaxed">
                For production deployment, provision a dedicated administrator through Firebase Authentication:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 pl-1 text-[11px] text-slate-700 break-words">
                <li>
                  Run the provisioning helper: <code>node scripts/init-admin.mjs</code>.
                </li>
                <li>
                  Or open <strong>Firebase Console &rarr; Authentication &rarr; Users</strong> and add user:
                  <div className="mt-1 font-mono text-[10px] text-blue-700 break-all">admin@campusnotes.internal</div>
                </li>
                <li>
                  Copy the generated <strong>User UID</strong>.
                </li>
                <li>
                  In Realtime Database (<code>{DEFAULT_DATABASE_URL}</code>), register:
                  <div className="mt-1 font-mono text-[10px] text-emerald-700 break-all">admins/&lt;UID&gt;: true</div>
                </li>
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
