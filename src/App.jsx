import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./firebase.js";
import { ref, onValue, set, remove } from "firebase/database";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";

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

// ── Helpers ───────────────────────────────────────────────────────────────────
const genId     = () => Math.random().toString(36).slice(2,11) + Math.random().toString(36).slice(2,11) + Date.now().toString(36);
const today     = () => new Date().toLocaleDateString("es-UY");
const sanitize  = (str, max=80) => String(str||"").trim().slice(0,max);
const safeAmt   = (val) => { const n=parseFloat(val); return (!isNaN(n)&&n>0&&n<1000000)?n:null; };
const makeGroup = (title="Nuevo grupo", currency="UYU", createdBy=null) => ({
  id: genId(), title, people:[], expenses:[], createdAt:today(), closed:false, currency, createdBy
});

const auth     = getAuth();
const gProvider= new GoogleAuthProvider();

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
  const [newExp,        setNewExp]        = useState({ desc:"", amount:"", paidBy:"", splitWith:[] });
  const [copied,        setCopied]        = useState(false);
  const [copiedCode,    setCopiedCode]    = useState(false);
  const [showAllPaid,   setShowAllPaid]   = useState(false);
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
  const fetchRates = useCallback(async (baseCurrency="UYU") => {
    if (rates[baseCurrency]) return;
    setRatesLoading(true);
    try {
      const res  = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
      const data = await res.json();
      setRates(prev => ({ ...prev, [baseCurrency]: data.rates }));
    } catch {
      // fallback: tasas aproximadas fijas si falla la API
      const fallback = { UYU:{ USD:0.026, ARS:24.5, BRL:0.14, EUR:0.024, UYU:1 }, USD:{ UYU:38.5, ARS:950, BRL:5.2, EUR:0.92, USD:1 } };
      if (fallback[baseCurrency]) setRates(prev => ({ ...prev, [baseCurrency]: fallback[baseCurrency] }));
    } finally {
      setRatesLoading(false);
    }
  }, [rates]);

  const convertAmount = (amount, fromCurrency, toCurrency) => {
    if (fromCurrency === toCurrency) return amount;
    const baseRates = rates[fromCurrency];
    if (!baseRates || !baseRates[toCurrency]) return amount;
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
    const code = joinCode.trim().replace(/[^a-z0-9]/gi,"").slice(0,50);
    if (!code||code.length<3) { setJoinError("Código inválido."); return; }
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
  const addExpense = () => {
    const cleanDesc = sanitize(newExp.desc, 100);
    const cleanAmt  = safeAmt(newExp.amount);
    const { paidBy, splitWith } = newExp;
    if (!cleanDesc||!cleanAmt||!paidBy||splitWith.length===0) return;
    if ((active.expenses||[]).length>=200) return;
    updateActive(g => ({ ...g, expenses:[...(g.expenses||[]), {
      id:genId(), desc:cleanDesc, amount:cleanAmt, paidBy, splitWith, date:today(), addedBy:user?.uid||null
    }] }));
    setNewExp({ desc:"", amount:"", paidBy:"", splitWith:[] });
  };

  const removeExpense = (eid) => updateActive(g => ({ ...g, expenses:(g.expenses||[]).filter(e=>e.id!==eid) }));
  const toggleSplit   = (pid)  => setNewExp(e => ({ ...e, splitWith:e.splitWith.includes(pid)?e.splitWith.filter(i=>i!==pid):[...e.splitWith,pid] }));

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

  const logout = async () => { await signOut(auth); setGroups([]); setScreen("home"); setShowProfile(false); };

  // ── Helpers UI ───────────────────────────────────────────────────────────────
  const getPerson   = (group,id) => (group.people||[]).find(p=>p.id===id);
  const totalGastos = (g) => (g.expenses||[]).reduce((s,e)=>s+e.amount,0);
  const getCurSymbol= (code) => CURRENCIES.find(c=>c.code===code)?.symbol||"$";
  const openGroups  = groups.filter(g=>!g.closed);
  const balances    = active?getBalances(active):{};
  const settlements = active?getSettlements(active):[];
  const chartData   = active?getChartData(active):[];
  const curSymbol   = active?getCurSymbol(active.currency||"UYU"):"$";

  const Avatar = ({ name, photo, color, bg, size=36 }) => (
    photo
      ? <img src={photo} alt={name} style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0, border:"1.5px solid rgba(0,0,0,0.06)" }} />
      : <div style={{ width:size, height:size, borderRadius:"50%", background:bg||"#f0f0f0", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:size*0.38, color:color||"#333", flexShrink:0, border:"1.5px solid rgba(0,0,0,0.06)" }}>
          {name?.[0]?.toUpperCase()}
        </div>
  );

  // ── Donut chart SVG ──────────────────────────────────────────────────────────
  const DonutChart = ({ data, size=160 }) => {
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
        <text x={cx} y={cy-6} textAnchor="middle" fontSize={size*0.11} fontWeight="700" fill="#1a1a1a">{data[0]?.name||""}</text>
        <text x={cx} y={cy+10} textAnchor="middle" fontSize={size*0.13} fontWeight="800" fill="#1a1a1a">{data[0]?.pct||0}%</text>
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
        <div style={{ fontSize:15, color:"#bbb", marginTop:8, marginBottom:40 }}>Dividí gastos sin drama</div>
      </div>
      <div className="su" style={{ background:"white", borderRadius:"24px 24px 0 0", padding:"32px 24px 48px", boxShadow:"0 -4px 40px rgba(0,0,0,0.08)" }}>
        <div style={{ display:"flex", gap:0, marginBottom:24, background:"#f7f7f5", borderRadius:12, padding:4 }}>
          {["login","register"].map(s => (
            <button key={s} onClick={()=>{setAuthScreen(s);setAuthError("");}}
              style={{ flex:1, padding:"9px 0", border:"none", borderRadius:9, fontWeight:700, fontSize:14, cursor:"pointer", background:authScreen===s?"white":"transparent", color:authScreen===s?"#1a1a1a":"#bbb", boxShadow:authScreen===s?"0 1px 4px rgba(0,0,0,0.08)":"none", transition:"all 0.15s" }}>
              {s==="login"?"Iniciar sesión":"Crear cuenta"}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {authScreen==="register" && (
            <input placeholder="Nombre de usuario" value={authUsername} onChange={e=>setAuthUsername(e.target.value)} maxLength={30} />
          )}
          <input placeholder="Email" type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} />
          <input placeholder="Contraseña" type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&(authScreen==="login"?loginEmail():registerEmail())} />

          {authError && <div style={{ fontSize:13, color:"#E8734A", textAlign:"center" }}>{authError}</div>}

          <button className="btn" onClick={authScreen==="login"?loginEmail:registerEmail} disabled={authLoading2} style={{ marginTop:4 }}>
            {authLoading2?"...":authScreen==="login"?"Entrar":"Crear cuenta"}
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:12, margin:"4px 0" }}>
            <div style={{ flex:1, height:1, background:"#f0f0ed" }}/>
            <span style={{ fontSize:12, color:"#bbb" }}>o</span>
            <div style={{ flex:1, height:1, background:"#f0f0ed" }}/>
          </div>

          <button onClick={loginGoogle} disabled={authLoading2}
            style={{ background:"white", border:"1.5px solid #e8e8e5", borderRadius:14, padding:14, fontSize:15, fontWeight:600, cursor:"pointer", width:"100%", display:"flex", alignItems:"center", justifyContent:"center", gap:10, transition:"all 0.15s" }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuar con Google
          </button>

          <div style={{ fontSize:12, color:"#bbb", textAlign:"center", marginTop:8 }}>
            Al registrarte aceptás los términos de uso de Owee
          </div>
        </div>
      </div>
    </div>
  );

  // ── App principal ─────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth:430, margin:"0 auto", minHeight:"100vh", background:"#f7f7f5", position:"relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,700;9..40,800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;font-family:'DM Sans',-apple-system,sans-serif;}
        input,select{background:white;border:1.5px solid #e8e8e5;color:#1a1a1a;border-radius:14px;padding:12px 14px;font-size:14px;outline:none;width:100%;transition:border 0.15s;}
        input:focus,select:focus{border-color:#1a1a1a;}
        input::placeholder{color:#bbb;}
        select option{background:white;}
        .pill{border:1.5px solid #e8e8e5;background:white;color:#1a1a1a;border-radius:50px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:all 0.15s;}
        .pill:hover{border-color:#1a1a1a;}
        .btn{background:#1a1a1a;color:white;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;width:100%;transition:opacity 0.15s;}
        .btn:active{opacity:0.8;}
        .btn:disabled{opacity:0.3;}
        .card{background:white;border-radius:20px;border:1.5px solid #f0f0ed;}
        .row{display:flex;align-items:center;}
        .press{transition:transform 0.12s cubic-bezier(.4,0,.2,1);cursor:pointer;}
        .press:active{transform:scale(0.97);}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        .su{animation:slideUp 0.25s cubic-bezier(.4,0,.2,1) forwards;}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .fi{animation:fadeIn 0.2s ease;}
        @keyframes scaleIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
        .si{animation:scaleIn 0.2s cubic-bezier(.4,0,.2,1);}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:flex-end;justify-content:center;z-index:200;backdrop-filter:blur(2px);}
        .modal{background:white;border-radius:24px 24px 0 0;padding:28px 24px 44px;width:100%;max-width:430px;}
        .sync{position:fixed;top:16px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:white;border-radius:50px;padding:7px 16px;font-size:12px;font-weight:700;z-index:300;opacity:0.9;white-space:nowrap;}
        ::-webkit-scrollbar{display:none;}
        .tab-bar{display:flex;position:sticky;top:0;background:white;z-index:10;border-bottom:1px solid #f0f0ed;}
      `}</style>

      {syncing && <div className="sync">⟳ Guardando...</div>}

      {/* ══ HOME ══════════════════════════════════════════════════════════════ */}
      {screen==="home" && (
        <div className="su" style={{ paddingBottom:60 }}>
          <div style={{ padding:"56px 24px 28px", background:"#1a1a1a", borderRadius:"0 0 28px 28px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                  <OweeLogomark size={32} />
                  <h1 style={{ fontSize:32, fontWeight:800, color:"white", letterSpacing:"-1.5px", lineHeight:1 }}>Owee</h1>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.28)", marginTop:4 }}>by patro</span>
                </div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>Dividí gastos sin drama</div>
              </div>
              <button onClick={()=>setShowProfile(true)} style={{ background:"none", border:"none", cursor:"pointer", padding:0 }}>
                <Avatar name={user.displayName||user.email} photo={user.photoURL} size={38} color="#fff" bg="rgba(255,255,255,0.15)" />
              </button>
            </div>
            <div style={{ display:"flex", gap:10, marginTop:22 }}>
              <button className="pill" style={{ background:"white", color:"#1a1a1a", fontSize:14, padding:"11px 20px" }} onClick={()=>setShowNewModal(true)}>+ Nuevo grupo</button>
              <button className="pill" style={{ background:"rgba(255,255,255,0.1)", border:"1.5px solid rgba(255,255,255,0.2)", color:"white", fontSize:14, padding:"11px 20px" }} onClick={()=>setShowJoinModal(true)}>Unirse</button>
            </div>
          </div>

          <div style={{ padding:"24px 24px 0" }}>
            {openGroups.length===0 ? (
              <div style={{ textAlign:"center", padding:"70px 0" }}>
                <div style={{ fontSize:44, marginBottom:14 }}>🧾</div>
                <div style={{ fontSize:16, color:"#999", fontWeight:600 }}>No tenés grupos activos</div>
                <div style={{ fontSize:13, color:"#bbb", marginTop:6 }}>Creá uno o unite con un código</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:12, fontWeight:700, color:"#bbb", letterSpacing:0.8, textTransform:"uppercase", marginBottom:14 }}>Activos</div>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {openGroups.map(g => {
                    const sym=getCurSymbol(g.currency||"UYU");
                    return (
                      <div key={g.id} className="card press" onClick={()=>openGroup(g.id)} style={{ padding:"18px 20px" }}>
                        <div className="row" style={{ justifyContent:"space-between", marginBottom:14 }}>
                          <div>
                            <div style={{ fontWeight:700, fontSize:16 }}>{g.title}</div>
                            <div style={{ fontSize:12, color:"#bbb", marginTop:2 }}>{g.createdAt} · {(g.expenses||[]).length} gastos · {g.currency||"UYU"}</div>
                          </div>
                          <div style={{ textAlign:"right" }}>
                            <div style={{ fontWeight:800, fontSize:20 }}>{sym}{totalGastos(g).toFixed(2)}</div>
                            <div style={{ fontSize:11, color:"#bbb" }}>total</div>
                          </div>
                        </div>
                        <div className="row" style={{ gap:6 }}>
                          {(g.people||[]).slice(0,6).map(p=><Avatar key={p.id} name={p.name} color={p.color} bg={p.bg} size={28}/>)}
                          {(g.people||[]).length>6&&<div style={{ width:28,height:28,borderRadius:"50%",background:"#f0f0ed",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#999",fontWeight:700 }}>+{g.people.length-6}</div>}
                          {(g.people||[]).length===0&&<div style={{ fontSize:12,color:"#bbb" }}>Sin personas</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ GROUP VIEW ════════════════════════════════════════════════════════ */}
      {screen==="group"&&active&&(
        <div className="su" style={{ paddingBottom:80 }}>
          <div style={{ background:"white", borderBottom:"1px solid #f0f0ed" }}>
            <div style={{ padding:"52px 24px 0" }}>
              <div className="row" style={{ justifyContent:"space-between", marginBottom:6 }}>
                <button onClick={()=>setScreen("home")} style={{ background:"none",border:"none",fontSize:22,cursor:"pointer",padding:"0 10px 0 0" }}>←</button>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="pill" style={{ fontSize:12,padding:"6px 14px",background:copied?"#1a1a1a":"white",color:copied?"white":"#1a1a1a",borderColor:copied?"#1a1a1a":"#e8e8e5" }} onClick={shareGroup}>
                    {copied?"✓ Copiado!":"📋 Compartir"}
                  </button>
                  <button className="pill" style={{ fontSize:12,padding:"6px 14px",color:"#E8734A",borderColor:"#fdeee8" }}
                    onClick={()=>{ deleteGroup(activeId); setActiveId(null); setScreen("home"); }}>
                    Eliminar
                  </button>
                </div>
              </div>

              {editTitle?(
                <input value={titleInput} onChange={e=>setTitleInput(e.target.value)}
                  onBlur={()=>{ updateActive(g=>({...g,title:sanitize(titleInput,60)||g.title})); setEditTitle(false); }}
                  onKeyDown={e=>{ if(e.key==="Enter"){updateActive(g=>({...g,title:sanitize(titleInput,60)||g.title}));setEditTitle(false);}}}
                  autoFocus maxLength={60} style={{ fontSize:22,fontWeight:800,background:"transparent",border:"none",borderBottom:"2px solid #1a1a1a",borderRadius:0,padding:"4px 0",marginBottom:4 }}/>
              ):(
                <div onClick={()=>{setTitleInput(active.title);setEditTitle(true);}} style={{ fontSize:22,fontWeight:800,letterSpacing:"-0.5px",marginBottom:2,cursor:"text" }}>
                  {active.title}
                </div>
              )}
              <div className="row" style={{ gap:8, marginBottom:2 }}>
                <div style={{ fontSize:11,color:"#bbb",fontFamily:"monospace",letterSpacing:0.5 }}>🔑 {active.id}</div>
                <button onClick={()=>{ navigator.clipboard?.writeText(active.id).then(()=>{ setCopiedCode(true); setTimeout(()=>setCopiedCode(false),2000); }).catch(()=>{ const ta=document.createElement("textarea");ta.value=active.id;ta.style.cssText="position:fixed;opacity:0";document.body.appendChild(ta);ta.focus();ta.select();document.execCommand("copy");document.body.removeChild(ta);setCopiedCode(true);setTimeout(()=>setCopiedCode(false),2000); }); }}
                  style={{ background:copiedCode?"#4CAF82":"#f0f0ed", border:"none", borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:700, cursor:"pointer", color:copiedCode?"white":"#888", transition:"all 0.2s" }}>
                  {copiedCode?"✓ copiado":"copiar"}
                </button>
              </div>
              <div style={{ fontSize:13,color:"#bbb",marginBottom:16 }}>
                {(active.people||[]).length} personas · {curSymbol}{totalGastos(active).toFixed(2)} · {active.currency||"UYU"}
                {ratesLoading&&<span style={{ marginLeft:6,fontSize:11 }}>↻ cargando cambio...</span>}
              </div>
            </div>

            <div className="tab-bar" style={{ padding:"0 24px" }}>
              {["gastos","personas","cuentas","gráfica"].map(t=>(
                <button key={t} onClick={()=>setTab(t)} style={{ flex:1,padding:"12px 0",background:"none",border:"none",fontSize:13,fontWeight:600,cursor:"pointer",color:tab===t?"#1a1a1a":"#bbb",borderBottom:tab===t?"2.5px solid #1a1a1a":"2.5px solid transparent",transition:"all 0.15s" }}>
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding:"20px 24px" }}>

            {/* GASTOS */}
            {tab==="gastos"&&(
              <div className="fi">
                <div className="card" style={{ padding:20,marginBottom:20 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:"#bbb",letterSpacing:0.6,textTransform:"uppercase",marginBottom:14 }}>Nuevo gasto</div>
                  <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                    <input placeholder="Descripción (pizza, taxi...)" value={newExp.desc} onChange={e=>setNewExp(x=>({...x,desc:e.target.value}))} maxLength={100}/>
                    <div style={{ display:"flex",gap:10 }}>
                      <div style={{ flex:1,position:"relative" }}>
                        <span style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:14,color:"#999",pointerEvents:"none" }}>{curSymbol}</span>
                        <input type="number" placeholder="0.00" value={newExp.amount} onChange={e=>setNewExp(x=>({...x,amount:e.target.value}))} style={{ paddingLeft:30 }} min="0" max="999999"/>
                      </div>
                      <select value={newExp.paidBy} onChange={e=>setNewExp(x=>({...x,paidBy:e.target.value}))} style={{ flex:1 }}>
                        <option value="">¿Quién pagó?</option>
                        {(active.people||[]).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    {(active.people||[]).length>0&&(
                      <div>
                        <div style={{ fontSize:12,color:"#bbb",marginBottom:8 }}>Dividir entre:</div>
                        <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                          {(active.people||[]).map(p=>(
                            <button key={p.id} onClick={()=>toggleSplit(p.id)} className="pill"
                              style={{ padding:"6px 14px",fontSize:13,background:newExp.splitWith.includes(p.id)?"#1a1a1a":"white",color:newExp.splitWith.includes(p.id)?"white":"#1a1a1a",borderColor:newExp.splitWith.includes(p.id)?"#1a1a1a":"#e8e8e5" }}>
                              {p.name}
                            </button>
                          ))}
                          <button className="pill" style={{ padding:"6px 14px",fontSize:12 }} onClick={()=>setNewExp(x=>({...x,splitWith:(active.people||[]).map(p=>p.id)}))}>Todos</button>
                        </div>
                      </div>
                    )}
                    <button className="btn" onClick={addExpense} disabled={(active.people||[]).length===0} style={{ marginTop:4 }}>
                      {(active.people||[]).length===0?"Primero agregá personas":"Agregar gasto"}
                    </button>
                  </div>
                </div>

                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {(active.expenses||[]).length===0?(
                    <div style={{ textAlign:"center",padding:"40px 0",color:"#bbb",fontSize:14 }}>Sin gastos todavía</div>
                  ):[...(active.expenses||[])].reverse().map(exp=>{
                    const payer=getPerson(active,exp.paidBy);
                    const share=(exp.amount/exp.splitWith.length).toFixed(2);
                    return (
                      <div key={exp.id} className="card si" style={{ padding:"16px 18px" }}>
                        <div className="row" style={{ justifyContent:"space-between" }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700,fontSize:15,marginBottom:4 }}>{exp.desc}</div>
                            <div className="row" style={{ gap:8 }}>
                              {payer&&<Avatar name={payer.name} color={payer.color} bg={payer.bg} size={18}/>}
                              <span style={{ fontSize:12,color:"#888" }}>pagó {payer?.name} · ÷{exp.splitWith.length} = {curSymbol}{share} c/u</span>
                            </div>
                          </div>
                          <div className="row" style={{ gap:10 }}>
                            <span style={{ fontWeight:800,fontSize:18 }}>{curSymbol}{exp.amount.toFixed(2)}</span>
                            <button onClick={()=>removeExpense(exp.id)} style={{ background:"none",border:"none",fontSize:16,color:"#ddd",cursor:"pointer" }}>✕</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PERSONAS */}
            {tab==="personas"&&(
              <div className="fi">
                <div className="card" style={{ padding:20,marginBottom:20 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:"#bbb",letterSpacing:0.6,textTransform:"uppercase",marginBottom:14 }}>Agregar persona</div>
                  <div style={{ display:"flex",gap:10 }}>
                    <input placeholder="Nombre" value={newPerson} onChange={e=>setNewPerson(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPerson()} style={{ flex:1 }} maxLength={40}/>
                    <button className="btn" onClick={addPerson} style={{ width:"auto",padding:"12px 20px" }}>+</button>
                  </div>
                </div>
                <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
                  {(active.people||[]).length===0?(
                    <div style={{ textAlign:"center",padding:"40px 0",color:"#bbb",fontSize:14 }}>Agregá a las personas del grupo</div>
                  ):(active.people||[]).map(p=>{
                    const bal=balances[p.id]||0;
                    return (
                      <div key={p.id} className="card si" style={{ padding:"16px 18px" }}>
                        <div className="row" style={{ justifyContent:"space-between" }}>
                          <div className="row" style={{ gap:12 }}>
                            <Avatar name={p.name} color={p.color} bg={p.bg} size={40}/>
                            <div>
                              <div style={{ fontWeight:700,fontSize:15 }}>{p.name}</div>
                              <div style={{ fontSize:12,color:"#bbb" }}>{(active.expenses||[]).filter(e=>e.splitWith.includes(p.id)).length} gastos</div>
                            </div>
                          </div>
                          <div className="row" style={{ gap:10 }}>
                            <div style={{ fontWeight:800,fontSize:15,color:bal>0.01?"#4CAF82":bal<-0.01?"#E8734A":"#bbb" }}>
                              {bal>0.01?`+${curSymbol}${bal.toFixed(2)}`:bal<-0.01?`-${curSymbol}${Math.abs(bal).toFixed(2)}`:"✓"}
                            </div>
                            <button onClick={()=>removePerson(p.id)} style={{ background:"none",border:"none",fontSize:16,color:"#ddd",cursor:"pointer" }}>✕</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CUENTAS */}
            {tab==="cuentas"&&(
              <div className="fi">
                <div className="card" style={{ padding:20,marginBottom:16 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:"#bbb",letterSpacing:0.6,textTransform:"uppercase",marginBottom:14 }}>Balances</div>
                  {(active.people||[]).length===0?(
                    <div style={{ fontSize:14,color:"#bbb",textAlign:"center",padding:"16px 0" }}>Agregá personas primero</div>
                  ):(active.people||[]).map(p=>{
                    const bal=balances[p.id]||0;
                    return (
                      <div key={p.id} className="row" style={{ justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid #f7f7f5" }}>
                        <div className="row" style={{ gap:10 }}>
                          <Avatar name={p.name} color={p.color} bg={p.bg} size={30}/>
                          <span style={{ fontWeight:600,fontSize:14 }}>{p.name}</span>
                        </div>
                        <div style={{ fontWeight:700,fontSize:14,color:bal>0.01?"#4CAF82":bal<-0.01?"#E8734A":"#bbb" }}>
                          {bal>0.01?`le deben ${curSymbol}${bal.toFixed(2)}`:bal<-0.01?`debe ${curSymbol}${Math.abs(bal).toFixed(2)}`:"al día ✓"}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="card" style={{ padding:20,marginBottom:16 }}>
                  <div className="row" style={{ justifyContent:"space-between", marginBottom:14 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:"#bbb",letterSpacing:0.6,textTransform:"uppercase" }}>¿Quién paga a quién?</div>
                    {settlements.length>0&&(
                      <div style={{ fontSize:11,color:"#bbb" }}>
                        {settlements.filter((_,i)=>(active.paidSettlements||{})[`${i}`]).length}/{settlements.length} pagados
                      </div>
                    )}
                  </div>
                  {settlements.length===0?(
                    <div style={{ fontSize:14,color:"#bbb",textAlign:"center",padding:"16px 0" }}>
                      {(active.people||[]).length===0?"Agregá personas y gastos":"✓ Todos al día"}
                    </div>
                  ):settlements.map((s,i)=>{
                    const from=getPerson(active,s.from);
                    const to  =getPerson(active,s.to);
                    if (!from||!to) return null;
                    const key=`${i}`;
                    const paid=(active.paidSettlements||{})[key];
                    return (
                      <div key={i} style={{ background:paid?"#f0faf5":"#f7f7f5",borderRadius:14,padding:"12px 14px",marginBottom:8,transition:"background 0.3s",border:paid?"1.5px solid #c8eedd":"1.5px solid transparent" }}>
                        <div className="row" style={{ justifyContent:"space-between",marginBottom:6 }}>
                          <div className="row" style={{ gap:8 }}>
                            <Avatar name={from.name} color={from.color} bg={from.bg} size={26}/>
                            <span style={{ fontSize:14,fontWeight:600,textDecoration:paid?"line-through":"none",color:paid?"#aaa":"#1a1a1a" }}>{from.name}</span>
                          </div>
                          <div className="row" style={{ gap:10 }}>
                            <span style={{ fontWeight:800,fontSize:17,color:paid?"#aaa":"#1a1a1a",textDecoration:paid?"line-through":"none" }}>{curSymbol}{s.amount.toFixed(2)}</span>
                            <button onClick={()=>toggleSettlement(key)}
                              style={{ width:28,height:28,borderRadius:"50%",border:`2px solid ${paid?"#4CAF82":"#ddd"}`,background:paid?"#4CAF82":"white",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s" }}>
                              {paid&&<span style={{ color:"white",fontSize:14,fontWeight:700 }}>✓</span>}
                            </button>
                          </div>
                        </div>
                        <div className="row" style={{ gap:6,paddingLeft:4 }}>
                          <span style={{ fontSize:12,color:"#bbb" }}>→ para</span>
                          <Avatar name={to.name} color={to.color} bg={to.bg} size={20}/>
                          <span style={{ fontSize:13,fontWeight:600,color:paid?"#aaa":"#555" }}>{to.name}</span>
                        </div>
                        {paid&&(
                          <div style={{ fontSize:11,color:"#4CAF82",fontWeight:600,marginTop:6,paddingLeft:4 }}>✓ Pagado</div>
                        )}
                      </div>
                    );
                  })}
                  {settlements.length>0&&settlements.every((_,i)=>(active.paidSettlements||{})[`${i}`])&&(
                    <div style={{ textAlign:"center",padding:"12px 0 4px",fontSize:14,fontWeight:700,color:"#4CAF82" }}>
                      🎉 ¡Todos los pagos completados!
                    </div>
                  )}
                </div>

                {/* Conversión de moneda */}
                {Object.keys(rates).length>0&&(active.expenses||[]).length>0&&(
                  <div className="card" style={{ padding:20 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:"#bbb",letterSpacing:0.6,textTransform:"uppercase",marginBottom:14 }}>Equivalencias actuales</div>
                    {CURRENCIES.filter(c=>c.code!==(active.currency||"UYU")).map(c=>{
                      const converted=convertAmount(totalGastos(active),active.currency||"UYU",c.code);
                      return (
                        <div key={c.code} className="row" style={{ justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f7f7f5" }}>
                          <span style={{ fontSize:14,color:"#555" }}>{c.name}</span>
                          <span style={{ fontWeight:700,fontSize:14 }}>{c.symbol}{converted.toFixed(2)}</span>
                        </div>
                      );
                    })}
                    <div style={{ fontSize:11,color:"#bbb",marginTop:10 }}>Tasas actualizadas en tiempo real</div>
                  </div>
                )}
              </div>
            )}

            {/* GRÁFICA */}
            {tab==="gráfica"&&(
              <div className="fi">
                {chartData.length===0||totalGastos(active)===0?(
                  <div style={{ textAlign:"center",padding:"60px 0",color:"#bbb",fontSize:14 }}>
                    <div style={{ fontSize:36,marginBottom:12 }}>📊</div>
                    Agregá gastos para ver la gráfica
                  </div>
                ):(
                  <>
                    <div className="card" style={{ padding:24,marginBottom:16,display:"flex",flexDirection:"column",alignItems:"center" }}>
                      <div style={{ fontSize:12,fontWeight:700,color:"#bbb",letterSpacing:0.6,textTransform:"uppercase",marginBottom:20,alignSelf:"flex-start" }}>Gasto por persona</div>
                      <DonutChart data={chartData} size={180}/>
                      <div style={{ width:"100%",marginTop:24,display:"flex",flexDirection:"column",gap:10 }}>
                        {chartData.map((d,i)=>(
                          <div key={i}>
                            <div className="row" style={{ justifyContent:"space-between",marginBottom:6 }}>
                              <div className="row" style={{ gap:8 }}>
                                <div style={{ width:10,height:10,borderRadius:"50%",background:d.color,flexShrink:0 }}/>
                                <span style={{ fontSize:14,fontWeight:600 }}>{d.name}</span>
                              </div>
                              <div className="row" style={{ gap:8 }}>
                                <span style={{ fontSize:13,color:"#888" }}>{curSymbol}{d.amount.toFixed(2)}</span>
                                <span style={{ fontSize:13,fontWeight:700,minWidth:36,textAlign:"right" }}>{d.pct}%</span>
                              </div>
                            </div>
                            <div style={{ height:6,background:"#f0f0ed",borderRadius:3,overflow:"hidden" }}>
                              <div style={{ height:"100%",width:`${d.pct}%`,background:d.color,borderRadius:3,transition:"width 0.6s cubic-bezier(.4,0,.2,1)" }}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="card" style={{ padding:20 }}>
                      <div style={{ fontSize:12,fontWeight:700,color:"#bbb",letterSpacing:0.6,textTransform:"uppercase",marginBottom:14 }}>Resumen</div>
                      <div className="row" style={{ justifyContent:"space-between",marginBottom:8 }}>
                        <span style={{ fontSize:14,color:"#555" }}>Total gastado</span>
                        <span style={{ fontWeight:800,fontSize:16 }}>{curSymbol}{totalGastos(active).toFixed(2)}</span>
                      </div>
                      <div className="row" style={{ justifyContent:"space-between",marginBottom:8 }}>
                        <span style={{ fontSize:14,color:"#555" }}>Promedio por persona</span>
                        <span style={{ fontWeight:700,fontSize:14 }}>{curSymbol}{((active.people||[]).length>0?totalGastos(active)/(active.people||[]).length:0).toFixed(2)}</span>
                      </div>
                      <div className="row" style={{ justifyContent:"space-between" }}>
                        <span style={{ fontSize:14,color:"#555" }}>Cantidad de gastos</span>
                        <span style={{ fontWeight:700,fontSize:14 }}>{(active.expenses||[]).length}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Nuevo grupo */}
      {showNewModal&&(
        <div className="modal-bg fi" onClick={e=>{if(e.target===e.currentTarget)setShowNewModal(false)}}>
          <div className="modal">
            <div style={{ fontWeight:800,fontSize:20,marginBottom:6 }}>Nuevo grupo</div>
            <div style={{ fontSize:13,color:"#bbb",marginBottom:20 }}>Dale un nombre y elegí la moneda</div>
            <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
              <input placeholder='Ej: "Asado", "Viaje a Colonia"...' value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createGroup()} autoFocus maxLength={60}/>
              <select value={newGroupCur} onChange={e=>setNewGroupCur(e.target.value)}>
                {CURRENCIES.map(c=><option key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</option>)}
              </select>
              <button className="btn" onClick={createGroup} style={{ marginTop:4 }}>Crear grupo</button>
              <button onClick={()=>setShowNewModal(false)} style={{ background:"none",border:"none",width:"100%",padding:"14px",fontSize:14,color:"#bbb",cursor:"pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Unirse */}
      {showJoinModal&&(
        <div className="modal-bg fi" onClick={e=>{if(e.target===e.currentTarget){setShowJoinModal(false);setJoinError("");}}}>
          <div className="modal">
            <div style={{ fontWeight:800,fontSize:20,marginBottom:6 }}>Unirse a un grupo</div>
            <div style={{ fontSize:13,color:"#bbb",marginBottom:20 }}>Pedile el código a quien creó el grupo</div>
            <input placeholder="Código del grupo" value={joinCode} onChange={e=>{setJoinCode(e.target.value);setJoinError("");}} onKeyDown={e=>e.key==="Enter"&&joinGroup()} autoFocus style={{ marginBottom:joinError?8:14,fontFamily:"monospace",letterSpacing:1 }}/>
            {joinError&&<div style={{ fontSize:13,color:"#E8734A",marginBottom:14 }}>{joinError}</div>}
            <button className="btn" onClick={joinGroup}>Unirme</button>
            <button onClick={()=>{setShowJoinModal(false);setJoinError("");}} style={{ background:"none",border:"none",width:"100%",padding:"14px",fontSize:14,color:"#bbb",cursor:"pointer",marginTop:4 }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* MODAL: Perfil */}
      {showProfile&&(
        <div className="modal-bg fi" onClick={e=>{if(e.target===e.currentTarget)setShowProfile(false)}}>
          <div className="modal">
            <div style={{ display:"flex",alignItems:"center",gap:16,marginBottom:24 }}>
              <Avatar name={user.displayName||user.email} photo={user.photoURL} size={56}/>
              <div>
                <div style={{ fontWeight:800,fontSize:18 }}>{user.displayName||"Usuario"}</div>
                <div style={{ fontSize:13,color:"#bbb",marginTop:2 }}>{user.email}</div>
              </div>
            </div>
            <div style={{ background:"#f7f7f5",borderRadius:14,padding:"14px 16px",marginBottom:20 }}>
              <div style={{ fontSize:12,color:"#bbb",marginBottom:4 }}>Grupos activos</div>
              <div style={{ fontWeight:800,fontSize:22 }}>{openGroups.length}</div>
            </div>
            <button onClick={logout} style={{ background:"none",border:"1.5px solid #fdeee8",borderRadius:14,padding:14,fontSize:15,fontWeight:600,cursor:"pointer",width:"100%",color:"#E8734A" }}>
              Cerrar sesión
            </button>
            <button onClick={()=>setShowProfile(false)} style={{ background:"none",border:"none",width:"100%",padding:"14px",fontSize:14,color:"#bbb",cursor:"pointer",marginTop:4 }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
