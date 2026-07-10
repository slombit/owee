import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { db } from "./firebase.js";
import { ref, onValue, set, remove } from "firebase/database";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, updatePassword } from "firebase/auth";

// ── Theme tokens ──────────────────────────────────────────────────────────────
const LIGHT = {
  bg:        "#f7f7f5",
  surface:   "white",
  border:    "#f0f0ed",
  border2:   "#e8e8e5",
  text:      "#1a1a1a",
  textSub:   "#888",
  textMuted: "#bbb",
  header:    "#1a1a1a",
  headerText:"white",
  input:     "white",
  rowBg:     "#f7f7f5",
  green:     "#4CAF82",
  orange:    "#E8734A",
  paidBg:    "#f0faf5",
  paidBorder:"#c8eedd",
};
const DARK = {
  bg:        "#0f0f13",
  surface:   "#1a1a24",
  border:    "#2a2a38",
  border2:   "#333344",
  text:      "#f0ede8",
  textSub:   "#888",
  textMuted: "#555",
  header:    "#1a1a24",
  headerText:"#f0ede8",
  input:     "#13131c",
  rowBg:     "#13131c",
  green:     "#4CAF82",
  orange:    "#E8734A",
  paidBg:    "#0d1f17",
  paidBorder:"#1a4030",
};

// ── Constantes ────────────────────────────────────────────────────────────────
const COLORS  = ["#1a1a1a","#555","#4A90D9","#E8734A","#4CAF82","#9B59B6","#E74C3C","#F39C12","#16A085","#e91e8c"];
const PASTEL  = ["#f5f5f5","#eee","#ddeeff","#fdeee8","#e8f8ef","#f3eaf8","#fde8e8","#fef6e4","#e4f4f1","#fce4f3"];
const CURRENCIES = [
  { code:"UYU", symbol:"$U", name:"Peso uruguayo" },
  { code:"USD", symbol:"US$", name:"Dólar americano" },
  { code:"ARS", symbol:"$AR", name:"Peso argentino" },
  { code:"BRL", symbol:"R$", name:"Real brasileño" },
  { code:"EUR", symbol:"€",  name:"Euro" },
];
const CHART_COLORS = ["#1a1a1a","#4A90D9","#E8734A","#4CAF82","#9B59B6","#E74C3C","#F39C12","#16A085","#e91e8c","#555"];
const CATEGORIES = [
  { code:"comida",     label:"Comida",      icon:"🍕" },
  { code:"transporte", label:"Transporte",  icon:"🚗" },
  { code:"alojamiento",label:"Alojamiento", icon:"🏠" },
  { code:"entretenimiento", label:"Entretenimiento", icon:"🎉" },
  { code:"compras",    label:"Compras",     icon:"🛍️" },
  { code:"salud",      label:"Salud",       icon:"💊" },
  { code:"otro",       label:"Otro",        icon:"📦" },
];
const getCategory = (code) => CATEGORIES.find(c=>c.code===code) || CATEGORIES[CATEGORIES.length-1];

// ── i18n ──────────────────────────────────────────────────────────────────────
const TRANSLATIONS = {
  es: {
    tagline: "Dividí gastos sin drama",
    newGroup: "Nuevo grupo", join: "Unirse", active: "Activos",
    noActiveGroups: "No tenés grupos activos", createOrJoin: "Creá uno o unite con un código",
    total: "total", people: "personas", expenses: "gastos", noPeople: "Sin personas",
    tabExpenses: "Gastos", tabPeople: "Personas", tabAccounts: "Cuentas", tabChart: "Gráfica",
    share: "Compartir", copied: "Copiado!", delete: "Eliminar", copy: "copiar",
    newExpense: "Nuevo gasto", editingExpense: "Editando gasto", cancel: "Cancelar",
    description: "Descripción (pizza, taxi...)", whoPaid: "¿Quién pagó?", category: "Categoría:",
    splitBetween: "Dividir entre:", all: "Todos", receiptPhoto: "Foto del recibo (opcional):",
    addPhoto: "📷 Agregar foto", uploading: "Subiendo...",
    addFirst: "Primero agregá personas", addExpenseBtn: "Agregar gasto", saveChanges: "Guardar cambios",
    noExpensesYet: "Sin gastos todavía", paid: "pagó",
    addPerson: "Agregar persona", name: "Nombre", addPersonPrompt: "Agregá a las personas del grupo",
    balances: "Balances", addPeopleFirst: "Agregá personas primero",
    whoOwesWhom: "¿Quién paga a quién?", addPeopleAndExpenses: "Agregá personas y gastos", allSettled: "✓ Todos al día",
    owes: "debe", owed: "le deben", upToDate: "al día ✓",
    markedPaid: "pagados", allDone: "🎉 ¡Todos los pagos completados!", paidLabel: "✓ Pagado",
    equivalences: "Equivalencias", update: "actualizar", loadingRates: "Cargando tasas...",
    notAvailable: "no disponible", reference: "referencia", liveRates: "Tasas en tiempo real cuando están disponibles", refRates: "Tasas de referencia",
    expenseByPerson: "Gasto por persona", expenseByCategory: "Gasto por categoría",
    addExpensesForChart: "Agregá gastos para ver la gráfica", summary: "Resumen",
    totalSpent: "Total gastado", avgPerPerson: "Promedio por persona", expenseCount: "Cantidad de gastos",
    newGroupTitle: "Nuevo grupo", nameGroup: "Dale un nombre y elegí la moneda",
    groupNamePlaceholder: 'Ej: "Asado", "Viaje a Colonia"...', createGroupBtn: "Crear grupo",
    joinGroupTitle: "Unirse a un grupo", askCode: "Pedile el código a quien creó el grupo",
    codeInvalid: "Código inválido.", notFound: "No encontré ese grupo. Revisá el código.", joinBtn: "Unirme",
    profile: "Perfil", settings: "Configuración", logout: "Cerrar sesión",
    login: "Iniciar sesión", createAccount: "Crear cuenta", username: "Nombre de usuario",
    email: "Email", password: "Contraseña", enter: "Entrar", or: "o", continueGoogle: "Continuar con Google",
    termsNotice: "Al registrarte aceptás los términos de uso de Owee",
    settingsTitle: "Configuración", accountDetails: "Detalles de la cuenta",
    profilePhoto: "Foto de perfil", changePhoto: "Cambiar foto", newPassword: "Nueva contraseña (opcional)",
    save: "Guardar", saved: "Guardado ✓", appearance: "Apariencia", darkMode: "Modo oscuro", lightMode: "Modo claro",
    language: "Idioma", spanish: "Español", english: "English",
    activeGroups: "Grupos activos", back: "Volver",
  },
  en: {
    tagline: "Split expenses, drama-free",
    newGroup: "New group", join: "Join", active: "Active",
    noActiveGroups: "You don't have active groups", createOrJoin: "Create one or join with a code",
    total: "total", people: "people", expenses: "expenses", noPeople: "No people",
    tabExpenses: "Expenses", tabPeople: "People", tabAccounts: "Balances", tabChart: "Chart",
    share: "Share", copied: "Copied!", delete: "Delete", copy: "copy",
    newExpense: "New expense", editingExpense: "Editing expense", cancel: "Cancel",
    description: "Description (pizza, taxi...)", whoPaid: "Who paid?", category: "Category:",
    splitBetween: "Split between:", all: "All", receiptPhoto: "Receipt photo (optional):",
    addPhoto: "📷 Add photo", uploading: "Uploading...",
    addFirst: "Add people first", addExpenseBtn: "Add expense", saveChanges: "Save changes",
    noExpensesYet: "No expenses yet", paid: "paid",
    addPerson: "Add person", name: "Name", addPersonPrompt: "Add people to the group",
    balances: "Balances", addPeopleFirst: "Add people first",
    whoOwesWhom: "Who pays whom?", addPeopleAndExpenses: "Add people and expenses", allSettled: "✓ Everyone is settled",
    owes: "owes", owed: "is owed", upToDate: "settled ✓",
    markedPaid: "paid", allDone: "🎉 All payments completed!", paidLabel: "✓ Paid",
    equivalences: "Equivalences", update: "refresh", loadingRates: "Loading rates...",
    notAvailable: "not available", reference: "reference", liveRates: "Live rates when available", refRates: "Reference rates",
    expenseByPerson: "Expense by person", expenseByCategory: "Expense by category",
    addExpensesForChart: "Add expenses to see the chart", summary: "Summary",
    totalSpent: "Total spent", avgPerPerson: "Average per person", expenseCount: "Number of expenses",
    newGroupTitle: "New group", nameGroup: "Give it a name and choose the currency",
    groupNamePlaceholder: 'E.g: "Dinner", "Trip to Colonia"...', createGroupBtn: "Create group",
    joinGroupTitle: "Join a group", askCode: "Ask whoever created the group for the code",
    codeInvalid: "Invalid code.", notFound: "Couldn't find that group. Check the code.", joinBtn: "Join",
    profile: "Profile", settings: "Settings", logout: "Log out",
    login: "Log in", createAccount: "Create account", username: "Username",
    email: "Email", password: "Password", enter: "Enter", or: "or", continueGoogle: "Continue with Google",
    termsNotice: "By signing up you accept Owee's terms of use",
    settingsTitle: "Settings", accountDetails: "Account details",
    profilePhoto: "Profile photo", changePhoto: "Change photo", newPassword: "New password (optional)",
    save: "Save", saved: "Saved ✓", appearance: "Appearance", darkMode: "Dark mode", lightMode: "Light mode",
    language: "Language", spanish: "Español", english: "English",
    activeGroups: "Active groups", back: "Back",
  },
};

// ── Cloudinary (para fotos de recibo) ─────────────────────────────────────────
// Completá con tus datos de Cloudinary (ver guía)
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "";
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";

const uploadReceipt = async (file) => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error("Cloudinary no está configurado todavía.");
  }
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Error al subir la imagen.");
  const data = await res.json();
  return data.secure_url;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const genId      = () => Math.random().toString(36).slice(2,11) + Math.random().toString(36).slice(2,11) + Date.now().toString(36);
const genGroupCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0/I/1 para evitar confusión
  let code = "";
  for (let i=0; i<6; i++) code += chars[Math.floor(Math.random()*chars.length)];
  return code;
};
const today     = () => new Date().toLocaleDateString("es-UY");
const sanitize  = (str, max=80) => String(str||"").trim().slice(0,max);
const safeAmt   = (val) => { const n=parseFloat(val); return (!isNaN(n)&&n>0&&n<1000000)?n:null; };
const makeGroup = (title="Nuevo grupo", currency="UYU", createdBy=null) => ({
  id: genGroupCode(), title, people:[], expenses:[], createdAt:today(), closed:false, currency, createdBy
});

const auth     = getAuth();
const gProvider= new GoogleAuthProvider();

// ── SwipeToDelete ────────────────────────────────────────────────────────────
const SwipeToDelete = ({ onDelete, children, T }) => {
  const [offsetX, setOffsetX]   = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(null);
  const THRESHOLD = 80;

  const onTouchStart = (e) => { startX.current = e.touches[0].clientX; setDragging(true); };
  const onTouchMove  = (e) => {
    if (startX.current===null) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setOffsetX(Math.max(dx, -120));
  };
  const onTouchEnd = () => {
    if (offsetX < -THRESHOLD) { onDelete(); }
    setOffsetX(0); setDragging(false); startX.current=null;
  };

  return (
    <div style={{ position:"relative", overflow:"hidden", borderRadius:20 }}>
      <div style={{ position:"absolute", right:0, top:0, bottom:0, background:"#E8734A", display:"flex", alignItems:"center", justifyContent:"center", paddingRight:20, paddingLeft:10, borderRadius:"0 20px 20px 0", minWidth:80 }}>
        <span style={{ color:"white", fontWeight:700, fontSize:13 }}>Eliminar</span>
      </div>
      <div
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        style={{ transform:`translateX(${offsetX}px)`, transition:dragging?"none":"transform 0.3s cubic-bezier(.4,0,.2,1)", position:"relative", zIndex:1, background:T.surface, borderRadius:20 }}>
        {children}
      </div>
    </div>
  );
};

// ── Logo SVG ─────────────────────────────────────────────────────────────────
const OweeLogo = ({ size = 40, dark = false }) => (
  <svg width={size * 3.2} height={size} viewBox="0 0 128 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* O */}
    <text x="0" y="32" fontFamily="'DM Sans', Arial Black, sans-serif" fontWeight="800" fontSize="36" fill={dark ? "white" : "#1a1a1a"} letterSpacing="-2">Owee</text>
  </svg>
);

const OweeLogomark = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="40" height="40" rx="10" fill="#1a1a1a"/>
    <text x="20" y="28" textAnchor="middle" fontFamily="'DM Sans', Arial Black, sans-serif" fontWeight="900" fontSize="18" fill="white" letterSpacing="-0.5">Ow</text>
  </svg>
);

// ── Componente principal ──────────────────────────────────────────────────────
export default function App() {
  // Auth
  const [user,          setUser]          = useState(null);
  const [authLoading,   setAuthLoading]   = useState(true);
  const [authScreen,    setAuthScreen]    = useState("login"); // login | register
  const [authEmail,     setAuthEmail]     = useState("");
  const [authPass,      setAuthPass]      = useState("");
  const [authUsername,  setAuthUsername]  = useState("");
  const [authError,     setAuthError]     = useState("");
  const [authLoading2,  setAuthLoading2]  = useState(false);

  // App
  const [screen,        setScreen]        = useState("home");
  const [groups,        setGroups]        = useState([]);
  const [activeId,      setActiveId]      = useState(null);
  const [tab,           setTab]           = useState("gastos");
  const [newPerson,     setNewPerson]     = useState("");
  const [newExp,        setNewExp]        = useState({ desc:"", amount:"", paidBy:"", splitWith:[], category:"otro", receiptUrl:null });
  const [editingExpId,  setEditingExpId]  = useState(null);
  const [uploadingImg,  setUploadingImg]  = useState(false);
  const [uploadError,   setUploadError]   = useState("");
  const [viewReceipt,   setViewReceipt]   = useState(null);
  const [copied,        setCopied]        = useState(false);
  const [copiedCode,    setCopiedCode]    = useState(false);
  const [showAllPaid,   setShowAllPaid]   = useState(false);
  const [darkMode,      setDarkMode]      = useState(() => {
    try { return localStorage.getItem("owee-dark")==="1"; } catch { return false; }
  });
  const [lang,          setLang]          = useState(() => {
    try { return localStorage.getItem("owee-lang") || "es"; } catch { return "es"; }
  });
  const [showSettings,  setShowSettings]  = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileEmail,    setProfileEmail]    = useState("");
  const [profilePass,     setProfilePass]     = useState("");
  const [profilePhotoFile,setProfilePhotoFile]= useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null);
  const [profileSaving,   setProfileSaving]   = useState(false);
  const [profileSaved,    setProfileSaved]    = useState(false);
  const [profileError,    setProfileError]    = useState("");

  const T = darkMode ? DARK : LIGHT;
  const t = (key) => TRANSLATIONS[lang]?.[key] || TRANSLATIONS.es[key] || key;

  useEffect(() => {
    try { localStorage.setItem("owee-dark", darkMode?"1":"0"); } catch {}
    document.body.style.background = darkMode ? DARK.bg : LIGHT.bg;
  }, [darkMode]);

  useEffect(() => {
    try { localStorage.setItem("owee-lang", lang); } catch {}
  }, [lang]);

  useEffect(() => {
    if (user) {
      setProfileUsername(user.displayName || "");
      setProfileEmail(user.email || "");
    }
  }, [user]);

  const haptic = () => { try { if (navigator.vibrate) navigator.vibrate(10); } catch {} };
  const [editTitle,     setEditTitle]     = useState(false);
  const [titleInput,    setTitleInput]    = useState("");
  const [showNewModal,  setShowNewModal]  = useState(false);
  const [newGroupName,  setNewGroupName]  = useState("");
  const [newGroupCur,   setNewGroupCur]   = useState("UYU");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode,      setJoinCode]      = useState("");
  const [joinError,     setJoinError]     = useState("");
  const [syncing,       setSyncing]       = useState(false);
  const [rates,         setRates]         = useState({});
  const [ratesLoading,  setRatesLoading]  = useState(false);
  const [showProfile,   setShowProfile]   = useState(false);

  const listeners = useRef({});
  const active    = groups.find(g => g.id === activeId);

  // ── Auth listener ───────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  // ── Cargar grupos del usuario desde Firebase ────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const userGroupsRef = ref(db, `users/${user.uid}/groups`);
    const unsub = onValue(userGroupsRef, (snap) => {
      const data = snap.val();
      if (!data) return;
      const groupIds = Object.keys(data);
      groupIds.forEach(id => subscribeToGroup(id));
    });
    return unsub;
  }, [user]);

  // ── Tipo de cambio ──────────────────────────────────────────────────────────
  // Tasas de referencia (julio 2026), se usan si las APIs en vivo fallan
  const FALLBACK_RATES = {
    UYU: { UYU:1,     USD:0.0243, ARS:26.8,  BRL:0.138, EUR:0.0225 },
    USD: { UYU:41.2,  USD:1,      ARS:1103,  BRL:5.68,  EUR:0.925  },
    ARS: { UYU:0.0373, USD:0.000907, ARS:1,  BRL:0.00515, EUR:0.000838 },
    BRL: { UYU:7.25,  USD:0.176,  ARS:194,   BRL:1,     EUR:0.163  },
    EUR: { UYU:44.5,  USD:1.081,  ARS:1192,  BRL:6.14,  EUR:1      },
  };

  const fetchRates = useCallback(async (baseCurrency="UYU") => {
    setRatesLoading(true);
    let result = null;

    // Intento 1: frankfurter.app (rápido, pero no siempre tiene todas las monedas)
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=${baseCurrency}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.rates) result = { ...data.rates, [baseCurrency]: 1 };
      }
    } catch {}

    // Intento 2: exchangerate-api (más monedas, incluye UYU/ARS)
    if (!result || Object.keys(result).length < 3) {
      try {
        const res2 = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`);
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2?.rates) result = data2.rates;
        }
      } catch {}
    }

    // Fallback final: tasas fijas de referencia
    if (!result && FALLBACK_RATES[baseCurrency]) {
      result = FALLBACK_RATES[baseCurrency];
    }

    if (result) {
      setRates(prev => ({ ...prev, [baseCurrency]: result }));
    }
    setRatesLoading(false);
  }, []);

  const convertAmount = (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return amount;
    const baseRates = rates[fromCurrency] || FALLBACK_RATES[fromCurrency];
    if (!baseRates || !baseRates[toCurrency]) return null;
    return amount * baseRates[toCurrency];
  };

  // ── Firebase: grupos ────────────────────────────────────────────────────────
  const subscribeToGroup = useCallback((groupId) => {
    if (listeners.current[groupId]) return;
    const groupRef = ref(db, `groups/${groupId}`);
    const unsub = onValue(groupRef, (snap) => {
      const data = snap.val();
      if (!data) return;
      setGroups(prev => {
        const exists = prev.find(g => g.id === groupId);
        if (!exists) return [...prev, data];
        return prev.map(g => g.id === groupId ? data : g);
      });
    });
    listeners.current[groupId] = unsub;
  }, []);

  const saveToFirebase = useCallback((group) => {
    setSyncing(true);
    const updates = {};
    updates[`groups/${group.id}`] = group;
    if (user) updates[`users/${user.uid}/groups/${group.id}`] = true;
    Promise.all(Object.entries(updates).map(([path, val]) => set(ref(db, path), val)))
      .finally(() => setTimeout(() => setSyncing(false), 600));
  }, [user]);

  const createGroup = () => {
    const name = sanitize(newGroupName, 60) || "Nuevo grupo";
    const g    = makeGroup(name, newGroupCur, user?.uid || null);
    setGroups(prev => [...prev, g]);
    saveToFirebase(g);
    subscribeToGroup(g.id);
    setActiveId(g.id);
    setScreen("group");
    setTab("gastos");
    setShowNewModal(false);
    setNewGroupName("");
    setNewGroupCur("UYU");
    fetchRates(newGroupCur);
  };

  const joinGroup = () => {
    const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,20);
    if (!code||code.length<4) { setJoinError("Código inválido."); return; }
    setJoinError("");
    const groupRef = ref(db, `groups/${code}`);
    onValue(groupRef, (snap) => {
      const data = snap.val();
      if (!data) { setJoinError("No encontré ese grupo. Revisá el código."); return; }
      setGroups(prev => { if (prev.find(g=>g.id===code)) return prev; return [...prev, data]; });
      subscribeToGroup(code);
      if (user) set(ref(db, `users/${user.uid}/groups/${code}`), true);
      setActiveId(code);
      setScreen("group");
      setTab("gastos");
      setShowJoinModal(false);
      setJoinCode("");
      fetchRates(data.currency || "UYU");
    }, { onlyOnce:true });
  };

  const updateActive = useCallback((fn) => {
    setGroups(prev => {
      const updated  = prev.map(g => g.id===activeId ? fn(g) : g);
      const newGroup = updated.find(g => g.id===activeId);
      if (newGroup) saveToFirebase(newGroup);
      return updated;
    });
  }, [activeId, saveToFirebase]);

  const deleteGroup = (id) => {
    if (listeners.current[id]) { listeners.current[id](); delete listeners.current[id]; }
    setGroups(prev => prev.filter(g => g.id!==id));
    remove(ref(db, `groups/${id}`)).catch(()=>{});
    if (user) remove(ref(db, `users/${user.uid}/groups/${id}`)).catch(()=>{});
  };

  const openGroup = (id) => {
    setActiveId(id);
    setScreen("group");
    setTab("gastos");
    const g = groups.find(g=>g.id===id);
    if (g?.currency) fetchRates(g.currency);
  };

  // ── Personas ────────────────────────────────────────────────────────────────
  const addPerson = () => {
    const name = sanitize(newPerson, 40);
    if (!name||!active||(active.people||[]).find(p=>p.name===name)) return;
    if ((active.people||[]).length>=20) return;
    const idx = (active.people||[]).length;
    updateActive(g => ({ ...g, people:[...(g.people||[]), { id:genId(), name, color:COLORS[idx%COLORS.length], bg:PASTEL[idx%PASTEL.length], addedBy:user?.uid||null }] }));
    setNewPerson("");
  };

  const removePerson = (pid) => updateActive(g => ({
    ...g,
    people:   (g.people  ||[]).filter(p=>p.id!==pid),
    expenses: (g.expenses||[]).filter(e=>e.paidBy!==pid&&!e.splitWith.includes(pid))
  }));

  // ── Gastos ──────────────────────────────────────────────────────────────────
  const resetExpForm = () => {
    setNewExp({ desc:"", amount:"", paidBy:"", splitWith:[], category:"otro", receiptUrl:null });
    setEditingExpId(null);
    setUploadError("");
  };

  const addExpense = () => {
    const cleanDesc = sanitize(newExp.desc, 100);
    const cleanAmt  = safeAmt(newExp.amount);
    const { paidBy, splitWith, category, receiptUrl } = newExp;
    if (!cleanDesc||!cleanAmt||!paidBy||splitWith.length===0) return;

    if (editingExpId) {
      updateActive(g => ({ ...g, expenses:(g.expenses||[]).map(e => e.id===editingExpId ? {
        ...e, desc:cleanDesc, amount:cleanAmt, paidBy, splitWith, category:category||"otro", receiptUrl:receiptUrl||null
      } : e) }));
    } else {
      if ((active.expenses||[]).length>=200) return;
      updateActive(g => ({ ...g, expenses:[...(g.expenses||[]), {
        id:genId(), desc:cleanDesc, amount:cleanAmt, paidBy, splitWith, date:today(), addedBy:user?.uid||null,
        category:category||"otro", receiptUrl:receiptUrl||null
      }] }));
    }
    resetExpForm();
  };

  const startEditExpense = (exp) => {
    setNewExp({ desc:exp.desc, amount:String(exp.amount), paidBy:exp.paidBy, splitWith:exp.splitWith, category:exp.category||"otro", receiptUrl:exp.receiptUrl||null });
    setEditingExpId(exp.id);
    window.scrollTo({ top:0, behavior:"smooth" });
  };

  const removeExpense = (eid) => {
    updateActive(g => ({ ...g, expenses:(g.expenses||[]).filter(e=>e.id!==eid) }));
    if (editingExpId===eid) resetExpForm();
  };
  const toggleSplit = (pid) => setNewExp(e => ({ ...e, splitWith:e.splitWith.includes(pid)?e.splitWith.filter(i=>i!==pid):[...e.splitWith,pid] }));

  const handleReceiptUpload = async (file) => {
    if (!file) return;
    if (file.size > 8*1024*1024) { setUploadError("La imagen es muy pesada (máx 8MB)."); return; }
    setUploadingImg(true); setUploadError("");
    try {
      const url = await uploadReceipt(file);
      setNewExp(x => ({ ...x, receiptUrl:url }));
    } catch (e) {
      setUploadError(e.message || "Error al subir la foto.");
    } finally {
      setUploadingImg(false);
    }
  };

  const toggleSettlement = (key) => {
    updateActive(g => ({
      ...g,
      paidSettlements: {
        ...(g.paidSettlements||{}),
        [key]: !(g.paidSettlements||{})[key]
      }
    }));
  };

  // ── Cálculos ─────────────────────────────────────────────────────────────────
  const getBalances = (group) => {
    const bal = {};
    (group.people  ||[]).forEach(p   => bal[p.id]=0);
    (group.expenses||[]).forEach(exp => {
      const share = exp.amount/exp.splitWith.length;
      exp.splitWith.forEach(pid => { bal[pid]=(bal[pid]||0)-share; });
      bal[exp.paidBy]=(bal[exp.paidBy]||0)+exp.amount;
    });
    return bal;
  };

  const getSettlements = (group) => {
    const result=[];
    const b={...getBalances(group)};
    const ids=Object.keys(b);
    if (!ids.length) return [];
    for (let i=0;i<30;i++) {
      const cr =ids.reduce((a,c)=>b[c]>b[a]?c:a,ids[0]);
      const db2=ids.reduce((a,c)=>b[c]<b[a]?c:a,ids[0]);
      if (Math.abs(b[cr])<0.01) break;
      const amt=Math.min(b[cr],-b[db2]);
      if (amt<0.01) break;
      result.push({ from:db2, to:cr, amount:Math.round(amt*100)/100 });
      b[cr]-=amt; b[db2]+=amt;
    }
    return result;
  };

  // ── Gráfica de gastos por persona ────────────────────────────────────────────
  const getChartData = (group) => {
    const totals = {};
    (group.people||[]).forEach(p => totals[p.id]=0);
    (group.expenses||[]).forEach(exp => {
      const share = exp.amount/exp.splitWith.length;
      exp.splitWith.forEach(pid => { totals[pid]=(totals[pid]||0)+share; });
    });
    const total = Object.values(totals).reduce((s,v)=>s+v,0);
    return (group.people||[]).map((p,i) => ({
      name:   p.name,
      amount: totals[p.id]||0,
      pct:    total>0?Math.round(((totals[p.id]||0)/total)*100):0,
      color:  CHART_COLORS[i%CHART_COLORS.length]
    })).sort((a,b)=>b.amount-a.amount);
  };

  const getChartDataByCategory = (group) => {
    const totals = {};
    (group.expenses||[]).forEach(exp => {
      const cat = exp.category || "otro";
      totals[cat] = (totals[cat]||0) + exp.amount;
    });
    const total = Object.values(totals).reduce((s,v)=>s+v,0);
    return Object.keys(totals).map((code,i) => {
      const cat = getCategory(code);
      return {
        name:   cat.label,
        icon:   cat.icon,
        amount: totals[code],
        pct:    total>0?Math.round((totals[code]/total)*100):0,
        color:  CHART_COLORS[i%CHART_COLORS.length]
      };
    }).sort((a,b)=>b.amount-a.amount);
  };

  // ── Compartir ────────────────────────────────────────────────────────────────
  const shareGroup = useCallback(() => {
    if (!active) return;
    const cur      = CURRENCIES.find(c=>c.code===(active.currency||"UYU"));
    const sym      = cur?.symbol||"$";
    const total    = (active.expenses||[]).reduce((s,e)=>s+e.amount,0);
    const settles  = getSettlements(active);
    const people   = active.people  ||[];
    const expenses = active.expenses||[];
    let msg=`🧾 *${active.title}*\n📅 ${active.createdAt}\n👥 ${people.map(p=>p.name).join(", ")}\n💰 Total: *${sym}${total.toFixed(2)}*\n🔑 Código: \`${active.id}\`\n\n`;
    if (expenses.length>0) {
      msg+=`📋 *Gastos:*\n`;
      expenses.forEach(exp => {
        const payer=people.find(p=>p.id===exp.paidBy);
        msg+=`• ${exp.desc}: ${sym}${exp.amount.toFixed(2)} (pagó ${payer?.name||"?"})\n`;
      });
      msg+=`\n`;
    }
    if (settles.length===0) msg+=`✅ *Todos al día!*\n`;
    else {
      msg+=`💸 *¿Quién paga a quién?*\n`;
      settles.forEach(s => {
        const from=people.find(p=>p.id===s.from);
        const to  =people.find(p=>p.id===s.to);
        msg+=`• ${from?.name} le paga *${sym}${s.amount.toFixed(2)}* a ${to?.name}\n`;
      });
    }
    msg+=`\n_Hecho con Owee_ 🤙`;
    const copy=(text)=>{
      if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}).catch(fb); } else fb();
      function fb(){const ta=document.createElement("textarea");ta.value=text;ta.style.cssText="position:fixed;opacity:0;top:0;left:0";document.body.appendChild(ta);ta.focus();ta.select();try{document.execCommand("copy");}catch{}document.body.removeChild(ta);setCopied(true);setTimeout(()=>setCopied(false),2500);}
    };
    copy(msg);
  }, [active]);

  // ── Auth actions ─────────────────────────────────────────────────────────────
  const loginGoogle = async () => {
    setAuthLoading2(true); setAuthError("");
    try { await signInWithPopup(auth, gProvider); }
    catch(e) { setAuthError("Error al iniciar con Google. Intentá de nuevo."); }
    finally { setAuthLoading2(false); }
  };

  const loginEmail = async () => {
    setAuthLoading2(true); setAuthError("");
    try { await signInWithEmailAndPassword(auth, authEmail, authPass); }
    catch(e) {
      if (e.code==="auth/invalid-credential"||e.code==="auth/wrong-password") setAuthError("Email o contraseña incorrectos.");
      else setAuthError("Error al iniciar sesión.");
    } finally { setAuthLoading2(false); }
  };

  const registerEmail = async () => {
    if (!authUsername.trim()) { setAuthError("Escribí un nombre de usuario."); return; }
    if (authPass.length<6)    { setAuthError("La contraseña debe tener al menos 6 caracteres."); return; }
    setAuthLoading2(true); setAuthError("");
    try {
      const cred = await createUserWithEmailAndPassword(auth, authEmail, authPass);
      await updateProfile(cred.user, { displayName: sanitize(authUsername,30) });
      setUser({ ...cred.user, displayName: sanitize(authUsername,30) });
    } catch(e) {
      if (e.code==="auth/email-already-in-use") setAuthError("Ese email ya está registrado.");
      else if (e.code==="auth/invalid-email")   setAuthError("Email inválido.");
      else setAuthError("Error al crear la cuenta.");
    } finally { setAuthLoading2(false); }
  };

  const logout = async () => { await signOut(auth); setGroups([]); setScreen("home"); setShowProfile(false); setShowSettings(false); };

  const handleProfilePhotoSelect = (file) => {
    if (!file) return;
    setProfilePhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setProfilePhotoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    setProfileSaving(true); setProfileError(""); setProfileSaved(false);
    try {
      let photoURL = user.photoURL;
      if (profilePhotoFile) {
        try { photoURL = await uploadReceipt(profilePhotoFile); }
        catch { /* si Cloudinary no está configurado, seguimos sin la foto */ }
      }
      const cleanUsername = sanitize(profileUsername, 30);
      if (cleanUsername && (cleanUsername !== user.displayName || photoURL !== user.photoURL)) {
        await updateProfile(auth.currentUser, { displayName: cleanUsername, photoURL });
      }
      if (profilePass && profilePass.length >= 6) {
        await updatePassword(auth.currentUser, profilePass);
      } else if (profilePass && profilePass.length > 0) {
        setProfileError("La contraseña debe tener al menos 6 caracteres.");
        setProfileSaving(false);
        return;
      }
      setUser({ ...auth.currentUser });
      setProfilePass("");
      setProfilePhotoFile(null);
      setProfilePhotoPreview(null);
      setProfileSaved(true);
      setTimeout(()=>setProfileSaved(false), 2500);
    } catch (e) {
      if (e.code==="auth/requires-recent-login") setProfileError("Por seguridad, volvé a iniciar sesión para cambiar la contraseña.");
      else setProfileError("Error al guardar los cambios.");
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Helpers UI ───────────────────────────────────────────────────────────────
  const getPerson   = (group,id) => (group.people||[]).find(p=>p.id===id);
  const totalGastos = (g) => (g.expenses||[]).reduce((s,e)=>s+e.amount,0);
  const getCurSymbol= (code) => CURRENCIES.find(c=>c.code===code)?.symbol||"$";
  const openGroups  = groups.filter(g=>!g.closed);
  const balances    = active?getBalances(active):{};
  const settlements = active?getSettlements(active):[];
  const chartData    = active?getChartData(active):[];
  const chartDataCat = active?getChartDataByCategory(active):[];
  const curSymbol   = active?getCurSymbol(active.currency||"UYU"):"$";

  const Avatar = ({ name, photo, color, bg, size=36 }) => (
    photo
      ? <img src={photo} alt={name} style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:"1.5px solid rgba(0,0,0,0.06)" }} />
      : <div style={{ width:size, height:size, borderRadius:"50%", background:bg||"#f0f0f0", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:size*0.38, color:color||"#333", flexShrink:0, border:"1.5px solid rgba(0,0,0,0.06)" }}>
          {name?.[0]?.toUpperCase()}
        </div>
  );

  // ── Donut chart SVG ──────────────────────────────────────────────────────────
  const DonutChart = ({ data, size=160, textColor="#1a1a1a" }) => {
    const total = data.reduce((s,d)=>s+d.amount,0);
    if (total===0) return null;
    const cx=size/2, cy=size/2, r=size*0.35, stroke=size*0.18;
    let cumPct=0;
    const slices=data.map(d => {
      const pct=d.amount/total;
      const startAngle=(cumPct*360-90)*(Math.PI/180);
      const endAngle=((cumPct+pct)*360-90)*(Math.PI/180);
      cumPct+=pct;
      const x1=cx+r*Math.cos(startAngle), y1=cy+r*Math.sin(startAngle);
      const x2=cx+r*Math.cos(endAngle),   y2=cy+r*Math.sin(endAngle);
      const large=pct>0.5?1:0;
      return { ...d, path:`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, pct };
    });
    return (
      <svg width={size} height={size} style={{ overflow:"visible" }}>
        {slices.map((s,i) => (
          <path key={i} d={s.path} fill="none" stroke={s.color} strokeWidth={stroke} strokeLinecap="butt"
            style={{ transition:"stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)", opacity: s.pct<0.01?0:1 }} />
        ))}
        <text x={cx} y={cy-6} textAnchor="middle" fontSize={size*0.11} fontWeight="700" fill={textColor}>{data[0]?.name||""}</text>
        <text x={cx} y={cy+10} textAnchor="middle" fontSize={size*0.13} fontWeight="800" fill={textColor}>{data[0]?.pct||0}%</text>
      </svg>
    );
  };

  // ── Loading auth ──────────────────────────────────────────────────────────────
  if (authLoading) return (
    <div style={{ height:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#f7f7f5" }}>
      <div style={{ fontSize:32, fontWeight:800, color:"#1a1a1a", letterSpacing:"-1px" }}>Owee</div>
    </div>
  );

  // ── Pantalla de auth ──────────────────────────────────────────────────────────
  if (!user) return (
    <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh", background:"#f7f7f5", display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700;9..40,800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;font-family:'DM Sans',-apple-system,sans-serif;}
        input{background:white;border:1.5px solid #e8e8e5;color:#1a1a1a;border-radius:14px;padding:12px 14px;font-size:14px;outline:none;width:100%;transition:border 0.15s;}
        input:focus{border-color:#1a1a1a;}
        input::placeholder{color:#bbb;}
        .btn{background:#1a1a1a;color:white;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;width:100%;transition:all 0.15s;}
        .btn:hover{opacity:0.9;}
        .btn:disabled{opacity:0.4;}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        .su{animation:slideUp 0.3s ease forwards;}
      `}</style>
      <div style={{ padding:"60px 24px 0", textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center" }}>
        <OweeLogomark size={56} />
        <div style={{ fontSize:42, fontWeight:800, letterSpacing:"-2px", color:"#1a1a1a", marginTop:16, lineHeight:1 }}>Owee</div>
        <div style={{ fontSize:15, color:"#bbb", marginTop:8, marginBottom:40 }}>{t("tagline")}</div>
      </div>
      <div className="su" style={{ background:"white", borderRadius:"24px 24px 0 0", padding:"32px 24px 48px", boxShadow:"0 -4px 40px rgba(0,0,0,0.08)" }}>
        <div style={{ display:"flex", gap:0, marginBottom:24, background:"#f7f7f5", borderRadius:12, padding:4 }}>
          {["login","register"].map(s => (
            <button key={s} onClick={()=>{setAuthScreen(s);setAuthError("");}}
              style={{ flex:1, padding:"9px 0", border:"none", borderRadius:9, fontWeight:700, fontSize:14, cursor:"pointer", background:authScreen===s?"white":"transparent", color:authScreen===s?"#1a1a1a":"#bbb", boxShadow:authScreen===s?"0 1px 4px rgba(0,0,0,0.08)":"none", transition:"all 0.15s" }}>
              {s==="login"?t("login"):t("createAccount")}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {authScreen==="register" && (
            <input placeholder={t("username")} value={authUsername} onChange={e=>setAuthUsername(e.target.value)} maxLength={30} />
          )}
          <input placeholder={t("email")} type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} />
          <input placeholder={t("password")} type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&(authScreen==="login"?loginEmail():registerEmail())} />

          {authError && <div style={{ fontSize:13, color:"#E8734A", textAlign:"center" }}>{authError}</div>}

          <button className="btn" onClick={authScreen==="login"?loginEmail:registerEmail} disabled={authLoading2} style={{ marginTop:4 }}>
            {authLoading2?"...":authScreen==="login"?t("enter"):t("createAccount")}
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"4px 0" }}>
            <div style={{ flex:1, height:1, background:"#f0f0ed" }}/>
            <span style={{ fontSize:12, color:"#bbb" }}>{t("or")}</span>
            <div style={{ flex:1, height:1, background:"#f0f0ed" }}/>
          </div>

          <button onClick={loginGoogle} disabled={authLoading2}
            style={{ background:"white", border:"1.5px solid #e8e8e5", borderRadius:14, padding:14, fontSize:15, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10, transition:"all 0.15s" }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            {t("continueGoogle")}
          </button>

          <div style={{ display:"flex", gap:8, marginTop:6 }}>
            <button onClick={()=>setLang("es")} style={{ flex:1, padding:"6px 0", border:"none", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", background:lang==="es"?"#f0f0ed":"transparent", color:lang==="es"?"#1a1a1a":"#bbb" }}>🇺🇾 ES</button>
            <button onClick={()=>setLang("en")} style={{ flex:1, padding:"6px 0", border:"none", borderRadius:8, fontSize:12, fontWeight:600, cursor:"pointer", background:lang==="en"?"#f0f0ed":"transparent", color:lang==="en"?"#1a1a1a":"#bbb" }}>🇺🇸 EN</button>
          </div>

          <div style={{ fontSize:12, color:"#bbb", textAlign:"center", marginTop:8 }}>
            {t("termsNotice")}
          </div>
        </div>
      </div>
    </div>
  );

  // ── App principal ─────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh", background:T.bg, position:"relative", transition:"background 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700;9..40,800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;font-family:'DM Sans',-apple-system,sans-serif;}
        input,select{background:${T.input};border:1.5px solid ${T.border2};color:${T.text};border-radius:14px;padding:12px 14px;font-size:14px;outline:none;width:100%;transition:border 0.15s;}
        input:focus,select:focus{border-color:${T.text};}
        input::placeholder{color:${T.textMuted};}
        select option{background:${T.input};}
        .pill{border:1.5px solid ${T.border2};background:${T.surface};color:${T.text};border-radius:50px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;}
        .pill:hover{border-color:${T.text};}
        .btn{background:${T.text};color:${T.bg};border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;width:100%;transition:opacity 0.15s;}
        .btn:active{opacity:0.8;}
        .btn:disabled{opacity:0.3;}
        .card{background:${T.surface};border-radius:20px;border:1.5px solid ${T.border};}
        .row{display:flex;align-items:center;}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;z-index:200;backdrop-filter:blur(4px);}
        .modal{background:${T.surface};border-radius:24px 24px 0 0;padding:28px 24px 44px;width:100%;max-width:430px;}
        .sync{position:fixed;top:16px;left:50%;transform:translateX(-50%);background:${T.text};color:${T.bg};border-radius:50px;padding:7px 16px;font-size:12px;font-weight:700;z-index:300;opacity:0.9;white-space:nowrap;}
        ::-webkit-scrollbar{display:none;}
        .tab-bar{display:flex;position:sticky;top:0;background:${T.surface};z-index:10;border-bottom:1px solid ${T.border};}
        .swipe-wrap{position:relative;overflow:hidden;border-radius:20px;}
        .swipe-delete{position:absolute;right:0;top:0;bottom:0;background:#E8734A;display:flex;align-items:center;justify-content:center;padding:0 20px;color:white;font-weight:700;font-size:13px;border-radius:0 20px 20px 0;}
      `}</style>

      {syncing && <motion.div className="sync" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.9}}>⟳ Guardando...</motion.div>}
      <AnimatePresence mode="wait">

      {/* ══ HOME ══════════════════════════════════════════════════════════════ */}
      {screen==="home" && (
        <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:0.22,ease:[0.4,0,0.2,1]}} style={{ paddingBottom:60 }}>
          <div style={{ padding:"56px 24px 28px", background:T.header, borderRadius:"0 0 28px 28px", transition:"background 0.3s" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                  <OweeLogomark size={32} />
                  <h1 style={{ fontSize:32, fontWeight:800, color:"white", letterSpacing:"-1.5px", lineHeight:1 }}>Owee</h1>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.28)", marginTop:4 }}>by patro</span>
                </div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>{t("tagline")}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <button onClick={()=>setShowSettings(true)}
                  style={{ background:"rgba(255,255,255,0.1)", border:"1.5px solid rgba(255,255,255,0.2)", borderRadius:50, width:36, height:36, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16 }}>
                  ⚙️
                </button>
                <button onClick={()=>setShowProfile(true)} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
                  <Avatar name={user.displayName||user.email} photo={user.photoURL} size={38} color="#fff" bg="rgba(255,255,255,0.15)" />
                </button>
              </div>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:22 }}>
              <button className="pill" style={{ background:"white", color:"#1a1a1a", fontSize:14, padding:"11px 20px" }} onClick={()=>setShowNewModal(true)}>+ {t("newGroup")}</button>
              <button className="pill" style={{ background:"rgba(255,255,255,0.1)", border:"1.5px solid rgba(255,255,255,0.2)", color:"white", fontSize:14, padding:"11px 20px" }} onClick={()=>setShowJoinModal(true)}>{t("join")}</button>
            </div>
          </div>

          <div style={{ padding:"24px 24px 0" }}>
            {openGroups.length===0 ? (
              <div style={{ textAlign:"center", padding:"70px 0" }}>
                <div style={{ fontSize:44, marginBottom:14 }}>🧾</div>
                <div style={{ fontSize:16, color:T.textSub, fontWeight:600 }}>{t("noActiveGroups")}</div>
                <div style={{ fontSize:13, color:T.textMuted, marginTop:6 }}>{t("createOrJoin")}</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:12, fontWeight:700, color:T.textMuted, letterSpacing:0.8, textTransform:"uppercase", marginBottom:14 }}>{t("active")}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {openGroups.map(g => {
                    const sym=getCurSymbol(g.currency||"UYU");
                    return (
                      <motion.div key={g.id} whileTap={{scale:0.97}} onClick={()=>openGroup(g.id)} style={{ padding:"18px 20px", background:T.surface, borderRadius:20, border:`1.5px solid ${T.border}`, cursor:"pointer" }}>
                        <div className="row" style={{ justifyContent:"space-between", marginBottom:14 }}>
                          <div>
                            <div style={{ fontWeight:700, fontSize:16, color:T.text }}>{g.title}</div>
                            <div style={{ fontSize:12, color:T.textMuted, marginTop:2 }}>{g.createdAt} · {(g.expenses||[]).length} {t("expenses")} · {g.currency||"UYU"}</div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontWeight:800, fontSize:20, color:T.text }}>{sym}{totalGastos(g).toFixed(2)}</div>
                            <div style={{ fontSize:11, color:T.textMuted }}>{t("total")}</div>
                          </div>
                        </div>
                        <div className="row" style={{ gap:6 }}>
                          {(g.people||[]).slice(0,6).map(p=><Avatar key={p.id} name={p.name} color={p.color} bg={p.bg} size={28}/>)}
                          {(g.people||[]).length>6&&<div style={{ width:28,height:28,borderRadius:"50%",background:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:T.textMuted,fontWeight:700 }}>+{g.people.length-6}</div>}
                          {(g.people||[]).length===0&&<div style={{ fontSize:12,color:T.textMuted }}>{t("noPeople")}</div>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* ══ GROUP VIEW ════════════════════════════════════════════════════════ */}
      {screen==="group"&&active&&(
        <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:0.22,ease:[0.4,0,0.2,1]}} style={{ paddingBottom:80 }}>
          <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}` }}>
            <div style={{ padding:"52px 24px 0" }}>
              <div className="row" style={{ justifyContent:"space-between", marginBottom:6 }}>
                <button onClick={()=>setScreen("home")} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",padding:"0 10px 0 0",color:T.text }}>←</button>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="pill" style={{ fontSize:12,padding:"6px 14px",background:copied?T.text:T.surface,color:copied?T.bg:T.text,borderColor:copied?T.text:T.border2 }} onClick={shareGroup}>
                    {copied?`✓ ${t("copied")}`:`📋 ${t("share")}`}
                  </button>
                  <button className="pill" style={{ fontSize:12,padding:"6px 14px",color:T.orange,borderColor:darkMode?"#3a2a25":"#fdeee8" }}
                    onClick={()=>{ deleteGroup(activeId); setActiveId(null); setScreen("home"); }}>
                    {t("delete")}
                  </button>
                </div>
              </div>

              {editTitle?(
                <input value={titleInput} onChange={e=>setTitleInput(e.target.value)}
                  onBlur={()=>{ updateActive(g=>({...g,title:sanitize(titleInput,60)||g.title})); setEditTitle(false); }}
                  onKeyDown={e=>{ if(e.key==="Enter"){updateActive(g=>({...g,title:sanitize(titleInput,60)||g.title}));setEditTitle(false);}}}
                  autoFocus maxLength={60} style={{ fontSize:22,fontWeight:800,background:"transparent",border:"none",borderBottom:`2px solid ${T.text}`,borderRadius:0,padding:"4px 0",marginBottom:4,color:T.text }}/>
              ):(
                <div onClick={()=>{setTitleInput(active.title);setEditTitle(true);}} style={{ fontSize:22,fontWeight:800,letterSpacing:"-0.5px",marginBottom:2,cursor:"text",color:T.text }}>
                  {active.title}
                </div>
              )}
              <div className="row" style={{ gap:8, marginBottom:2 }}>
                <div style={{ fontSize:11,color:T.textMuted,fontFamily:"monospace",letterSpacing:0.5 }}>🔑 {active.id}</div>
                <button onClick={()=>{ navigator.clipboard?.writeText(active.id).then(()=>{ setCopiedCode(true); setTimeout(()=>setCopiedCode(false),2000); }).catch(()=>{ const ta=document.createElement("textarea");ta.value=active.id;ta.style.cssText="position:fixed;opacity:0";document.body.appendChild(ta);ta.focus();ta.select();document.execCommand("copy");document.body.removeChild(ta);setCopiedCode(true);setTimeout(()=>setCopiedCode(false),2000); }); }}
                  style={{ background:copiedCode?T.green:T.border, border:"none", borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:700, cursor:"pointer", color:copiedCode?"white":T.textSub, transition:"all 0.2s" }}>
                  {copiedCode?`✓ ${t("copy")}`:t("copy")}
                </button>
              </div>
              <div style={{ fontSize:13,color:T.textMuted,marginBottom:16 }}>
                {(active.people||[]).length} {t("people")} · {curSymbol}{totalGastos(active).toFixed(2)} · {active.currency||"UYU"}
                {ratesLoading&&<span style={{ marginLeft:6,fontSize:11 }}>↻ ...</span>}
              </div>
            </div>

            <div className="tab-bar" style={{ padding:"0 24px" }}>
              {[
                {key:"gastos", label:t("tabExpenses")},
                {key:"personas", label:t("tabPeople")},
                {key:"cuentas", label:t("tabAccounts")},
                {key:"gráfica", label:t("tabChart")},
              ].map(tb=>(
                <button key={tb.key} onClick={()=>setTab(tb.key)} style={{ flex:1,padding:"12px 0",background:"none",border:"none",fontSize:13,fontWeight:600,cursor:"pointer",color:tab===tb.key?T.text:T.textMuted,borderBottom:tab===tb.key?`2.5px solid ${T.text}`:`2.5px solid transparent`,transition:"all 0.15s" }}>
                  {tb.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding:"20px 24px" }}>

            {/* GASTOS */}
            {tab==="gastos"&&(
              <div className="fi">
                <div className="card" style={{ padding:20,marginBottom:20, border:editingExpId?`2px solid ${T.text}`:`1.5px solid ${T.border}` }}>
                  <div className="row" style={{ justifyContent:"space-between", marginBottom:14 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:0.6,textTransform:"uppercase" }}>
                      {editingExpId?t("editingExpense"):t("newExpense")}
                    </div>
                    {editingExpId&&(
                      <button onClick={resetExpForm} style={{ background:"none",border:"none",fontSize:12,color:T.orange,cursor:"pointer",fontWeight:600 }}>{t("cancel")}</button>
                    )}
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                    <input placeholder={t("description")} value={newExp.desc} onChange={e=>setNewExp(x=>({...x,desc:e.target.value}))} maxLength={100}/>
                    <div style={{ display:"flex",gap:10 }}>
                      <div style={{ flex:1,position:"relative" }}>
                        <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,color:T.textMuted,pointerEvents:"none" }}>{curSymbol}</span>
                        <input type="number" placeholder="0.00" value={newExp.amount} onChange={e=>setNewExp(x=>({...x,amount:e.target.value}))} style={{ paddingLeft:30 }} min="0" max="999999"/>
                      </div>
                      <select value={newExp.paidBy} onChange={e=>setNewExp(x=>({...x,paidBy:e.target.value}))} style={{ flex:1 }}>
                        <option value="">{t("whoPaid")}</option>
                        {(active.people||[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <div style={{ fontSize:12,color:T.textMuted,marginBottom:8 }}>{t("category")}</div>
                      <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                        {CATEGORIES.map(c=>(
                          <button key={c.code} onClick={()=>setNewExp(x=>({...x,category:c.code}))} className="pill"
                            style={{ padding:"6px 12px",fontSize:12,background:newExp.category===c.code?T.text:T.surface,color:newExp.category===c.code?T.bg:T.text,borderColor:newExp.category===c.code?T.text:T.border2 }}>
                            {c.icon} {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(active.people||[]).length>0&&(
                      <div>
                        <div style={{ fontSize:12,color:T.textMuted,marginBottom:8 }}>{t("splitBetween")}</div>
                        <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                          {(active.people||[]).map(p=>(
                            <button key={p.id} onClick={()=>toggleSplit(p.id)} className="pill"
                              style={{ padding:"6px 14px",fontSize:13,background:newExp.splitWith.includes(p.id)?T.text:T.surface,color:newExp.splitWith.includes(p.id)?T.bg:T.text,borderColor:newExp.splitWith.includes(p.id)?T.text:T.border2 }}>
                              {p.name}
                            </button>
                          ))}
                          <button className="pill" style={{ padding:"6px 14px",fontSize:12 }} onClick={()=>setNewExp(x=>({...x,splitWith:(active.people||[]).map(p=>p.id)}))}>{t("all")}</button>
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={{ fontSize:12,color:T.textMuted,marginBottom:8 }}>{t("receiptPhoto")}</div>
                      {newExp.receiptUrl?(
                        <div style={{ position:"relative", display:"inline-block" }}>
                          <img src={newExp.receiptUrl} alt="recibo" style={{ width:80,height:80,objectFit:"cover",borderRadius:12,border:`1.5px solid ${T.border}` }}/>
                          <button onClick={()=>setNewExp(x=>({...x,receiptUrl:null}))}
                            style={{ position:"absolute",top:-6,right:-6,background:T.orange,color:"white",border:"none",borderRadius:"50%",width:20,height:20,fontSize:11,cursor:"pointer" }}>✕</button>
                        </div>
                      ):(
                        <label style={{ display:"inline-flex",alignItems:"center",gap:8,padding:"10px 16px",border:`1.5px dashed ${T.border2}`,borderRadius:12,cursor:"pointer",fontSize:13,color:T.textSub }}>
                          {uploadingImg?t("uploading"):t("addPhoto")}
                          <input type="file" accept="image/*" capture="environment" style={{ display:"none" }}
                            onChange={e=>handleReceiptUpload(e.target.files?.[0])} disabled={uploadingImg}/>
                        </label>
                      )}
                      {uploadError&&<div style={{ fontSize:12,color:T.orange,marginTop:6 }}>{uploadError}</div>}
                    </div>

                    <button className="btn" onClick={addExpense} disabled={(active.people||[]).length===0} style={{ marginTop:4 }}>
                      {(active.people||[]).length===0?t("addFirst"):editingExpId?t("saveChanges"):t("addExpenseBtn")}
                    </button>
                  </div>
                </div>

                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {(active.expenses||[]).length===0?(
                    <div style={{ textAlign:"center",padding:"40px 0",color:T.textMuted,fontSize:14 }}>{t("noExpensesYet")}</div>
                  ):[...(active.expenses||[])].reverse().map(exp=>{
                    const payer=getPerson(active,exp.paidBy);
                    const share=(exp.amount/exp.splitWith.length).toFixed(2);
                    const cat=getCategory(exp.category);
                    return (
                      <motion.div key={exp.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,x:-40}} transition={{duration:0.2}}>
                      <SwipeToDelete T={T} onDelete={()=>{ haptic(); removeExpense(exp.id); }}>
                      <div style={{ padding:"16px 18px", background:T.surface, borderRadius:20, border:`1.5px solid ${T.border}` }}>
                        <div className="row" style={{ justifyContent:"space-between", alignItems:"flex-start" }}>
                          <div style={{ flex:1, display:"flex", gap:10 }}>
                            {exp.receiptUrl&&(
                              <img src={exp.receiptUrl} alt="recibo" onClick={()=>setViewReceipt(exp.receiptUrl)}
                                style={{ width:44,height:44,objectFit:"cover",borderRadius:10,flexShrink:0,cursor:"pointer",border:`1.5px solid ${T.border}` }}/>
                            )}
                            <div style={{ flex:1 }}>
                              <div className="row" style={{ gap:6, marginBottom:4 }}>
                                <span style={{ fontSize:13 }}>{cat.icon}</span>
                                <div style={{ fontWeight:700,fontSize:15,color:T.text }}>{exp.desc}</div>
                              </div>
                              <div className="row" style={{ gap:8 }}>
                                {payer&&<Avatar name={payer.name} color={payer.color} bg={payer.bg} size={18}/>}
                                <span style={{ fontSize:12,color:T.textSub }}>{t("paid")} {payer?.name} · ÷{exp.splitWith.length} = {curSymbol}{share} c/u</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                            <span style={{ fontWeight:800,fontSize:18,color:T.text }}>{curSymbol}{exp.amount.toFixed(2)}</span>
                            <div className="row" style={{ gap:8 }}>
                              <button onClick={()=>startEditExpense(exp)} style={{ background:"none",border:"none",fontSize:13,color:T.textMuted,cursor:"pointer" }}>✎</button>
                              <button onClick={()=>removeExpense(exp.id)} style={{ background:"none",border:"none",fontSize:14,color:T.textMuted,cursor:"pointer" }}>✕</button>
                            </div>
                          </div>
                        </div>
                      </div>
                      </SwipeToDelete>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PERSONAS */}
            {tab==="personas"&&(
              <div className="fi">
                <div className="card" style={{ padding:20,marginBottom:20 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:0.6,textTransform:"uppercase",marginBottom:14 }}>{t("addPerson")}</div>
                  <div style={{ display:"flex",gap:10 }}>
                    <input placeholder={t("name")} value={newPerson} onChange={e=>setNewPerson(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPerson()} style={{ flex:1 }} maxLength={40}/>
                    <button className="btn" onClick={addPerson} style={{ width:"auto",padding:"12px 20px" }}>+</button>
                  </div>
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {(active.people||[]).length===0?(
                    <div style={{ textAlign:"center",padding:"40px 0",color:T.textMuted,fontSize:14 }}>{t("addPersonPrompt")}</div>
                  ):(active.people||[]).map(p=>{
                    const bal=balances[p.id]||0;
                    return (
                      <motion.div key={p.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:0.18}} className="card" style={{ padding:"16px 18px", background:T.surface, border:`1.5px solid ${T.border}` }}>
                        <div className="row" style={{ justifyContent:"space-between" }}>
                          <div className="row" style={{ gap:12 }}>
                            <Avatar name={p.name} color={p.color} bg={p.bg} size={40}/>
                            <div>
                              <div style={{ fontWeight:700,fontSize:15,color:T.text }}>{p.name}</div>
                              <div style={{ fontSize:12,color:T.textMuted }}>{(active.expenses||[]).filter(e=>e.splitWith.includes(p.id)).length} gastos</div>
                            </div>
                          </div>
                          <div className="row" style={{ gap:10 }}>
                            <div style={{ fontWeight:800,fontSize:15,color:bal>0.01?T.green:bal<-0.01?T.orange:T.textMuted }}>
                              {bal>0.01?`+${curSymbol}${bal.toFixed(2)}`:bal<-0.01?`-${curSymbol}${Math.abs(bal).toFixed(2)}`:"✓"}
                            </div>
                            <button onClick={()=>removePerson(p.id)} style={{ background:"none",border:"none",fontSize:16,color:"#ddd",cursor:"pointer" }}>✕</button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CUENTAS */}
            {tab==="cuentas"&&(
              <div className="fi">
                <div className="card" style={{ padding:20,marginBottom:16 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:0.6,textTransform:"uppercase",marginBottom:14 }}>{t("balances")}</div>
                  {(active.people||[]).length===0?(
                    <div style={{ fontSize:14,color:T.textMuted,textAlign:"center",padding:"16px 0" }}>{t("addPeopleFirst")}</div>
                  ):(active.people||[]).map(p=>{
                    const bal=balances[p.id]||0;
                    return (
                      <div key={p.id} className="row" style={{ justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${T.border}` }}>
                        <div className="row" style={{ gap:10 }}>
                          <Avatar name={p.name} color={p.color} bg={p.bg} size={30}/>
                          <span style={{ fontWeight:600,fontSize:14,color:T.text }}>{p.name}</span>
                        </div>
                        <div style={{ fontWeight:700,fontSize:14,color:bal>0.01?T.green:bal<-0.01?T.orange:T.textMuted }}>
                          {bal>0.01?`${t("owed")} ${curSymbol}${bal.toFixed(2)}`:bal<-0.01?`${t("owes")} ${curSymbol}${Math.abs(bal).toFixed(2)}`:t("upToDate")}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="card" style={{ padding:20,marginBottom:16 }}>
                  <div className="row" style={{ justifyContent:"space-between", marginBottom:14 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:0.6,textTransform:"uppercase" }}>{t("whoOwesWhom")}</div>
                    {settlements.length>0&&(
                      <div style={{ fontSize:11,color:T.textMuted }}>
                        {settlements.filter((_,i)=>(active.paidSettlements||{})[`${i}`]).length}/{settlements.length} {t("markedPaid")}
                      </div>
                    )}
                  </div>
                  {settlements.length===0?(
                    <div style={{ fontSize:14,color:T.textMuted,textAlign:"center",padding:"16px 0" }}>
                      {(active.people||[]).length===0?t("addPeopleAndExpenses"):t("allSettled")}
                    </div>
                  ):settlements.map((s,i)=>{
                    const from=getPerson(active,s.from);
                    const to  =getPerson(active,s.to);
                    if (!from||!to) return null;
                    const key=`${i}`;
                    const paid=(active.paidSettlements||{})[key];
                    return (
                      <div key={i} style={{ background:paid?T.paidBg:T.rowBg,borderRadius:14,padding:"12px 14px",marginBottom:8,transition:"background 0.3s",border:paid?`1.5px solid ${T.paidBorder}`:"1.5px solid transparent" }}>
                        <div className="row" style={{ justifyContent:"space-between",marginBottom:6 }}>
                          <div className="row" style={{ gap:8 }}>
                            <Avatar name={from.name} color={from.color} bg={from.bg} size={26}/>
                            <span style={{ fontSize:14,fontWeight:600,textDecoration:paid?"line-through":"none",color:paid?T.textMuted:T.text }}>{from.name}</span>
                          </div>
                          <div className="row" style={{ gap:10 }}>
                            <span style={{ fontWeight:800,fontSize:17,color:paid?T.textMuted:T.text,textDecoration:paid?"line-through":"none" }}>{curSymbol}{s.amount.toFixed(2)}</span>
                            <button onClick={()=>{ haptic(); toggleSettlement(key); }}
                              style={{ width:28,height:28,borderRadius:"50%",border:`2px solid ${paid?T.green:T.border2}`,background:paid?T.green:T.surface,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s" }}>
                              {paid&&<span style={{ color:"white",fontSize:14,fontWeight:700 }}>✓</span>}
                            </button>
                          </div>
                        </div>
                        <div className="row" style={{ gap:6,paddingLeft:4 }}>
                          <span style={{ fontSize:12,color:T.textMuted }}>→ para</span>
                          <Avatar name={to.name} color={to.color} bg={to.bg} size={20}/>
                          <span style={{ fontSize:13,fontWeight:600,color:paid?T.textMuted:T.textSub }}>{to.name}</span>
                        </div>
                        {paid&&(
                          <div style={{ fontSize:11,color:T.green,fontWeight:600,marginTop:6,paddingLeft:4 }}>{t("paidLabel")}</div>
                        )}
                      </div>
                    );
                  })}
                  {settlements.length>0&&settlements.every((_,i)=>(active.paidSettlements||{})[`${i}`])&&(
                    <div style={{ textAlign:"center",padding:"12px 0 4px",fontSize:14,fontWeight:700,color:T.green }}>
                      {t("allDone")}
                    </div>
                  )}
                </div>

                {/* Conversión de moneda */}
                {(active.expenses||[]).length>0&&(
                  <div className="card" style={{ padding:20, background:T.surface, border:`1.5px solid ${T.border}` }}>
                    <div className="row" style={{ justifyContent:"space-between", marginBottom:14 }}>
                      <div style={{ fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:0.6,textTransform:"uppercase" }}>{t("equivalences")}</div>
                      {ratesLoading
                        ? <span style={{ fontSize:11,color:T.textMuted }}>↻ ...</span>
                        : <button onClick={()=>{ setRates({}); fetchRates(active.currency||"UYU"); }}
                            style={{ background:"none",border:"none",fontSize:11,color:T.textMuted,cursor:"pointer",textDecoration:"underline" }}>
                            {t("update")}
                          </button>
                      }
                    </div>
                    {ratesLoading?(
                      <div style={{ padding:"16px 0",textAlign:"center",color:T.textMuted,fontSize:13 }}>{t("loadingRates")}</div>
                    ):CURRENCIES.filter(c=>c.code!==(active.currency||"UYU")).map(c=>{
                      const converted=convertAmount(totalGastos(active),active.currency||"UYU",c.code);
                      const isLive=!!(rates[active.currency||"UYU"]?.[c.code]);
                      return (
                        <div key={c.code} className="row" style={{ justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${T.border}` }}>
                          <div>
                            <div style={{ fontSize:14,color:T.text,fontWeight:500 }}>{c.name}</div>
                            <div style={{ fontSize:11,color:T.textMuted }}>{c.code}</div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            {converted===null?(
                              <div style={{ fontWeight:600,fontSize:13,color:T.textMuted }}>{t("notAvailable")}</div>
                            ):(
                              <>
                                <div style={{ fontWeight:700,fontSize:15,color:T.text }}>{c.symbol}{converted.toFixed(2)}</div>
                                {!isLive&&<div style={{ fontSize:10,color:T.textMuted }}>{t("reference")}</div>}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ fontSize:11,color:T.textMuted,marginTop:10 }}>
                      {Object.keys(rates).length>0?t("liveRates"):t("refRates")}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* GRÁFICA */}
            {tab==="gráfica"&&(
              <div className="fi">
                {chartData.length===0||totalGastos(active)===0?(
                  <div style={{ textAlign:"center",padding:"60px 0",color:T.textMuted,fontSize:14 }}>
                    <div style={{ fontSize:36,marginBottom:12 }}>📊</div>
                    {t("addExpensesForChart")}
                  </div>
                ):(
                  <>
                    <div className="card" style={{ padding:24,marginBottom:16,display:"flex",flexDirection:"column",alignItems:"center" }}>
                      <div style={{ fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:0.6,textTransform:"uppercase",marginBottom:20,alignSelf:"flex-start" }}>{t("expenseByPerson")}</div>
                      <DonutChart data={chartData} size={180} textColor={T.text}/>
                      <div style={{ width:"100%",marginTop:24,display:"flex",flexDirection:"column",gap:10 }}>
                        {chartData.map((d,i)=>(
                          <div key={i}>
                            <div className="row" style={{ justifyContent:"space-between",marginBottom:6 }}>
                              <div className="row" style={{ gap:8 }}>
                                <div style={{ width:10,height:10,borderRadius:"50%",background:d.color,flexShrink:0 }}/>
                                <span style={{ fontSize:14,fontWeight:600,color:T.text }}>{d.name}</span>
                              </div>
                              <div className="row" style={{ gap:8 }}>
                                <span style={{ fontSize:13,color:T.textSub }}>{curSymbol}{d.amount.toFixed(2)}</span>
                                <span style={{ fontSize:13,fontWeight:700,minWidth:36,textAlign:"right",color:T.text }}>{d.pct}%</span>
                              </div>
                            </div>
                            <div style={{ height:6,background:T.border,borderRadius:3,overflow:"hidden" }}>
                              <div style={{ height:"100%",width:`${d.pct}%`,background:d.color,borderRadius:3,transition:"width 0.6s cubic-bezier(.4,0,.2,1)" }}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {chartDataCat.length>0&&(
                      <div className="card" style={{ padding:24,marginBottom:16,display:"flex",flexDirection:"column",alignItems:"center" }}>
                        <div style={{ fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:0.6,textTransform:"uppercase",marginBottom:20,alignSelf:"flex-start" }}>{t("expenseByCategory")}</div>
                        <DonutChart data={chartDataCat} size={180} textColor={T.text}/>
                        <div style={{ width:"100%",marginTop:24,display:"flex",flexDirection:"column",gap:10 }}>
                          {chartDataCat.map((d,i)=>(
                            <div key={i}>
                              <div className="row" style={{ justifyContent:"space-between",marginBottom:6 }}>
                                <div className="row" style={{ gap:8 }}>
                                  <div style={{ width:10,height:10,borderRadius:"50%",background:d.color,flexShrink:0 }}/>
                                  <span style={{ fontSize:14,fontWeight:600,color:T.text }}>{d.icon} {d.name}</span>
                                </div>
                                <div className="row" style={{ gap:8 }}>
                                  <span style={{ fontSize:13,color:T.textSub }}>{curSymbol}{d.amount.toFixed(2)}</span>
                                  <span style={{ fontSize:13,fontWeight:700,minWidth:36,textAlign:"right",color:T.text }}>{d.pct}%</span>
                                </div>
                              </div>
                              <div style={{ height:6,background:T.border,borderRadius:3,overflow:"hidden" }}>
                                <div style={{ height:"100%",width:`${d.pct}%`,background:d.color,borderRadius:3,transition:"width 0.6s cubic-bezier(.4,0,.2,1)" }}/>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="card" style={{ padding:20 }}>
                      <div style={{ fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:0.6,textTransform:"uppercase",marginBottom:14 }}>{t("summary")}</div>
                      <div className="row" style={{ justifyContent:"space-between",marginBottom:8 }}>
                        <span style={{ fontSize:14,color:T.textSub }}>{t("totalSpent")}</span>
                        <span style={{ fontWeight:800,fontSize:16,color:T.text }}>{curSymbol}{totalGastos(active).toFixed(2)}</span>
                      </div>
                      <div className="row" style={{ justifyContent:"space-between",marginBottom:8 }}>
                        <span style={{ fontSize:14,color:T.textSub }}>{t("avgPerPerson")}</span>
                        <span style={{ fontWeight:700,fontSize:14,color:T.text }}>{curSymbol}{((active.people||[]).length>0?totalGastos(active)/(active.people||[]).length:0).toFixed(2)}</span>
                      </div>
                      <div className="row" style={{ justifyContent:"space-between" }}>
                        <span style={{ fontSize:14,color:T.textSub }}>{t("expenseCount")}</span>
                        <span style={{ fontWeight:700,fontSize:14,color:T.text }}>{(active.expenses||[]).length}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}

      </AnimatePresence>

      {/* MODAL: Nuevo grupo */}
      {showNewModal&&(
        <div className="modal-bg fi" onClick={e=>{if(e.target===e.currentTarget)setShowNewModal(false)}}>
          <div className="modal" style={{ background:T.surface }}>
            <div style={{ fontWeight:800,fontSize:20,marginBottom:6,color:T.text }}>{t("newGroupTitle")}</div>
            <div style={{ fontSize:13,color:T.textMuted,marginBottom:20 }}>{t("nameGroup")}</div>
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              <input placeholder={t("groupNamePlaceholder")} value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createGroup()} autoFocus maxLength={60}/>
              <select value={newGroupCur} onChange={e=>setNewGroupCur(e.target.value)}>
                {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</option>)}
              </select>
              <button className="btn" onClick={createGroup} style={{ marginTop:4 }}>{t("createGroupBtn")}</button>
              <button onClick={()=>setShowNewModal(false)} style={{ background:"none",border:"none",width:"100%",padding:"14px",fontSize:14,color:T.textMuted,cursor:"pointer" }}>{t("cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Unirse */}
      {showJoinModal&&(
        <div className="modal-bg fi" onClick={e=>{if(e.target===e.currentTarget){setShowJoinModal(false);setJoinError("");}}}>
          <div className="modal" style={{ background:T.surface }}>
            <div style={{ fontWeight:800,fontSize:20,marginBottom:6,color:T.text }}>{t("joinGroupTitle")}</div>
            <div style={{ fontSize:13,color:T.textMuted,marginBottom:20 }}>{t("askCode")}</div>
            <input placeholder="Código (6 caracteres)" value={joinCode} onChange={e=>{setJoinCode(e.target.value.toUpperCase());setJoinError("");}} onKeyDown={e=>e.key==="Enter"&&joinGroup()} autoFocus style={{ marginBottom:joinError?8:14,fontFamily:"monospace",letterSpacing:1 }}/>
            {joinError&&<div style={{ fontSize:13,color:T.orange,marginBottom:14 }}>{joinError}</div>}
            <button className="btn" onClick={joinGroup}>{t("joinBtn")}</button>
            <button onClick={()=>{setShowJoinModal(false);setJoinError("");}} style={{ background:"none",border:"none",width:"100%",padding:"14px",fontSize:14,color:T.textMuted,cursor:"pointer",marginTop:4 }}>{t("cancel")}</button>
          </div>
        </div>
      )}

      {/* MODAL: Ver recibo */}
      {viewReceipt&&(
        <div className="modal-bg fi" onClick={()=>setViewReceipt(null)} style={{ alignItems:"center", padding:20 }}>
          <img src={viewReceipt} alt="recibo" onClick={e=>e.stopPropagation()}
            style={{ maxWidth:"100%", maxHeight:"85vh", borderRadius:16, objectFit:"contain" }}/>
          <button onClick={()=>setViewReceipt(null)}
            style={{ position:"fixed", top:24, right:24, background:"rgba(0,0,0,0.6)", color:"white", border:"none", borderRadius:"50%", width:36, height:36, fontSize:18, cursor:"pointer" }}>✕</button>
        </div>
      )}

      {/* MODAL: Perfil */}
      {showProfile&&(
        <div className="modal-bg fi" onClick={e=>{if(e.target===e.currentTarget)setShowProfile(false)}}>
          <div className="modal" style={{ background:T.surface }}>
            <div style={{ display:"flex",alignItems:"center",gap:16,marginBottom:24 }}>
              <Avatar name={user.displayName||user.email} photo={user.photoURL} size={56}/>
              <div>
                <div style={{ fontWeight:800,fontSize:18,color:T.text }}>{user.displayName||"Usuario"}</div>
                <div style={{ fontSize:13,color:T.textMuted,marginTop:2 }}>{user.email}</div>
              </div>
            </div>
            <div style={{ background:T.rowBg,borderRadius:14,padding:"14px 16px",marginBottom:14 }}>
              <div style={{ fontSize:12,color:T.textMuted,marginBottom:4 }}>{t("activeGroups")}</div>
              <div style={{ fontWeight:800,fontSize:22,color:T.text }}>{openGroups.length}</div>
            </div>
            <button onClick={()=>{ setShowProfile(false); setShowSettings(true); }}
              style={{ background:"none",border:`1.5px solid ${T.border2}`,borderRadius:14,padding:14,fontSize:15,fontWeight:600,cursor:"pointer",width:"100%",color:T.text,marginBottom:10 }}>
              ⚙️ {t("settings")}
            </button>
            <button onClick={logout} style={{ background:"none",border:`1.5px solid ${darkMode?"#3a2a25":"#fdeee8"}`,borderRadius:14,padding:14,fontSize:15,fontWeight:600,cursor:"pointer",width:"100%",color:T.orange }}>
              {t("logout")}
            </button>
            <button onClick={()=>setShowProfile(false)} style={{ background:"none",border:"none",width:"100%",padding:"14px",fontSize:14,color:T.textMuted,cursor:"pointer",marginTop:4 }}>{t("cancel")}</button>
          </div>
        </div>
      )}

      {/* MODAL: Configuración */}
      {showSettings&&(
        <div className="modal-bg fi" onClick={e=>{if(e.target===e.currentTarget)setShowSettings(false)}}>
          <div className="modal" style={{ background:T.surface, maxHeight:"85vh", overflowY:"auto" }}>
            <div className="row" style={{ justifyContent:"space-between", marginBottom:24 }}>
              <div style={{ fontWeight:800,fontSize:20,color:T.text }}>{t("settingsTitle")}</div>
              <button onClick={()=>setShowSettings(false)} style={{ background:T.rowBg,border:"none",borderRadius:"50%",width:32,height:32,fontSize:16,cursor:"pointer",color:T.text }}>✕</button>
            </div>

            {/* Apariencia */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:0.6,textTransform:"uppercase",marginBottom:12 }}>{t("appearance")}</div>
              <div className="row" style={{ justifyContent:"space-between", padding:"12px 14px", background:T.rowBg, borderRadius:14 }}>
                <span style={{ fontSize:14,fontWeight:600,color:T.text }}>{darkMode?t("darkMode"):t("lightMode")}</span>
                <button onClick={()=>setDarkMode(d=>!d)}
                  style={{ width:48, height:28, borderRadius:20, background:darkMode?T.text:T.border2, border:"none", cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
                  <div style={{ width:22, height:22, borderRadius:"50%", background:T.surface, position:"absolute", top:3, left:darkMode?23:3, transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }}/>
                </button>
              </div>
            </div>

            {/* Idioma */}
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:0.6,textTransform:"uppercase",marginBottom:12 }}>{t("language")}</div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setLang("es")} className="pill" style={{ flex:1, padding:"10px 0", background:lang==="es"?T.text:T.surface, color:lang==="es"?T.bg:T.text, borderColor:lang==="es"?T.text:T.border2 }}>
                  🇺🇾 {t("spanish")}
                </button>
                <button onClick={()=>setLang("en")} className="pill" style={{ flex:1, padding:"10px 0", background:lang==="en"?T.text:T.surface, color:lang==="en"?T.bg:T.text, borderColor:lang==="en"?T.text:T.border2 }}>
                  🇺🇸 {t("english")}
                </button>
              </div>
            </div>

            {/* Detalles de cuenta */}
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:T.textMuted,letterSpacing:0.6,textTransform:"uppercase",marginBottom:12 }}>{t("accountDetails")}</div>

              <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
                <label style={{ position:"relative", cursor:"pointer" }}>
                  <Avatar name={profileUsername||user.email} photo={profilePhotoPreview||user.photoURL} size={72}/>
                  <div style={{ position:"absolute", bottom:0, right:0, background:T.text, borderRadius:"50%", width:24, height:24, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, border:`2px solid ${T.surface}` }}>
                    📷
                  </div>
                  <input type="file" accept="image/*" style={{ display:"none" }} onChange={e=>handleProfilePhotoSelect(e.target.files?.[0])}/>
                </label>
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div>
                  <div style={{ fontSize:11,color:T.textMuted,marginBottom:4 }}>{t("username")}</div>
                  <input value={profileUsername} onChange={e=>setProfileUsername(e.target.value)} maxLength={30}/>
                </div>
                <div>
                  <div style={{ fontSize:11,color:T.textMuted,marginBottom:4 }}>{t("email")}</div>
                  <input value={profileEmail} disabled style={{ opacity:0.6 }}/>
                </div>
                <div>
                  <div style={{ fontSize:11,color:T.textMuted,marginBottom:4 }}>{t("newPassword")}</div>
                  <input type="password" value={profilePass} onChange={e=>setProfilePass(e.target.value)} placeholder="••••••••"/>
                </div>

                {profileError&&<div style={{ fontSize:13,color:T.orange }}>{profileError}</div>}

                <button className="btn" onClick={saveProfile} disabled={profileSaving} style={{ marginTop:6, background:profileSaved?T.green:T.text }}>
                  {profileSaving?"...":profileSaved?t("saved"):t("save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
