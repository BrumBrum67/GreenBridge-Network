import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  LogIn, 
  LogOut, 
  UserCircle, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  Settings as SettingsIcon,
  User,
  Plus,
  Search,
  Building2,
  ChevronRight,
  Tag,
  Truck,
  MapPin,
  Award,
  BarChart3,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Upload,
  X,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp,
  onSnapshot,
  collection,
  query,
  where
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { translations, Language } from './translations';

// --- Constants ---
const MATERIAL_TAGS = [
  'Biomassa', 'Plastic reststromen', 'Metaalafval', 'Textielvezels', 'Groen waterstof',
  'Zonne-energie', 'Windenergie', 'Warmte-terugwinning', 'Circulaire verpakkingen', 'Bio-based materialen',
  'Chemische recycling', 'Composteerbare plastics', 'Duurzaam hout', 'Gerecycled beton', 'Elektronisch afval',
  'Industrieel afvalwater', 'CO2-afvang', 'Logistieke optimalisatie', 'Duurzame landbouwproducten', 'Hernieuwbare brandstoffen',
  'Grondstoffen', 'Energie-oplossingen', 'Recycling-partners', 'Logistieke diensten', 'Certificering-advies',
  'Subsidie-ondersteuning', 'Technologie-leveranciers', 'Afvalverwerkers', 'Onderzoek & Ontwikkeling', 'Productie-capaciteit',
  'Opslagruimte', 'Verpakkingsmateriaal', 'Waterzuivering', 'CO2-compensatie', 'Duurzaamheid-audits',
  'Juridisch advies', 'Marketing-ondersteuning', 'Netwerk-events', 'Financiering', 'Talent & Expertise'
];

const QUANTITY_OPTIONS = ['< 10t', '10-50t', '50-100t', '100-500t', '> 500t'];
const FREQUENCY_OPTIONS = ['Continu', 'Seizoensgebonden', 'Projectmatig', 'Eenmalig'];
const REGION_OPTIONS = ['Drenthe', 'Emsland', 'Leer', 'Osnabrück', 'anders'];
const CERT_OPTIONS = ['ISO 14001', 'ISCC', 'FSC', 'geen'];
const TRANSPORT_OPTIONS = ['eigen transport', 'partner gezocht', 'beide'];

// --- Types ---
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  organization: string;
  tier: string;
  photoURL?: string;
  verified: boolean;
  onboarded: boolean;
  createdAt?: any;
}

interface CompanyProfile {
  uid: string;
  description: string;
  offers: string[];
  seeks: string;
  quantityPerYear: string;
  frequency: string;
  wasteProcessing: string;
  certifications: string[];
  transportPreference: string[];
  borderRegion: string;
  logoUrl?: string;
  createdAt?: any;
  displayName?: string;
  organization?: string;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('nl');
  const [activeTab, setActiveTab] = useState('Matches');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Auth Form State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Onboarding Form State
  const [onboardingForm, setOnboardingForm] = useState({
    description: '',
    offers: [] as string[],
    seeks: '',
    quantityPerYear: QUANTITY_OPTIONS[0],
    frequency: FREQUENCY_OPTIONS[0],
    wasteProcessing: '',
    certifications: [] as string[],
    transportPreference: [] as string[],
    borderRegion: REGION_OPTIONS[0],
    logoUrl: ''
  });

  const [seekSearch, setSeekSearch] = useState('');
  const [showSeekDropdown, setShowSeekDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Matching State
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [myCompany, setMyCompany] = useState<CompanyProfile | null>(null);

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    displayName: '',
    organization: ''
  });

  const t = translations[language];

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setProfile(data);
          setSettingsForm({
            displayName: data.displayName || currentUser.displayName || '',
            organization: data.organization || ''
          });
        } else {
          // Initialize profile
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || '',
            organization: '',
            tier: 'Participant',
            photoURL: currentUser.photoURL || null,
            verified: true,
            onboarded: false,
            createdAt: serverTimestamp()
          };
          await setDoc(doc(db, 'users', currentUser.uid), newProfile);
          setProfile(newProfile);
          setSettingsForm({
            displayName: newProfile.displayName,
            organization: ''
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Profile Real-time Listener
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (doc) => {
      if (doc.exists()) {
        setProfile(doc.data() as UserProfile);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });
    return () => unsubscribe();
  }, [user]);

  // Companies Listener
  useEffect(() => {
    if (!user || !profile?.onboarded) return;
    
    // Fetch my company first
    const fetchMyCompany = async () => {
      const myDoc = await getDoc(doc(db, 'companies', user.uid));
      if (myDoc.exists()) {
        setMyCompany(myDoc.data() as CompanyProfile);
      }
    };
    fetchMyCompany();

    const q = query(collection(db, 'companies'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allDocs = snapshot.docs.map(d => ({ ...d.data() } as CompanyProfile));
      const others = allDocs.filter(c => c.uid !== user.uid);
      setCompanies(others);
    });
    return () => unsubscribe();
  }, [user, profile?.onboarded]);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      if (authMode === 'register') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password authentication is not enabled in the Firebase Console. Please enable it in the "Sign-in method" tab.');
      } else {
        setError(err.message);
      }
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: settingsForm.displayName,
        organization: settingsForm.organization
      }, { merge: true });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      setError(t.common.error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("User not authenticated");
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      // 1. Save company data
      const companyData = {
        ...onboardingForm,
        uid: user.uid,
        displayName: profile?.displayName || user.displayName || email.split('@')[0],
        organization: profile?.organization || '',
        createdAt: serverTimestamp()
      };
      
      console.log('Submitting company data:', companyData);
      await setDoc(doc(db, 'companies', user.uid), companyData);

      // 2. Update user profile as onboarded
      await setDoc(doc(db, 'users', user.uid), { 
        onboarded: true,
        displayName: companyData.displayName,
        organization: companyData.organization
      }, { merge: true });
      
      // Update local profile state immediately
      setProfile(prev => prev ? { ...prev, onboarded: true } : null);
      setMyCompany(companyData as unknown as CompanyProfile);
      
      console.log('Onboarding successful');
      setActiveTab('Matches');
    } catch (err: any) {
      console.error('Onboarding Error:', err);
      handleFirestoreError(err, OperationType.CREATE, 'companies');
      setError(err.message || t.common.error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | null = null;
    if ('files' in e.target && e.target.files) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e && e.dataTransfer.files) {
      file = e.dataTransfer.files[0];
    }

    if (file) {
      if (file.size > 500000) { // 500KB limit for Base64 storage in Firestore
        setError("Logo too large (max 500KB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setOnboardingForm(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleTag = (tag: string) => {
    setOnboardingForm(prev => ({
      ...prev,
      offers: prev.offers.includes(tag) 
        ? prev.offers.filter(t => t !== tag) 
        : [...prev.offers, tag]
    }));
  };

  const toggleCert = (cert: string) => {
    setOnboardingForm(prev => ({
      ...prev,
      certifications: prev.certifications.includes(cert)
        ? prev.certifications.filter(c => c !== cert)
        : [...prev.certifications, cert]
    }));
  };

  const toggleTransport = (opt: string) => {
    setOnboardingForm(prev => ({
      ...prev,
      transportPreference: prev.transportPreference.includes(opt)
        ? prev.transportPreference.filter(o => o !== opt)
        : [...prev.transportPreference, opt]
    }));
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[14px] font-medium text-[var(--color-text-secondary)]">{t.common.loading}</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)] p-6">
        <div className="absolute top-10 right-10 flex bg-white p-1 rounded-xl border border-[var(--color-border-subtle)] shadow-sm">
          {(['en', 'nl', 'de'] as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-4 py-2 rounded-lg text-[12px] font-bold transition-all ${
                language === lang ? 'bg-[var(--color-bg-secondary)] text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-10 rounded-3xl border border-[var(--color-border-subtle)] shadow-2xl shadow-green-900/5"
        >
          <div className="w-16 h-16 bg-[var(--color-bg-secondary)] rounded-2xl flex items-center justify-center mx-auto mb-8">
            <ShieldCheck size={32} className="text-[var(--color-accent)]" />
          </div>
          <h1 className="text-[28px] font-bold mb-2 tracking-tight text-center">{t.auth.title}</h1>
          <p className="text-[14px] text-[var(--color-text-secondary)] mb-8 text-center">
            {t.auth.subtitle}
          </p>

          <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
            <div className="relative">
              <Mail className="absolute left-3 top-3 text-[var(--color-text-secondary)]" size={18} />
              <input 
                type="email" 
                placeholder={t.auth.email}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xl text-[14px] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-[var(--color-text-secondary)]" size={18} />
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder={t.auth.password}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xl text-[14px] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <button type="submit" className="btn w-full py-3 font-bold">
              {authMode === 'login' ? t.auth.login : t.auth.register}
            </button>
            <button 
              type="button"
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="w-full text-[12px] text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
            >
              {authMode === 'login' ? "Don't have an account? Register" : "Already have an account? Login"}
            </button>
          </form>

          <div className="relative flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
            <span className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase">{t.auth.or}</span>
            <div className="flex-1 h-px bg-[var(--color-border-subtle)]" />
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 border border-[var(--color-border-subtle)] rounded-xl text-[14px] font-bold hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <Globe size={18} /> {t.common.authenticate}
          </button>

          {error && (
            <div className="mt-6 p-4 bg-red-50 text-red-600 text-[13px] rounded-xl flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Onboarding Flow
  if (!profile?.onboarded) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] p-10 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[var(--color-accent)] rounded-xl flex items-center justify-center shadow-lg">
                <Globe size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-[24px] font-bold leading-none">{t.onboarding.title}</h1>
                <p className="text-[14px] text-[var(--color-text-secondary)]">{t.onboarding.subtitle}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-[13px] font-bold text-red-600 hover:underline">{t.common.signOut}</button>
          </div>

          <form onSubmit={handleOnboardingSubmit} className="space-y-10 bg-white p-10 rounded-3xl border border-[var(--color-border-subtle)] shadow-xl shadow-green-900/5">
            <section>
              <h2 className="text-[16px] font-bold mb-6 flex items-center gap-2">
                <Building2 size={18} className="text-[var(--color-accent)]" /> {t.settings.profileInfo}
              </h2>
              <div className="space-y-6">
                <div>
                  <label className="text-[11px] uppercase font-bold text-[var(--color-text-secondary)] mb-2 block">{t.common.description}</label>
                  <textarea 
                    required
                    rows={3}
                    value={onboardingForm.description}
                    onChange={(e) => setOnboardingForm({...onboardingForm, description: e.target.value})}
                    className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xl text-[14px] focus:outline-none focus:border-[var(--color-accent)] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] uppercase font-bold text-[var(--color-text-secondary)] mb-3 block">{t.common.offers}</label>
                  <div className="flex flex-wrap gap-2">
                    {MATERIAL_TAGS.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border ${
                          onboardingForm.offers.includes(tag)
                            ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                            : 'bg-white text-[var(--color-text-secondary)] border-[var(--color-border-subtle)] hover:border-[var(--color-accent)]'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <label className="text-[11px] uppercase font-bold text-[var(--color-text-secondary)] mb-2 block">{t.common.seeks}</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      required
                      placeholder="Search for a preset..."
                      value={onboardingForm.seeks || seekSearch}
                      onFocus={() => setShowSeekDropdown(true)}
                      onChange={(e) => {
                        setSeekSearch(e.target.value);
                        setOnboardingForm(prev => ({ ...prev, seeks: '' }));
                      }}
                      className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xl text-[14px] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                    />
                    <ChevronDown className="absolute right-4 top-3.5 text-[var(--color-text-secondary)] pointer-events-none" size={16} />
                  </div>
                  
                  <AnimatePresence>
                    {showSeekDropdown && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 left-0 right-0 mt-2 bg-white border border-[var(--color-border-subtle)] rounded-xl shadow-xl max-h-[200px] overflow-y-auto"
                      >
                        {MATERIAL_TAGS.filter(tag => tag.toLowerCase().includes(seekSearch.toLowerCase())).map(tag => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => {
                              setOnboardingForm(prev => ({ ...prev, seeks: tag }));
                              setSeekSearch(tag);
                              setShowSeekDropdown(false);
                            }}
                            className="w-full text-left px-4 py-3 text-[14px] hover:bg-[var(--color-bg-secondary)] transition-colors border-b border-[var(--color-border-subtle)] last:border-0"
                          >
                            {tag}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {showSeekDropdown && (
                    <div className="fixed inset-0 z-40" onClick={() => setShowSeekDropdown(false)} />
                  )}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="text-[11px] uppercase font-bold text-[var(--color-text-secondary)] mb-2 block">{t.common.quantity}</label>
                <select 
                  value={onboardingForm.quantityPerYear}
                  onChange={(e) => setOnboardingForm({...onboardingForm, quantityPerYear: e.target.value})}
                  className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xl text-[14px] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                >
                  {QUANTITY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] uppercase font-bold text-[var(--color-text-secondary)] mb-2 block">{t.common.frequency}</label>
                <select 
                  value={onboardingForm.frequency}
                  onChange={(e) => setOnboardingForm({...onboardingForm, frequency: e.target.value})}
                  className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xl text-[14px] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                >
                  {FREQUENCY_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </section>

            <section>
              <label className="text-[11px] uppercase font-bold text-[var(--color-text-secondary)] mb-2 block">{t.common.wasteProcessing}</label>
              <input 
                type="text" 
                maxLength={100}
                required
                value={onboardingForm.wasteProcessing}
                onChange={(e) => setOnboardingForm({...onboardingForm, wasteProcessing: e.target.value})}
                className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xl text-[14px] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div>
                <label className="text-[11px] uppercase font-bold text-[var(--color-text-secondary)] mb-4 block">{t.common.certifications}</label>
                <div className="space-y-2">
                  {CERT_OPTIONS.map(cert => (
                    <label key={cert} className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox"
                        checked={onboardingForm.certifications.includes(cert)}
                        onChange={() => toggleCert(cert)}
                        className="w-4 h-4 rounded border-[var(--color-border-subtle)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                      <span className="text-[14px] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">{cert}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase font-bold text-[var(--color-text-secondary)] mb-4 block">{t.common.transport}</label>
                <div className="space-y-2">
                  {TRANSPORT_OPTIONS.map(opt => (
                    <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox"
                        checked={onboardingForm.transportPreference.includes(opt)}
                        onChange={() => toggleTransport(opt)}
                        className="w-4 h-4 rounded border-[var(--color-border-subtle)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                      />
                      <span className="text-[14px] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="text-[11px] uppercase font-bold text-[var(--color-text-secondary)] mb-2 block">{t.common.region}</label>
                <select 
                  value={onboardingForm.borderRegion}
                  onChange={(e) => setOnboardingForm({...onboardingForm, borderRegion: e.target.value})}
                  className="w-full px-4 py-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-xl text-[14px] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                >
                  {REGION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] uppercase font-bold text-[var(--color-text-secondary)] mb-2 block">{t.common.uploadLogo}</label>
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleLogoUpload(e); }}
                  className={`relative h-[120px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all ${
                    isDragging ? 'border-[var(--color-accent)] bg-green-50' : 'border-[var(--color-border-subtle)] hover:border-[var(--color-accent)]'
                  }`}
                >
                  {onboardingForm.logoUrl ? (
                    <div className="relative w-full h-full flex items-center justify-center p-4">
                      <img src={onboardingForm.logoUrl} alt="Logo Preview" className="max-h-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setOnboardingForm(prev => ({ ...prev, logoUrl: '' }))}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload size={24} className="text-[var(--color-text-secondary)] mb-2" />
                      <span className="text-[12px] text-[var(--color-text-secondary)] font-medium">Drag & drop or click to upload</span>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </>
                  )}
                </div>
              </div>
            </section>

            <div className="pt-6 border-t border-[var(--color-border-subtle)]">
              <button 
                type="submit" 
                disabled={isSaving}
                className="btn w-full py-4 text-[16px] font-bold flex items-center justify-center gap-2"
              >
                {isSaving ? <Clock size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                {isSaving ? t.common.saving : t.common.submit}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-sans">
      {/* Header */}
      <header className="h-[72px] border-b border-[var(--color-border-subtle)] flex items-center justify-between px-10 shrink-0 bg-white/90 backdrop-blur-md z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--color-accent)] rounded-lg flex items-center justify-center shadow-lg shadow-green-900/10">
            <Globe size={18} className="text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-[18px] tracking-[-0.5px] text-[var(--color-accent)] leading-none">GREENBRIDGE</span>
            <span className="text-[10px] font-bold tracking-[2px] text-[var(--color-text-secondary)]">NETWORK</span>
          </div>
        </div>
        
        <nav className="flex gap-8">
          {[
            { id: 'Matches', label: t.common.matches, icon: Search },
            { id: 'Settings', label: t.common.settings, icon: SettingsIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-[13px] font-medium transition-colors relative py-2 flex items-center gap-2 ${
                activeTab === tab.id ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="flex bg-[var(--color-bg-secondary)] p-1 rounded-xl border border-[var(--color-border-subtle)] mr-2">
            {(['en', 'nl', 'de'] as Language[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                  language === lang ? 'bg-white shadow-sm text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-[12px] font-bold">{profile?.displayName}</div>
            <div className="text-[10px] text-[var(--color-accent)] font-bold uppercase tracking-wider">{profile?.tier} {t.common.member}</div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] flex items-center justify-center overflow-hidden shadow-sm">
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserCircle size={24} className="text-[var(--color-text-secondary)]" />
            )}
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
            title={t.common.signOut}
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-white">
        <AnimatePresence mode="wait">
          {activeTab === 'Matches' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-[60px_80px] max-w-[1200px] mx-auto"
            >
              <div className="mb-12">
                <h1 className="text-[42px] font-semibold mb-2 tracking-[-1.5px]">{t.matches.title}</h1>
                <p className="text-[16px] text-[var(--color-text-secondary)]">{t.matches.subtitle}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {(() => {
                  const supplyMatches = companies.filter(c => 
                    myCompany?.seeks && c.offers.includes(myCompany.seeks)
                  );
                  
                  const demandMatches = companies.filter(c => 
                    !supplyMatches.includes(c) && // avoid duplicates
                    myCompany?.offers.some(offer => c.seeks === offer)
                  );

                  const allMatches = [...supplyMatches, ...demandMatches];
                  
                  if (allMatches.length === 0) {
                    return (
                      <div className="col-span-full p-20 border border-dashed border-[var(--color-border-subtle)] rounded-3xl text-center">
                        <Search size={48} className="text-[var(--color-text-secondary)] opacity-20 mx-auto mb-4" />
                        <p className="text-[16px] text-[var(--color-text-secondary)]">{t.matches.noMatches}</p>
                        <p className="text-[12px] text-[var(--color-text-secondary)] mt-2 italic">
                          Tip: {myCompany?.seeks ? `We are looking for companies that offer "${myCompany.seeks}"` : 'Update your profile to see matches.'}
                        </p>
                      </div>
                    );
                  }

                  return allMatches.map((company) => {
                    const isSupplyMatch = supplyMatches.includes(company);
                    const isDemandMatch = demandMatches.includes(company);

                    return (
                      <motion.div 
                        key={company.uid}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-8 bg-white border border-[var(--color-border-subtle)] rounded-3xl hover:border-[var(--color-accent)] transition-all group shadow-sm hover:shadow-xl hover:shadow-green-900/5"
                      >
                        <div className="flex items-start gap-6 mb-6">
                          <div className="w-16 h-16 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] flex items-center justify-center overflow-hidden shrink-0">
                            {company.logoUrl ? (
                              <img src={company.logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Building2 size={32} className="text-[var(--color-text-secondary)]" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className="text-[20px] font-bold">{company.organization || company.displayName}</h3>
                              <div className="flex gap-2">
                                {isSupplyMatch && (
                                  <span className="px-2 py-1 bg-green-50 text-[var(--color-accent)] text-[10px] font-bold rounded uppercase tracking-wider border border-green-100">
                                    Supplier
                                  </span>
                                )}
                                {isDemandMatch && (
                                  <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase tracking-wider border border-blue-100">
                                    Customer
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-[12px] text-[var(--color-text-secondary)] font-medium">
                              <span className="flex items-center gap-1"><MapPin size={14} /> {company.borderRegion}</span>
                              <span className="flex items-center gap-1"><BarChart3 size={14} /> {company.quantityPerYear} / {company.frequency}</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-[14px] text-[var(--color-text-secondary)] leading-relaxed mb-6 line-clamp-2">
                          {company.description}
                        </p>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-[10px] uppercase font-bold text-[var(--color-text-secondary)] mb-2 flex items-center gap-1">
                                <Tag size={12} /> {t.common.offers}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {company.offers.slice(0, 3).map(tag => (
                                  <span key={tag} className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                                    myCompany?.seeks === tag ? 'bg-green-100 border-green-200 text-green-700' : 'bg-[var(--color-bg-secondary)] border-[var(--color-border-subtle)]'
                                  }`}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase font-bold text-[var(--color-text-secondary)] mb-2 flex items-center gap-1">
                                <Search size={12} /> {t.common.seeks}
                              </div>
                              <div className={`px-2 py-0.5 rounded text-[10px] font-medium border inline-block ${
                                myCompany?.offers.includes(company.seeks) ? 'bg-blue-100 border-blue-200 text-blue-700' : 'bg-[var(--color-bg-secondary)] border-[var(--color-border-subtle)]'
                              }`}>
                                {company.seeks}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--color-border-subtle)]">
                            <div>
                              <div className="text-[10px] uppercase font-bold text-[var(--color-text-secondary)] mb-1 flex items-center gap-1">
                                <Award size={12} /> Certs
                              </div>
                              <div className="text-[12px] font-medium truncate">{company.certifications.join(', ') || 'None'}</div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase font-bold text-[var(--color-text-secondary)] mb-1 flex items-center gap-1">
                                <Truck size={12} /> Transport
                              </div>
                              <div className="text-[12px] font-medium truncate">{company.transportPreference.join(', ') || 'None'}</div>
                            </div>
                          </div>
                        </div>

                        <button className="btn w-full mt-8 flex items-center justify-center gap-2 py-3 group-hover:bg-[var(--color-accent)] group-hover:text-white transition-all">
                          Connect <ChevronRight size={16} />
                        </button>
                      </motion.div>
                    );
                  });
                })()}
              </div>
            </motion.div>
          )}

          {activeTab === 'Settings' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-[60px_80px] max-w-[800px] mx-auto"
            >
              <h1 className="text-[42px] font-semibold mb-12 tracking-[-1.5px]">{t.settings.title}</h1>
              
              <div className="space-y-12">
                {/* Profile Section */}
                <section>
                  <h2 className="text-[18px] font-bold mb-6 flex items-center gap-2">
                    <UserCircle size={20} className="text-[var(--color-accent)]" /> {t.settings.profileInfo}
                  </h2>
                  <form onSubmit={handleSaveSettings} className="space-y-6 bg-[var(--color-bg-secondary)] p-8 rounded-3xl border border-[var(--color-border-subtle)]">
                    <div className="flex items-center gap-8 mb-8">
                      <div className="w-24 h-24 rounded-2xl bg-white border border-[var(--color-border-subtle)] flex items-center justify-center overflow-hidden shadow-sm">
                        {profile?.photoURL ? (
                          <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User size={40} className="text-[var(--color-text-secondary)]" />
                        )}
                      </div>
                      <div>
                        <div className="text-[18px] font-bold">{profile?.displayName || user.displayName || email.split('@')[0]}</div>
                        <div className="text-[14px] text-[var(--color-text-secondary)]">{profile?.email}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[11px] uppercase font-bold text-[var(--color-text-secondary)] mb-2 block">{t.settings.displayName}</label>
                        <input 
                          type="text" 
                          value={settingsForm.displayName}
                          onChange={(e) => setSettingsForm({...settingsForm, displayName: e.target.value})}
                          className="w-full px-4 py-3 bg-white border border-[var(--color-border-subtle)] rounded-xl text-[14px] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] uppercase font-bold text-[var(--color-text-secondary)] mb-2 block">{t.settings.organization}</label>
                        <input 
                          type="text" 
                          value={settingsForm.organization}
                          onChange={(e) => setSettingsForm({...settingsForm, organization: e.target.value})}
                          className="w-full px-4 py-3 bg-white border border-[var(--color-border-subtle)] rounded-xl text-[14px] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between">
                      <button 
                        type="submit" 
                        disabled={isSaving}
                        className="btn flex items-center gap-2 px-8 py-3"
                      >
                        {isSaving ? <Clock size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        {isSaving ? t.common.saving : t.common.save}
                      </button>
                      {saveSuccess && (
                        <span className="text-green-600 text-[13px] font-medium flex items-center gap-1">
                          <CheckCircle2 size={14} /> {t.common.saved}
                        </span>
                      )}
                    </div>
                  </form>
                </section>

                {/* Security Section */}
                <section>
                  <h2 className="text-[18px] font-bold mb-6 flex items-center gap-2">
                    <ShieldCheck size={20} className="text-[var(--color-accent)]" /> {t.settings.security}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 border border-[var(--color-border-subtle)] rounded-2xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-50 rounded-lg">
                          <ShieldCheck size={18} className="text-[var(--color-accent)]" />
                        </div>
                        <h3 className="font-bold text-[14px]">{t.settings.mfa}</h3>
                      </div>
                      <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                        {t.settings.mfaDesc}
                      </p>
                    </div>
                    <div className="p-6 border border-[var(--color-border-subtle)] rounded-2xl">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <Clock size={18} className="text-blue-600" />
                        </div>
                        <h3 className="font-bold text-[14px]">{t.settings.session}</h3>
                      </div>
                      <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                        {t.settings.sessionDesc}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="h-12 border-t border-[var(--color-border-subtle)] bg-white px-10 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-6 text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
            {t.common.status}: {t.common.operational}
          </div>
          <div className="h-4 w-px bg-[var(--color-border-subtle)]" />
          <div className="flex items-center gap-2">
            <ShieldCheck size={12} className="text-[var(--color-accent)]" />
            {t.common.trustLevel}: {t.common.verified}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-[10px] text-[var(--color-text-secondary)] font-bold uppercase tracking-wider">
            {t.common.localTime}: {currentTime}
          </div>
        </div>
      </footer>
    </div>
  );
}

