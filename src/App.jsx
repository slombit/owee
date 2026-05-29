import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "./firebase.js";
import { ref, onValue, set, remove } from "firebase/database";

const COLORS = ["#1a1a1a","#555","#4A90D9","#E8734A","#4CAF82","#9B59B6","#E74C3C","#F39C12","#16A085","#e91e8c"];
const PASTEL  = ["#f5f5f5","#eee","#ddeeff","#fdeee8","#e8f8ef","#f3eaf8","#fde8e8","#fef6e4","#e4f4f1","#fce4f3"];

const genId     = () => Math.random().toString(36).slice(2,11) + Math.random().toString(36).slice(2,11) + Date.now().toString(36);
const today     = () => new Date().toLocaleDateString("es-UY");
const sanitize  = (str, max = 80) => String(str || "").trim().slice(0, max);
const safeAmt   = (val) => { const n = parseFloat(val); return (!isNaN(n) && n > 0 && n < 1000000) ? n : null; };
const makeGroup = (title = "Nuevo grupo") => ({ id: genId(), title, people: [], expenses: [], createdAt: today(), closed: false });

export default function App() {
  const [screen,        setScreen]        = useState("home");
  const [groups,        setGroups]        = useState([]);
  const [activeId,      setActiveId]      = useState(null);
  const [tab,           setTab]           = useState("gastos");
  const [newPerson,     setNewPerson]     = useState("");
  const [newExp,        setNewExp]        = useState({ desc: "", amount: "", paidBy: "", splitWith: [] });
  const [copied,        setCopied]        = useState(false);
  const [editTitle,     setEditTitle]     = useState(false);
  const [titleInput,    setTitleInput]    = useState("");
  const [showNewModal,  setShowNewModal]  = useState(false);
  const [newGroupName,  setNewGroupName]  = useState("");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode,      setJoinCode]      = useState("");
  const [joinError,     setJoinError]     = useState("");
  const [syncing,       setSyncing]       = useState(false);

  const listeners = useRef({});
  const active    = groups.find(g => g.id === activeId);

  useEffect(() => {
    const saved = localStorage.getItem("owee-groups");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setGroups(parsed);
        parsed.forEach(g => subscribeToGroup(g.id));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (groups.length > 0) {
      localStorage.setItem("owee-groups", JSON.stringify(groups));
    }
  }, [groups]);

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
    set(ref(db, `groups/${group.id}`), group)
      .finally(() => setTimeout(() => setSyncing(false), 800));
  }, []);

  const createGroup = () => {
    const name = sanitize(newGroupName, 60) || "Nuevo grupo";
    const g    = makeGroup(name);
    setGroups(prev => [...prev, g]);
    saveToFirebase(g);
    subscribeToGroup(g.id);
    setActiveId(g.id);
    setScreen("group");
    setTab("gastos");
    setShowNewModal(false);
    setNewGroupName("");
  };

  const joinGroup = () => {
    const code = joinCode.trim().replace(/[^a-z0-9]/gi, "").slice(0, 50);
    if (!code || code.length < 3) { setJoinError("Código inválido."); return; }
    setJoinError("");
    const groupRef = ref(db, `groups/${code}`);
    onValue(groupRef, (snap) => {
      const data = snap.val();
      if (!data) { setJoinError("No encontré ese grupo. Revisá el código."); return; }
      setGroups(prev => {
        if (prev.find(g => g.id === code)) return prev;
        return [...prev, data];
      });
      subscribeToGroup(code);
      setActiveId(code);
      setScreen("group");
      setTab("gastos");
      setShowJoinModal(false);
      setJoinCode("");
    }, { onlyOnce: true });
  };

  const updateActive = useCallback((fn) => {
    setGroups(prev => {
      const updated  = prev.map(g => g.id === activeId ? fn(g) : g);
      const newGroup = updated.find(g => g.id === activeId);
      if (newGroup) saveToFirebase(newGroup);
      return updated;
    });
  }, [activeId, saveToFirebase]);

  const deleteGroup = (id) => {
    if (listeners.current[id]) { listeners.current[id](); delete listeners.current[id]; }
    setGroups(prev => prev.filter(g => g.id !== id));
    remove(ref(db, `groups/${id}`)).catch(() => {});
    const saved = JSON.parse(localStorage.getItem("owee-groups") || "[]");
    localStorage.setItem("owee-groups", JSON.stringify(saved.filter(g => g.id !== id)));
  };

  const openGroup = (id) => { setActiveId(id); setScreen("group"); setTab("gastos"); };

  const addPerson = () => {
    const name = sanitize(newPerson, 40);
    if (!name || !active || (active.people || []).find(p => p.name === name)) return;
    if ((active.people || []).length >= 20) return;
    const idx = (active.people || []).length;
    updateActive(g => ({ ...g, people: [...(g.people || []), { id: genId(), name, color: COLORS[idx % COLORS.length], bg: PASTEL[idx % PASTEL.length] }] }));
    setNewPerson("");
  };

  const removePerson = (pid) => updateActive(g => ({
    ...g,
    people:   (g.people   || []).filter(p => p.id !== pid),
    expenses: (g.expenses || []).filter(e => e.paidBy !== pid && !e.splitWith.includes(pid))
  }));

  const addExpense = () => {
    const cleanDesc = sanitize(newExp.desc, 100);
    const cleanAmt  = safeAmt(newExp.amount);
    const { paidBy, splitWith } = newExp;
    if (!cleanDesc || !cleanAmt || !paidBy || splitWith.length === 0) return;
    if ((active.expenses || []).length >= 200) return;
    updateActive(g => ({ ...g, expenses: [...(g.expenses || []), { id: genId(), desc: cleanDesc, amount: cleanAmt, paidBy, splitWith, date: today() }] }));
    setNewExp({ desc: "", amount: "", paidBy: "", splitWith: [] });
  };

  const removeExpense = (eid) => updateActive(g => ({ ...g, expenses: (g.expenses || []).filter(e => e.id !== eid) }));
  const toggleSplit   = (pid)  => setNewExp(e => ({ ...e, splitWith: e.splitWith.includes(pid) ? e.splitWith.filter(i => i !== pid) : [...e.splitWith, pid] }));

  const getBalances = (group) => {
    const bal = {};
    (group.people   || []).forEach(p   => bal[p.id] = 0);
    (group.expenses || []).forEach(exp => {
      const share = exp.amount / exp.splitWith.length;
      exp.splitWith.forEach(pid => { bal[pid] = (bal[pid] || 0) - share; });
      bal[exp.paidBy] = (bal[exp.paidBy] || 0) + exp.amount;
    });
    return bal;
  };

  const getSettlements = (group) => {
    const result = [];
    const b   = { ...getBalances(group) };
    const ids = Object.keys(b);
    if (!ids.length) return [];
    for (let i = 0; i < 30; i++) {
      const cr  = ids.reduce((a, c) => b[c] > b[a] ? c : a, ids[0]);
      const db2 = ids.reduce((a, c) => b[c] < b[a] ? c : a, ids[0]);
      if (Math.abs(b[cr]) < 0.01) break;
      const amt = Math.min(b[cr], -b[db2]);
      if (amt < 0.01) break;
      result.push({ from: db2, to: cr, amount: Math.round(amt * 100) / 100 });
      b[cr] -= amt; b[db2] += amt;
    }
    return result;
  };

  const shareGroup = useCallback(() => {
    if (!active) return;
    const total    = (active.expenses || []).reduce((s, e) => s + e.amount, 0);
    const settles  = getSettlements(active);
    const people   = active.people   || [];
    const expenses = active.expenses || [];
    let msg = `🧾 *${active.title}*\n📅 ${active.createdAt}\n👥 ${people.map(p => p.name).join(", ")}\n💰 Total: *$${total.toFixed(2)}*\n🔑 Código: \`${active.id}\`\n\n`;
    if (expenses.length > 0) {
      msg += `📋 *Gastos:*\n`;
      expenses.forEach(exp => {
        const payer = people.find(p => p.id === exp.paidBy);
        msg += `• ${exp.desc}: $${exp.amount.toFixed(2)} (pagó ${payer?.name || "?"})\n`;
      });
      msg += `\n`;
    }
    if (settles.length === 0) { msg += `✅ *Todos al día!*\n`; }
    else {
      msg += `💸 *¿Quién paga a quién?*\n`;
      settles.forEach(s => {
        const from = people.find(p => p.id === s.from);
        const to   = people.find(p => p.id === s.to);
        msg += `• ${from?.name} le paga *$${s.amount.toFixed(2)}* a ${to?.name}\n`;
      });
    }
    msg += `\n_Hecho con Owee_ 🤙`;
    const copy = (text) => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); }).catch(fb);
      } else fb();
      function fb() {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        try { document.execCommand("copy"); } catch {}
        document.body.removeChild(ta);
        setCopied(true); setTimeout(() => setCopied(false), 2500);
      }
    };
    copy(msg);
  }, [active]);

  const getPerson   = (group, id) => (group.people || []).find(p => p.id === id);
  const totalGastos = (g) => (g.expenses || []).reduce((s, e) => s + e.amount, 0);
  const openGroups  = groups.filter(g => !g.closed);
  const balances    = active ? getBalances(active)    : {};
  const settlements = active ? getSettlements(active) : [];

  const Avatar = ({ name, color, bg, size = 36 }) => (
    <div style={{ width:size, height:size, borderRadius:"50%", background:bg||"#f0f0f0", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:size*0.38, color:color||"#333", flexShrink:0, border:"1.5px solid rgba(0,0,0,0.06)" }}>
      {name?.[0]?.toUpperCase()}
    </div>
  );

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
        .press{transition:transform 0.1s;cursor:pointer;}
        .press:active{transform:scale(0.97);}
        @keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        .su{animation:slideUp 0.22s ease forwards;}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .fi{animation:fadeIn 0.18s ease;}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,0.45);display:flex;align-items:flex-end;justify-content:center;z-index:200;}
        .modal{background:white;border-radius:24px 24px 0 0;padding:28px 24px 44px;width:100%;max-width:430px;}
        .sync{position:fixed;top:16px;right:16px;background:#1a1a1a;color:white;border-radius:50px;padding:6px 14px;font-size:12px;font-weight:700;z-index:300;opacity:0.85;}
        ::-webkit-scrollbar{display:none;}
      `}</style>

      {syncing && <div className="sync">⟳ Sincronizando...</div>}

      {/* HOME */}
      {screen === "home" && (
        <div className="su" style={{ paddingBottom:60 }}>
          <div style={{ padding:"60px 24px 28px", background:"#1a1a1a", borderRadius:"0 0 28px 28px" }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:8, marginBottom:4 }}>
              <h1 style={{ fontSize:38, fontWeight:800, color:"white", letterSpacing:"-1.5px", lineHeight:1 }}>Owee</h1>
              <span style={{ fontSize:11, color:"rgba(255,255,255,0.28)", marginBottom:6 }}>by patro</span>
            </div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:22 }}>Dividí gastos sin drama</div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="pill" style={{ background:"white", color:"#1a1a1a", fontSize:14, padding:"11px 20px" }} onClick={() => setShowNewModal(true)}>+ Nuevo grupo</button>
              <button className="pill" style={{ background:"rgba(255,255,255,0.1)", border:"1.5px solid rgba(255,255,255,0.2)", color:"white", fontSize:14, padding:"11px 20px" }} onClick={() => setShowJoinModal(true)}>Unirse</button>
            </div>
          </div>
          <div style={{ padding:"24px 24px 0" }}>
            {openGroups.length === 0 ? (
              <div style={{ textAlign:"center", padding:"70px 0" }}>
                <div style={{ fontSize:44, marginBottom:14 }}>🧾</div>
                <div style={{ fontSize:16, color:"#999", fontWeight:600 }}>No tenés grupos activos</div>
                <div style={{ fontSize:13, color:"#bbb", marginTop:6 }}>Creá uno o unite con un código</div>
              </div>
            ) : (
              <>
                <div style={{ fontSize:12, fontWeight:700, color:"#bbb", letterSpacing:0.8, textTransform:"uppercase", marginBottom:14 }}>Activos</div>
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {openGroups.map(g => (
                    <div key={g.id} className="card press" onClick={() => openGroup(g.id)} style={{ padding:"18px 20px" }}>
                      <div className="row" style={{ justifyContent:"space-between", marginBottom:14 }}>
                        <div>
                          <div style={{ fontWeight:700, fontSize:16 }}>{g.title}</div>
                          <div style={{ fontSize:12, color:"#bbb", marginTop:2 }}>{g.createdAt} · {(g.expenses||[]).length} gastos</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontWeight:800, fontSize:20 }}>${totalGastos(g).toFixed(2)}</div>
                          <div style={{ fontSize:11, color:"#bbb" }}>total</div>
                        </div>
                      </div>
                      <div className="row" style={{ gap:6 }}>
                        {(g.people||[]).slice(0,6).map(p => <Avatar key={p.id} name={p.name} color={p.color} bg={p.bg} size={28} />)}
                        {(g.people||[]).length > 6 && <div style={{ width:28, height:28, borderRadius:"50%", background:"#f0f0ed", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#999", fontWeight:700 }}>+{g.people.length-6}</div>}
                        {(g.people||[]).length === 0 && <div style={{ fontSize:12, color:"#bbb" }}>Sin personas</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* GROUP VIEW */}
      {screen === "group" && active && (
        <div className="su" style={{ paddingBottom:80 }}>
          <div style={{ background:"white", borderBottom:"1px solid #f0f0ed" }}>
            <div style={{ padding:"56px 24px 0" }}>
              <div className="row" style={{ justifyContent:"space-between", marginBottom:6 }}>
                <button onClick={() => setScreen("home")} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", padding:"0 10px 0 0" }}>←</button>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="pill" style={{ fontSize:12, padding:"6px 14px", background:copied?"#1a1a1a":"white", color:copied?"white":"#1a1a1a", borderColor:copied?"#1a1a1a":"#e8e8e5" }} onClick={shareGroup}>
                    {copied ? "✓ Copiado!" : "📋 Compartir"}
                  </button>
                  <button className="pill" style={{ fontSize:12, padding:"6px 14px", color:"#E8734A", borderColor:"#fdeee8" }}
                    onClick={() => { deleteGroup(activeId); setActiveId(null); setScreen("home"); }}>
                    Eliminar
                  </button>
                </div>
              </div>
              {editTitle ? (
                <input value={titleInput} onChange={e => setTitleInput(e.target.value)}
                  onBlur={() => { updateActive(g => ({ ...g, title: sanitize(titleInput,60) || g.title })); setEditTitle(false); }}
                  onKeyDown={e => { if (e.key==="Enter") { updateActive(g => ({ ...g, title: sanitize(titleInput,60)||g.title })); setEditTitle(false); }}}
                  autoFocus maxLength={60}
                  style={{ fontSize:24, fontWeight:800, background:"transparent", border:"none", borderBottom:"2px solid #1a1a1a", borderRadius:0, padding:"4px 0", marginBottom:4 }} />
              ) : (
                <div onClick={() => { setTitleInput(active.title); setEditTitle(true); }} style={{ fontSize:24, fontWeight:800, letterSpacing:"-0.5px", marginBottom:2, cursor:"text" }}>
                  {active.title}
                </div>
              )}
              <div style={{ fontSize:11, color:"#bbb", marginBottom:2, fontFamily:"monospace", letterSpacing:0.5 }}>🔑 código: {active.id}</div>
              <div style={{ fontSize:13, color:"#bbb", marginBottom:20 }}>{(active.people||[]).length} personas · ${totalGastos(active).toFixed(2)} total</div>
            </div>
            <div className="row" style={{ padding:"0 24px" }}>
              {["gastos","personas","cuentas"].map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:"12px 0", background:"none", border:"none", fontSize:14, fontWeight:600, cursor:"pointer", color:tab===t?"#1a1a1a":"#bbb", borderBottom:tab===t?"2.5px solid #1a1a1a":"2.5px solid transparent", transition:"all 0.15s" }}>
                  {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding:"20px 24px" }}>
            {/* GASTOS */}
            {tab === "gastos" && (
              <div className="fi">
                <div className="card" style={{ padding:20, marginBottom:20 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#bbb", letterSpacing:0.6, textTransform:"uppercase", marginBottom:14 }}>Nuevo gasto</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    <input placeholder="Descripción (pizza, taxi...)" value={newExp.desc} onChange={e => setNewExp(x=>({...x,desc:e.target.value}))} maxLength={100} />
                    <div style={{ display:"flex", gap:10 }}>
                      <input type="number" placeholder="Monto $" value={newExp.amount} onChange={e => setNewExp(x=>({...x,amount:e.target.value}))} style={{ flex:1 }} min="0" max="999999" />
                      <select value={newExp.paidBy} onChange={e => setNewExp(x=>({...x,paidBy:e.target.value}))} style={{ flex:1 }}>
                        <option value="">¿Quién pagó?</option>
                        {(active.people||[]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    {(active.people||[]).length > 0 && (
                      <div>
                        <div style={{ fontSize:12, color:"#bbb", marginBottom:8 }}>Dividir entre:</div>
                        <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                          {(active.people||[]).map(p => (
                            <button key={p.id} onClick={() => toggleSplit(p.id)} className="pill"
                              style={{ padding:"6px 14px", fontSize:13, background:newExp.splitWith.includes(p.id)?"#1a1a1a":"white", color:newExp.splitWith.includes(p.id)?"white":"#1a1a1a", borderColor:newExp.splitWith.includes(p.id)?"#1a1a1a":"#e8e8e5" }}>
                              {p.name}
                            </button>
                          ))}
                          <button className="pill" style={{ padding:"6px 14px", fontSize:12 }} onClick={() => setNewExp(x=>({...x,splitWith:(active.people||[]).map(p=>p.id)}))}>Todos</button>
                        </div>
                      </div>
                    )}
                    <button className="btn" onClick={addExpense} disabled={(active.people||[]).length===0} style={{ marginTop:4 }}>
                      {(active.people||[]).length===0 ? "Primero agregá personas" : "Agregar gasto"}
                    </button>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {(active.expenses||[]).length===0 ? (
                    <div style={{ textAlign:"center", padding:"40px 0", color:"#bbb", fontSize:14 }}>Sin gastos todavía</div>
                  ) : [...(active.expenses||[])].reverse().map(exp => {
                    const payer = getPerson(active, exp.paidBy);
                    const share = (exp.amount/exp.splitWith.length).toFixed(2);
                    return (
                      <div key={exp.id} className="card" style={{ padding:"16px 18px" }}>
                        <div className="row" style={{ justifyContent:"space-between" }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{exp.desc}</div>
                            <div className="row" style={{ gap:8 }}>
                              {payer && <Avatar name={payer.name} color={payer.color} bg={payer.bg} size={18} />}
                              <span style={{ fontSize:12, color:"#888" }}>pagó {payer?.name} · ÷{exp.splitWith.length} = ${share} c/u</span>
                            </div>
                          </div>
                          <div className="row" style={{ gap:10 }}>
                            <span style={{ fontWeight:800, fontSize:18 }}>${exp.amount.toFixed(2)}</span>
                            <button onClick={() => removeExpense(exp.id)} style={{ background:"none", border:"none", fontSize:16, color:"#ddd", cursor:"pointer" }}>✕</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* PERSONAS */}
            {tab === "personas" && (
              <div className="fi">
                <div className="card" style={{ padding:20, marginBottom:20 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#bbb", letterSpacing:0.6, textTransform:"uppercase", marginBottom:14 }}>Agregar persona</div>
                  <div style={{ display:"flex", gap:10 }}>
                    <input placeholder="Nombre" value={newPerson} onChange={e=>setNewPerson(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPerson()} style={{ flex:1 }} maxLength={40} />
                    <button className="btn" onClick={addPerson} style={{ width:"auto", padding:"12px 20px" }}>+</button>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {(active.people||[]).length===0 ? (
                    <div style={{ textAlign:"center", padding:"40px 0", color:"#bbb", fontSize:14 }}>Agregá a las personas del grupo</div>
                  ) : (active.people||[]).map(p => {
                    const bal = balances[p.id]||0;
                    return (
                      <div key={p.id} className="card" style={{ padding:"16px 18px" }}>
                        <div className="row" style={{ justifyContent:"space-between" }}>
                          <div className="row" style={{ gap:12 }}>
                            <Avatar name={p.name} color={p.color} bg={p.bg} size={40} />
                            <div>
                              <div style={{ fontWeight:700, fontSize:15 }}>{p.name}</div>
                              <div style={{ fontSize:12, color:"#bbb" }}>{(active.expenses||[]).filter(e=>e.splitWith.includes(p.id)).length} gastos</div>
                            </div>
                          </div>
                          <div className="row" style={{ gap:10 }}>
                            <div style={{ fontWeight:800, fontSize:15, color:bal>0.01?"#4CAF82":bal<-0.01?"#E8734A":"#bbb" }}>
                              {bal>0.01?`+$${bal.toFixed(2)}`:bal<-0.01?`-$${Math.abs(bal).toFixed(2)}`:"✓"}
                            </div>
                            <button onClick={()=>removePerson(p.id)} style={{ background:"none", border:"none", fontSize:16, color:"#ddd", cursor:"pointer" }}>✕</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CUENTAS */}
            {tab === "cuentas" && (
              <div className="fi">
                <div className="card" style={{ padding:20, marginBottom:16 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#bbb", letterSpacing:0.6, textTransform:"uppercase", marginBottom:14 }}>Balances</div>
                  {(active.people||[]).length===0 ? (
                    <div style={{ fontSize:14, color:"#bbb", textAlign:"center", padding:"16px 0" }}>Agregá personas primero</div>
                  ) : (active.people||[]).map(p => {
                    const bal=balances[p.id]||0;
                    return (
                      <div key={p.id} className="row" style={{ justifyContent:"space-between", padding:"10px 0", borderBottom:"1px solid #f7f7f5" }}>
                        <div className="row" style={{ gap:10 }}>
                          <Avatar name={p.name} color={p.color} bg={p.bg} size={30} />
                          <span style={{ fontWeight:600, fontSize:14 }}>{p.name}</span>
                        </div>
                        <div style={{ fontWeight:700, fontSize:14, color:bal>0.01?"#4CAF82":bal<-0.01?"#E8734A":"#bbb" }}>
                          {bal>0.01?`le deben $${bal.toFixed(2)}`:bal<-0.01?`debe $${Math.abs(bal).toFixed(2)}`:"al día ✓"}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="card" style={{ padding:20 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:"#bbb", letterSpacing:0.6, textTransform:"uppercase", marginBottom:14 }}>¿Quién paga a quién?</div>
                  {settlements.length===0 ? (
                    <div style={{ fontSize:14, color:"#bbb", textAlign:"center", padding:"16px 0" }}>
                      {(active.people||[]).length===0?"Agregá personas y gastos":"✓ Todos al día"}
                    </div>
                  ) : settlements.map((s,i) => {
                    const from=getPerson(active,s.from);
                    const to=getPerson(active,s.to);
                    if (!from||!to) return null;
                    return (
                      <div key={i} style={{ background:"#f7f7f5", borderRadius:14, padding:"12px 14px", marginBottom:8 }}>
                        <div className="row" style={{ justifyContent:"space-between", marginBottom:6 }}>
                          <div className="row" style={{ gap:8 }}>
                            <Avatar name={from.name} color={from.color} bg={from.bg} size={26} />
                            <span style={{ fontSize:14, fontWeight:600 }}>{from.name}</span>
                          </div>
                          <span style={{ fontWeight:800, fontSize:17 }}>${s.amount.toFixed(2)}</span>
                        </div>
                        <div className="row" style={{ gap:6, paddingLeft:4 }}>
                          <span style={{ fontSize:12, color:"#bbb" }}>→ para</span>
                          <Avatar name={to.name} color={to.color} bg={to.bg} size={20} />
                          <span style={{ fontSize:13, fontWeight:600, color:"#555" }}>{to.name}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL nuevo grupo */}
      {showNewModal && (
        <div className="modal-bg fi" onClick={e=>{if(e.target===e.currentTarget)setShowNewModal(false)}}>
          <div className="modal">
            <div style={{ fontWeight:800, fontSize:20, marginBottom:6 }}>Nuevo grupo</div>
            <div style={{ fontSize:13, color:"#bbb", marginBottom:20 }}>Dale un nombre para identificarlo</div>
            <input placeholder='Ej: "Asado", "Viaje a Colonia"...' value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createGroup()} autoFocus maxLength={60} style={{ marginBottom:14 }} />
            <button className="btn" onClick={createGroup}>Crear grupo</button>
            <button onClick={()=>setShowNewModal(false)} style={{ background:"none", border:"none", width:"100%", padding:"14px", fontSize:14, color:"#bbb", cursor:"pointer", marginTop:4 }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* MODAL unirse */}
      {showJoinModal && (
        <div className="modal-bg fi" onClick={e=>{if(e.target===e.currentTarget){setShowJoinModal(false);setJoinError("");}}}>
          <div className="modal">
            <div style={{ fontWeight:800, fontSize:20, marginBottom:6 }}>Unirse a un grupo</div>
            <div style={{ fontSize:13, color:"#bbb", marginBottom:20 }}>Pedile el código a quien creó el grupo</div>
            <input placeholder="Código del grupo" value={joinCode} onChange={e=>{setJoinCode(e.target.value);setJoinError("");}} onKeyDown={e=>e.key==="Enter"&&joinGroup()} autoFocus style={{ marginBottom:joinError?8:14, fontFamily:"monospace", letterSpacing:1 }} />
            {joinError && <div style={{ fontSize:13, color:"#E8734A", marginBottom:14 }}>{joinError}</div>}
            <button className="btn" onClick={joinGroup}>Unirme</button>
            <button onClick={()=>{setShowJoinModal(false);setJoinError("");}} style={{ background:"none", border:"none", width:"100%", padding:"14px", fontSize:14, color:"#bbb", cursor:"pointer", marginTop:4 }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
