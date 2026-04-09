import React, { useState, useEffect, useRef, useCallback } from 'react';
import T from './theme';
import FOOD_DB, { MEALS } from './data/foods';

/* ═══════════════ HELPERS ═══════════════ */
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const emptyDay = () => ({ breakfast: [], lunch: [], snack: [], dinner: [] });
const dayTotals = (meals) => Object.values(meals).flat().reduce(
  (a, f) => ({ cal: a.cal+f.cal, protein: a.protein+f.protein, carbs: a.carbs+f.carbs, fat: a.fat+f.fat }),
  { cal:0, protein:0, carbs:0, fat:0 }
);
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

/* ═══════════════ SMALL COMPONENTS ═══════════════ */

function SemiGauge({ value, max, size = 170 }) {
  const sw = 13;
  const r = (size - sw) / 2;
  const halfCirc = Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <div style={{ position:'relative', width:size, height: size/2 + 28 }}>
      <svg width={size} height={size/2 + sw} viewBox={`0 0 ${size} ${size/2+sw}`}>
        <path d={`M ${sw/2} ${size/2} A ${r} ${r} 0 0 1 ${size-sw/2} ${size/2}`}
          fill="none" stroke={T.border} strokeWidth={sw} strokeLinecap="round"/>
        <path d={`M ${sw/2} ${size/2} A ${r} ${r} 0 0 1 ${size-sw/2} ${size/2}`}
          fill="none" stroke={T.accent} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={halfCirc} strokeDashoffset={halfCirc*(1-pct)}
          style={{ transition:'stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)' }}/>
      </svg>
      <div style={{ position:'absolute', left:'50%', bottom:8, transform:'translateX(-50%)', textAlign:'center' }}>
        <div style={{ fontSize:'clamp(26px,7vw,38px)', fontWeight:800, color:T.text, lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:12, color:T.textTer, marginTop:2 }}>kcal</div>
      </div>
    </div>
  );
}

function MacroPill({ label, value, max, color, bg }) {
  return (
    <div style={{ flex:1, background:T.white, borderRadius:14, padding:'clamp(10px,2.5vw,14px)', boxShadow:T.shadow, textAlign:'center' }}>
      <div style={{ width:32, height:32, borderRadius:8, background:bg, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 6px' }}>
        <div style={{ width:10, height:10, borderRadius:'50%', background:color }}/>
      </div>
      <div style={{ fontSize:10, color:T.textTer, textTransform:'uppercase', letterSpacing:.5, marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:'clamp(13px,3.2vw,15px)', fontWeight:700, color:T.text }}>
        {Math.round(value)}<span style={{ fontWeight:400, color:T.textTer, fontSize:10 }}>/{max}g</span>
      </div>
    </div>
  );
}

function MealCard({ meal, items, onAdd, onRemove }) {
  const mealCal = items.reduce((s,f) => s+f.cal, 0);
  return (
    <div style={{ background:T.white, borderRadius:18, padding:'clamp(12px,3vw,16px)', marginBottom:10, boxShadow:T.shadow }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: items.length ? 10 : 0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>{meal.icon}</span>
          <span style={{ color:T.text, fontSize:'clamp(13px,3.5vw,15px)', fontWeight:600 }}>{meal.label}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {mealCal > 0 && <span style={{ color:T.accent, fontSize:13, fontWeight:700 }}>{mealCal} kcal</span>}
          <button onClick={onAdd} style={{ width:32, height:32, borderRadius:10, background:T.accentLight, border:`1.5px solid ${T.accent}33`, color:T.accent, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
        </div>
      </div>
      {items.map(f => (
        <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop:`1px solid ${T.border}` }}>
          <span style={{ fontSize:20 }}>{f.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ color:T.text, fontSize:13, fontWeight:500 }}>{f.name}</div>
            <div style={{ color:T.textTer, fontSize:10 }}>{f.grams}g · P:{f.protein}g · G:{f.carbs}g · L:{f.fat}g</div>
          </div>
          <span style={{ color:T.accent, fontSize:13, fontWeight:700 }}>{f.cal}</span>
          <button onClick={() => onRemove(f.id)} style={{ color:T.red, fontSize:13, opacity:.6, padding:'0 4px' }}>✕</button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════ MAIN APP ═══════════════ */
export default function App() {
  // ── State ──
  const [screen, setScreen] = useState('splash');
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name:'', email:'', password:'' });

  // All data keyed by "YYYY-MM-DD"
  const [allData, setAllData] = useState({});
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calMonth, setCalMonth] = useState(new Date());

  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState('camera');
  const [manualInput, setManualInput] = useState('');
  const [manualGrams, setManualGrams] = useState('100');
  const [selectedMealType, setSelectedMealType] = useState('lunch');
  const [searchResults, setSearchResults] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedFood, setDetectedFood] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');

  const [tab, setTab] = useState('home');  // home | calendar | profile
  const [dailyGoal] = useState({ cal:2000, protein:150, carbs:250, fat:70 });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);

  // Splash timer
  useEffect(() => { setTimeout(() => { if (screen === 'splash') setScreen('auth'); }, 2000); }, []);

  // Get meals for a given date
  const getMeals = useCallback((date) => {
    const k = dateKey(date);
    return allData[k] || emptyDay();
  }, [allData]);

  const setMealsForDate = useCallback((date, meals) => {
    setAllData(prev => ({ ...prev, [dateKey(date)]: meals }));
  }, []);

  const todayMeals = getMeals(selectedDate);
  const totals = dayTotals(todayMeals);

  /* ── Auth ── */
  const handleAuth = () => {
    if (!authForm.email || !authForm.password) return;
    setUser({ name: authForm.name || authForm.email.split('@')[0], email: authForm.email });
    setScreen('home');
  };

  /* ── Camera ── */
  const startCamera = async () => {
    setCameraActive(true); setCapturedImage(null); setDetectedFood(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' }});
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch { setCameraActive(false); setScanMode('manual'); }
  };
  const stopCamera = () => { if (streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); setCameraActive(false); };
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v,0,0);
    setCapturedImage(c.toDataURL('image/jpeg')); stopCamera();
    setAnalyzing(true);
    setTimeout(() => {
      const keys = Object.keys(FOOD_DB);
      setDetectedFood(FOOD_DB[keys[Math.floor(Math.random()*keys.length)]]);
      setAnalyzing(false);
    }, 2000);
  };

  /* ── Search ── */
  const handleSearch = (text) => {
    setManualInput(text);
    if (text.length < 2) { setSearchResults([]); return; }
    const l = text.toLowerCase();
    const res = Object.entries(FOOD_DB)
      .filter(([k,v]) => k.includes(l) || v.name.toLowerCase().includes(l))
      .map(([,v]) => v)
      .filter((v,i,a) => a.findIndex(x=>x.name===v.name)===i);
    setSearchResults(res);
  };

  /* ── Add / Remove food ── */
  const addFood = (food, grams=100) => {
    const m = grams/100;
    const entry = {
      ...food,
      cal: Math.round(food.cal*m),
      protein: Math.round(food.protein*m*10)/10,
      carbs: Math.round(food.carbs*m*10)/10,
      fat: Math.round(food.fat*m*10)/10,
      grams, id: Date.now()
    };
    const current = getMeals(selectedDate);
    const updated = { ...current, [selectedMealType]: [...current[selectedMealType], entry] };
    setMealsForDate(selectedDate, updated);
    resetScanner();
  };

  const removeFood = (mealId, foodId) => {
    const current = getMeals(selectedDate);
    const updated = { ...current, [mealId]: current[mealId].filter(f => f.id !== foodId) };
    setMealsForDate(selectedDate, updated);
  };

  const resetScanner = () => {
    setShowScanner(false); setManualInput(''); setSearchResults([]);
    setCapturedImage(null); setDetectedFood(null); setScanMode('camera');
    setManualGrams('100');
  };

  /* ── Voice ── */
  const startVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) { setScanMode('manual'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR(); r.lang='fr-FR'; r.continuous=false; r.interimResults=false;
    setIsListening(true);
    r.onresult = (e) => { const t=e.results[0][0].transcript; setVoiceText(t); setIsListening(false); handleSearch(t); setScanMode('manual'); setManualInput(t); };
    r.onerror = () => { setIsListening(false); setScanMode('manual'); };
    r.onend = () => setIsListening(false);
    r.start();
  };

  /* ── Calendar helpers ── */
  const getCalendarDays = (monthDate) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const prevMonth = () => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth()-1, 1));
  const nextMonth = () => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 1));

  const isToday = (d) => d && dateKey(d) === dateKey(new Date());
  const isSelected = (d) => d && dateKey(d) === dateKey(selectedDate);
  const hasData = (d) => {
    if (!d) return false;
    const k = dateKey(d);
    const m = allData[k];
    return m && Object.values(m).flat().length > 0;
  };

  const now = new Date();

  /* ═══════════════ SCREENS ═══════════════ */

  // ── SPLASH ──
  if (screen === 'splash') return (
    <div style={{ height:'100vh', background:T.white, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <div style={{ animation:'fadeIn .8s ease', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🔥</div>
        <div style={{ fontSize:'clamp(22px,6vw,30px)', fontWeight:800, color:T.text }}>Cal's Jo</div>
        <div style={{ fontSize:11, color:T.textTer, letterSpacing:3, textTransform:'uppercase', marginTop:4 }}>Fuel your body</div>
      </div>
    </div>
  );

  // ── AUTH ──
  if (screen === 'auth') return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px clamp(16px,5vw,32px)', animation:'fadeIn .5s ease' }}>
      <div style={{ fontSize:44, marginBottom:10 }}>🔥</div>
      <h1 style={{ fontSize:'clamp(24px,6vw,30px)', fontWeight:800, marginBottom:4 }}>Cal's Jo</h1>
      <p style={{ color:T.textTer, fontSize:13, marginBottom:28 }}>{authMode==='login' ? 'Content de te revoir' : 'Crée ton compte'}</p>
      <div style={{ width:'100%', maxWidth:380 }}>
        <div style={{ display:'flex', background:T.white, borderRadius:14, padding:3, marginBottom:20, boxShadow:T.shadow }}>
          {['login','signup'].map(m => (
            <button key={m} onClick={() => setAuthMode(m)} style={{
              flex:1, padding:'11px 0', borderRadius:12, fontSize:13, fontWeight:600,
              background: authMode===m ? T.accent : 'transparent',
              color: authMode===m ? '#fff' : T.textTer, transition:'all .3s'
            }}>{m==='login' ? 'Connexion' : 'Inscription'}</button>
          ))}
        </div>
        {authMode==='signup' && (
          <input placeholder="Ton prénom" value={authForm.name}
            onChange={e => setAuthForm(p=>({...p, name:e.target.value}))}
            style={inputSt} />
        )}
        <input placeholder="Email" type="email" value={authForm.email}
          onChange={e => setAuthForm(p=>({...p, email:e.target.value}))} style={inputSt} />
        <input placeholder="Mot de passe" type="password" value={authForm.password}
          onChange={e => setAuthForm(p=>({...p, password:e.target.value}))} style={inputSt} />
        <button onClick={handleAuth} style={{
          width:'100%', padding:'14px 0', background:T.accent, borderRadius:14, color:'#fff',
          fontSize:15, fontWeight:700, boxShadow:'0 4px 16px rgba(59,130,246,0.3)'
        }}>{authMode==='login' ? 'Se connecter' : 'Créer mon compte'}</button>
        <button onClick={() => { setUser({ name:'Invité', email:'' }); setScreen('home'); }}
          style={{ width:'100%', padding:'12px 0', border:`1px solid ${T.border}`, borderRadius:14, color:T.textSec, fontSize:13, marginTop:10 }}>
          Continuer sans compte
        </button>
      </div>
    </div>
  );

  /* ── SCANNER MODAL ── */
  const ScannerModal = () => (
    <div style={{ position:'fixed', inset:0, background:T.bg, zIndex:200, display:'flex', flexDirection:'column', animation:'slideUp .3s ease' }}>
      {/* Header */}
      <div style={{ padding:'clamp(12px,3vw,16px) clamp(16px,4vw,20px)', display:'flex', alignItems:'center', justifyContent:'space-between', background:T.white, borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
        <button onClick={() => { resetScanner(); stopCamera(); }} style={{ fontSize:22, color:T.text, padding:4 }}>←</button>
        <span style={{ fontSize:'clamp(14px,3.8vw,16px)', fontWeight:700 }}>Ajouter un aliment</span>
        <div style={{ width:28 }}/>
      </div>
      {/* Date indicator */}
      <div style={{ textAlign:'center', padding:'8px 0', color:T.accent, fontSize:12, fontWeight:600, background:T.accentLight }}>
        {selectedDate.toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' })}
      </div>
      {/* Meal selector */}
      <div style={{ display:'flex', gap:6, padding:'10px 16px', overflowX:'auto', flexShrink:0 }}>
        {MEALS.map(m => (
          <button key={m.id} onClick={() => setSelectedMealType(m.id)} style={{
            padding:'8px clamp(10px,3vw,16px)', borderRadius:20, whiteSpace:'nowrap', fontSize:'clamp(11px,2.8vw,13px)', fontWeight:600,
            background: selectedMealType===m.id ? T.accent : T.white,
            color: selectedMealType===m.id ? '#fff' : T.textSec,
            boxShadow: selectedMealType===m.id ? '0 2px 8px rgba(59,130,246,0.3)' : T.shadow
          }}>{m.icon} {m.label}</button>
        ))}
      </div>
      {/* Mode tabs */}
      <div style={{ display:'flex', gap:6, padding:'4px 16px 8px', flexShrink:0 }}>
        {[{id:'camera',icon:'📸',label:'Photo'},{id:'manual',icon:'✏️',label:'Manuel'},{id:'voice',icon:'🎙️',label:'Vocal'}].map(m => (
          <button key={m.id} onClick={() => { setScanMode(m.id); if(m.id==='camera') startCamera(); else { stopCamera(); if(m.id==='voice') startVoice(); }}} style={{
            flex:1, padding:'10px 0', borderRadius:12, border:`1.5px solid ${scanMode===m.id ? T.accent : T.border}`,
            fontSize:'clamp(11px,2.8vw,12px)', fontWeight:600,
            background: scanMode===m.id ? T.accentLight : T.white,
            color: scanMode===m.id ? T.accent : T.textTer
          }}>{m.icon} {m.label}</button>
        ))}
      </div>
      {/* Content */}
      <div style={{ flex:1, padding:'8px 16px 24px', overflow:'auto' }}>
        {/* Camera */}
        {scanMode==='camera' && (
          <div>
            {!capturedImage && !detectedFood && (
              <div style={{ borderRadius:20, overflow:'hidden', background:'#f0f0f0', position:'relative', aspectRatio:'4/3', marginBottom:12, boxShadow:T.shadowLg }}>
                {cameraActive ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    <div style={{ position:'absolute', inset:'15%', border:`2px dashed ${T.accent}`, borderRadius:20, opacity:.4 }}/>
                    <button onClick={capturePhoto} style={{ position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)', width:64, height:64, borderRadius:'50%', background:T.accent, border:'4px solid white', boxShadow:'0 4px 20px rgba(59,130,246,0.4)' }}/>
                  </>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:T.textTer, padding:32 }}>
                    <div style={{ fontSize:48, marginBottom:12 }}>📷</div>
                    <p style={{ fontSize:13, textAlign:'center', marginBottom:16, lineHeight:1.5 }}>Prends en photo ton repas<br/>ou un code-barre</p>
                    <button onClick={startCamera} style={{ padding:'10px 28px', background:T.accent, borderRadius:10, color:'#fff', fontSize:13, fontWeight:700 }}>Activer la caméra</button>
                  </div>
                )}
              </div>
            )}
            {capturedImage && analyzing && (
              <div style={{ textAlign:'center', padding:48 }}>
                <div style={{ fontSize:48, animation:'spin 1s linear infinite', display:'inline-block' }}>🔍</div>
                <p style={{ color:T.accent, fontSize:14, fontWeight:600, marginTop:16 }}>Analyse en cours...</p>
              </div>
            )}
            {detectedFood && scanMode==='camera' && <FoodConfirm food={detectedFood} grams={manualGrams} setGrams={setManualGrams} onAdd={addFood} onRetry={() => { setDetectedFood(null); setCapturedImage(null); startCamera(); }} mealLabel={MEALS.find(m=>m.id===selectedMealType)?.label}/>}
            <canvas ref={canvasRef} style={{ display:'none' }}/>
            {!capturedImage && !detectedFood && (
              <p style={{ color:T.textTer, fontSize:11, textAlign:'center', marginTop:12, lineHeight:1.6 }}>
                Si la caméra ne fonctionne pas, utilise le mode <b style={{ color:T.accent }}>Manuel</b> ou <b style={{ color:T.accent }}>Vocal</b>
              </p>
            )}
          </div>
        )}
        {/* Manual */}
        {scanMode==='manual' && (
          <div>
            <div style={{ position:'relative', marginBottom:12 }}>
              <input placeholder="Rechercher un aliment..." value={manualInput}
                onChange={e => handleSearch(e.target.value)}
                style={{ width:'100%', padding:'14px 16px 14px 44px', background:T.white, border:`1.5px solid ${T.border}`, borderRadius:14, color:T.text, fontSize:14, outline:'none', boxSizing:'border-box', boxShadow:T.shadow }}/>
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, opacity:.35 }}>🔍</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {searchResults.map((f,i) => (
                <button key={i} onClick={() => { setDetectedFood(f); setSearchResults([]); }}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'clamp(10px,2.5vw,14px) clamp(12px,3vw,16px)', background:T.white, borderRadius:14, boxShadow:T.shadow, textAlign:'left', width:'100%', border:'1.5px solid transparent', transition:'all .2s' }}>
                  <span style={{ fontSize:'clamp(24px,6vw,30px)' }}>{f.icon}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ color:T.text, fontSize:'clamp(13px,3.2vw,14px)', fontWeight:600 }}>{f.name}</div>
                    <div style={{ color:T.textTer, fontSize:'clamp(10px,2.4vw,11px)' }}>pour {f.per}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ color:T.accent, fontSize:'clamp(14px,3.5vw,16px)', fontWeight:700 }}>{f.cal}</div>
                    <div style={{ color:T.textTer, fontSize:10 }}>kcal</div>
                  </div>
                </button>
              ))}
            </div>
            {detectedFood && <FoodConfirm food={detectedFood} grams={manualGrams} setGrams={setManualGrams} onAdd={addFood} onRetry={() => setDetectedFood(null)} mealLabel={MEALS.find(m=>m.id===selectedMealType)?.label} style={{ marginTop:12 }}/>}
            {manualInput.length >= 2 && searchResults.length === 0 && !detectedFood && (
              <div style={{ textAlign:'center', padding:32, color:T.textTer }}>
                <div style={{ fontSize:36, marginBottom:8 }}>🤷</div>
                <p style={{ fontSize:13 }}>Aliment non trouvé</p>
                <p style={{ fontSize:11, marginTop:4 }}>Essaie un autre mot ou le mode vocal</p>
              </div>
            )}
          </div>
        )}
        {/* Voice */}
        {scanMode==='voice' && (
          <div style={{ textAlign:'center', padding:40 }}>
            {isListening ? (
              <>
                <div style={{ width:100, height:100, borderRadius:'50%', background:T.accentLight, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', animation:'pulse 1.5s ease infinite' }}>
                  <div style={{ width:64, height:64, borderRadius:'50%', background:T.accent, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:28 }}>🎙️</div>
                </div>
                <p style={{ color:T.accent, fontSize:16, fontWeight:600 }}>Écoute en cours...</p>
                <p style={{ color:T.textTer, fontSize:12 }}>Dis le nom de ton aliment</p>
              </>
            ) : (
              <>
                <div style={{ fontSize:48, marginBottom:16 }}>🎙️</div>
                <p style={{ color:T.text, fontSize:15, fontWeight:600, marginBottom:4 }}>Entrée vocale</p>
                <p style={{ color:T.textTer, fontSize:12, marginBottom:20, lineHeight:1.5 }}>Dis le nom de l'aliment que tu as mangé</p>
                {voiceText && <p style={{ color:T.accent, fontSize:14, marginBottom:16 }}>« {voiceText} »</p>}
                <button onClick={startVoice} style={{ width:72, height:72, borderRadius:'50%', background:T.accent, fontSize:28, color:'#fff', boxShadow:'0 4px 20px rgba(59,130,246,0.35)' }}>🎙️</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  /* ── Food confirmation card ── */
  function FoodConfirm({ food, grams, setGrams, onAdd, onRetry, mealLabel, style: sx }) {
    return (
      <div style={{ background:T.white, borderRadius:18, padding:20, border:`1.5px solid ${T.accent}33`, boxShadow:T.shadowLg, ...sx }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
          <span style={{ fontSize:36 }}>{food.icon}</span>
          <div>
            <div style={{ color:T.accent, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>Aliment détecté</div>
            <div style={{ color:T.text, fontSize:20, fontWeight:700, marginTop:2 }}>{food.name}</div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:14 }}>
          {[
            { l:'Cal', v:food.cal, c:T.accent },
            { l:'Prot', v:`${food.protein}g`, c:T.green },
            { l:'Gluc', v:`${food.carbs}g`, c:T.orange },
            { l:'Lip', v:`${food.fat}g`, c:T.red },
          ].map(x => (
            <div key={x.l} style={{ background:T.bg, borderRadius:10, padding:'10px 6px', textAlign:'center' }}>
              <div style={{ color:T.textTer, fontSize:9, textTransform:'uppercase' }}>{x.l}</div>
              <div style={{ color:x.c, fontSize:15, fontWeight:700, marginTop:3 }}>{x.v}</div>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <span style={{ color:T.textSec, fontSize:12 }}>Quantité (g):</span>
          <input value={grams} onChange={e => setGrams(e.target.value)} type="number"
            style={{ flex:1, padding:'8px 12px', background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:14, outline:'none' }}/>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onRetry} style={{ flex:1, padding:'12px 0', background:T.bg, border:`1px solid ${T.border}`, borderRadius:12, color:T.textSec, fontSize:13, fontWeight:600 }}>Reprendre</button>
          <button onClick={() => onAdd(food, parseInt(grams)||100)} style={{ flex:2, padding:'12px 0', background:T.accent, borderRadius:12, color:'#fff', fontSize:13, fontWeight:700, boxShadow:'0 2px 10px rgba(59,130,246,0.3)' }}>✓ Ajouter au {mealLabel}</button>
        </div>
      </div>
    );
  }

  /* ═══════════════ HOME TAB ═══════════════ */
  const HomeScreen = () => {
    const isViewingToday = dateKey(selectedDate) === dateKey(new Date());
    return (
      <div style={{ padding:'0 clamp(16px,4vw,24px)', animation:'fadeIn .4s ease' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:'clamp(16px,4vw,24px)', marginBottom:16 }}>
          <div>
            <div style={{ color:T.textTer, fontSize:'clamp(11px,2.6vw,12px)' }}>
              {selectedDate.toLocaleDateString('fr-FR',{ weekday:'short', day:'numeric', month:'long' })}
            </div>
            <h1 style={{ fontSize:'clamp(20px,5.5vw,26px)', fontWeight:800, marginTop:2 }}>
              Hello {user?.name} 👋
            </h1>
          </div>
          <button onClick={() => setTab('profile')} style={{
            width:42, height:42, borderRadius:'50%', background:T.accentLight, border:`1.5px solid ${T.accent}44`,
            color:T.accent, fontSize:16, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center'
          }}>{user?.name?.[0]?.toUpperCase()}</button>
        </div>

        {/* Week strip for quick navigation */}
        <div style={{ display:'flex', gap:4, marginBottom:20 }}>
          {(() => {
            const days = [];
            const ref = new Date(selectedDate);
            const dayOfWeek = ref.getDay() === 0 ? 6 : ref.getDay()-1;
            for (let i = 0; i < 7; i++) {
              const d = new Date(ref);
              d.setDate(ref.getDate() - dayOfWeek + i);
              const isSel = dateKey(d) === dateKey(selectedDate);
              const isTod = dateKey(d) === dateKey(new Date());
              days.push(
                <button key={i} onClick={() => setSelectedDate(new Date(d))} style={{
                  flex:1, padding:'6px 0', borderRadius:12, textAlign:'center', transition:'all .2s',
                  background: isSel ? T.accent : 'transparent',
                  boxShadow: isSel ? '0 2px 8px rgba(59,130,246,0.3)' : 'none'
                }}>
                  <div style={{ fontSize:10, color: isSel ? 'rgba(255,255,255,0.7)' : T.textTer, marginBottom:2 }}>{DAYS_FR[i]}</div>
                  <div style={{ fontSize:14, fontWeight: isTod||isSel ? 700 : 500, color: isSel ? '#fff' : isTod ? T.accent : T.text }}>{d.getDate()}</div>
                </button>
              );
            }
            return days;
          })()}
        </div>

        {/* Gauge */}
        <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
          <SemiGauge value={totals.cal} max={dailyGoal.cal}/>
        </div>
        <div style={{ textAlign:'center', color:T.textTer, fontSize:12, marginBottom:16 }}>
          Objectif : <b style={{ color:T.text }}>{dailyGoal.cal}</b> kcal
        </div>

        {/* Macros */}
        <div style={{ display:'flex', gap:10, marginBottom:20 }}>
          <MacroPill label="Protéines" value={totals.protein} max={dailyGoal.protein} color={T.green} bg={T.greenLight}/>
          <MacroPill label="Glucides" value={totals.carbs} max={dailyGoal.carbs} color={T.orange} bg={T.orangeLight}/>
          <MacroPill label="Lipides" value={totals.fat} max={dailyGoal.fat} color={T.red} bg={T.redLight}/>
        </div>

        {/* Today's Activity */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <h2 style={{ fontSize:'clamp(15px,4vw,17px)', fontWeight:700 }}>
            {isViewingToday ? "Aujourd'hui" : selectedDate.toLocaleDateString('fr-FR',{ day:'numeric', month:'short' })}
          </h2>
          <button onClick={() => setTab('calendar')} style={{ fontSize:12, color:T.accent, fontWeight:600 }}>Voir tout →</button>
        </div>

        {/* Meals */}
        {MEALS.map(meal => (
          <MealCard key={meal.id} meal={meal} items={todayMeals[meal.id]}
            onAdd={() => { setSelectedMealType(meal.id); setShowScanner(true); }}
            onRemove={(fid) => removeFood(meal.id, fid)}/>
        ))}
      </div>
    );
  };

  /* ═══════════════ CALENDAR TAB ═══════════════ */
  const CalendarScreen = () => {
    const calDays = getCalendarDays(calMonth);
    return (
      <div style={{ padding:'clamp(16px,4vw,24px)', animation:'fadeIn .4s ease' }}>
        {/* Month header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <button onClick={prevMonth} style={{ width:40, height:40, borderRadius:12, background:T.white, boxShadow:T.shadow, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:T.text }}>‹</button>
          <h2 style={{ fontSize:'clamp(17px,4.5vw,20px)', fontWeight:700 }}>
            {MONTHS_FR[calMonth.getMonth()]} {calMonth.getFullYear()}
          </h2>
          <button onClick={nextMonth} style={{ width:40, height:40, borderRadius:12, background:T.white, boxShadow:T.shadow, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:T.text }}>›</button>
        </div>

        {/* Day names */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
          {DAYS_FR.map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:600, color:T.textTer, padding:'4px 0' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:24 }}>
          {calDays.map((d, i) => {
            if (!d) return <div key={`empty-${i}`}/>;
            const sel = isSelected(d);
            const tod = isToday(d);
            const has = hasData(d);
            return (
              <button key={i} onClick={() => { setSelectedDate(new Date(d)); setTab('home'); }}
                style={{
                  aspectRatio:'1', borderRadius:14, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  background: sel ? T.accent : tod ? T.accentLight : T.white,
                  boxShadow: sel ? '0 2px 10px rgba(59,130,246,0.3)' : has ? T.shadow : 'none',
                  border: tod && !sel ? `2px solid ${T.accent}` : '2px solid transparent',
                  transition:'all .2s', position:'relative'
                }}>
                <span style={{ fontSize:'clamp(13px,3.2vw,15px)', fontWeight: (sel||tod) ? 700 : 500, color: sel ? '#fff' : T.text }}>{d.getDate()}</span>
                {has && (
                  <div style={{ width:5, height:5, borderRadius:'50%', background: sel ? '#fff' : T.accent, marginTop:2 }}/>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick summary of selected date */}
        <div style={{ background:T.white, borderRadius:18, padding:'clamp(14px,3.5vw,20px)', boxShadow:T.shadow, marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ fontSize:15, fontWeight:700 }}>
              {dateKey(selectedDate) === dateKey(new Date()) ? "Aujourd'hui" : selectedDate.toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' })}
            </h3>
            <button onClick={() => setTab('home')} style={{ fontSize:12, color:T.accent, fontWeight:600 }}>Détails →</button>
          </div>
          {(() => {
            const meals = getMeals(selectedDate);
            const t = dayTotals(meals);
            const count = Object.values(meals).flat().length;
            if (count === 0) return (
              <div style={{ textAlign:'center', padding:'16px 0', color:T.textTer }}>
                <div style={{ fontSize:28, marginBottom:4 }}>📝</div>
                <p style={{ fontSize:13 }}>Aucun repas enregistré</p>
                <button onClick={() => { setTab('home'); setShowScanner(true); }} style={{ marginTop:8, padding:'8px 20px', background:T.accent, borderRadius:10, color:'#fff', fontSize:12, fontWeight:600 }}>
                  + Ajouter un repas
                </button>
              </div>
            );
            return (
              <div>
                <div style={{ display:'flex', gap:12, marginBottom:12 }}>
                  <div style={{ flex:1, background:T.bg, borderRadius:12, padding:12, textAlign:'center' }}>
                    <div style={{ fontSize:22, fontWeight:800, color:T.accent }}>{t.cal}</div>
                    <div style={{ fontSize:10, color:T.textTer }}>kcal</div>
                  </div>
                  <div style={{ flex:1, background:T.bg, borderRadius:12, padding:12, textAlign:'center' }}>
                    <div style={{ fontSize:22, fontWeight:800, color:T.green }}>{Math.round(t.protein)}g</div>
                    <div style={{ fontSize:10, color:T.textTer }}>protéines</div>
                  </div>
                  <div style={{ flex:1, background:T.bg, borderRadius:12, padding:12, textAlign:'center' }}>
                    <div style={{ fontSize:22, fontWeight:800, color:T.text }}>{count}</div>
                    <div style={{ fontSize:10, color:T.textTer }}>aliments</div>
                  </div>
                </div>
                {MEALS.map(m => {
                  const items = meals[m.id];
                  if (items.length === 0) return null;
                  const mc = items.reduce((s,f)=>s+f.cal,0);
                  return (
                    <div key={m.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderTop:`1px solid ${T.border}` }}>
                      <span style={{ fontSize:13, color:T.textSec }}>{m.icon} {m.label}</span>
                      <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{mc} kcal</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    );
  };

  /* ═══════════════ PROFILE TAB ═══════════════ */
  const ProfileScreen = () => (
    <div style={{ padding:'clamp(16px,4vw,24px)', animation:'fadeIn .4s ease' }}>
      <h2 style={{ fontSize:'clamp(18px,5vw,22px)', fontWeight:800, marginBottom:24 }}>Mon Profil</h2>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:28 }}>
        <div style={{ width:80, height:80, borderRadius:'50%', background:T.accentLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, fontWeight:700, color:T.accent, border:`3px solid ${T.accent}` }}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <h3 style={{ fontSize:22, fontWeight:700, marginTop:12 }}>{user?.name}</h3>
        <p style={{ color:T.textTer, fontSize:13 }}>{user?.email || 'Mode invité'}</p>
      </div>
      <div style={{ background:T.white, borderRadius:18, padding:20, boxShadow:T.shadow, marginBottom:16 }}>
        <h4 style={{ color:T.accent, fontSize:12, fontWeight:700, marginBottom:14, textTransform:'uppercase', letterSpacing:1 }}>Objectifs journaliers</h4>
        {[
          { l:'Calories', v:`${dailyGoal.cal} kcal`, c:T.accent },
          { l:'Protéines', v:`${dailyGoal.protein}g`, c:T.green },
          { l:'Glucides', v:`${dailyGoal.carbs}g`, c:T.orange },
          { l:'Lipides', v:`${dailyGoal.fat}g`, c:T.red },
        ].map(x => (
          <div key={x.l} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
            <span style={{ color:T.textSec, fontSize:14 }}>{x.l}</span>
            <span style={{ color:x.c, fontSize:14, fontWeight:700 }}>{x.v}</span>
          </div>
        ))}
      </div>
      <div style={{ background:T.white, borderRadius:18, padding:20, boxShadow:T.shadow, marginBottom:16 }}>
        <h4 style={{ color:T.text, fontSize:12, fontWeight:700, marginBottom:14, textTransform:'uppercase', letterSpacing:1 }}>Résumé</h4>
        <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
          <span style={{ color:T.textSec, fontSize:14 }}>Jours enregistrés</span>
          <span style={{ color:T.text, fontSize:14, fontWeight:700 }}>{Object.keys(allData).filter(k => Object.values(allData[k]).flat().length > 0).length}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0' }}>
          <span style={{ color:T.textSec, fontSize:14 }}>Total aliments</span>
          <span style={{ color:T.text, fontSize:14, fontWeight:700 }}>{Object.values(allData).reduce((s,d)=>s+Object.values(d).flat().length, 0)}</span>
        </div>
      </div>
      <button onClick={() => { setUser(null); setScreen('auth'); setAllData({}); setTab('home'); }}
        style={{ width:'100%', padding:'14px 0', background:T.white, border:`1.5px solid ${T.red}33`, borderRadius:14, color:T.red, fontSize:14, fontWeight:600, boxShadow:T.shadow }}>
        Se déconnecter
      </button>
    </div>
  );

  /* ═══════════════ MAIN LAYOUT ═══════════════ */
  return (
    <div style={{ minHeight:'100vh', background:T.bg, paddingBottom:80 }}>
      {showScanner && <ScannerModal/>}

      {tab === 'home' && <HomeScreen/>}
      {tab === 'calendar' && <CalendarScreen/>}
      {tab === 'profile' && <ProfileScreen/>}

      {/* FAB */}
      <button onClick={() => setShowScanner(true)} style={{
        position:'fixed', bottom:80, right:'clamp(16px,4vw,24px)', width:56, height:56, borderRadius:'50%',
        background:T.accent, color:'#fff', fontSize:24, display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 4px 20px rgba(59,130,246,0.4)', zIndex:50, transition:'transform .2s'
      }}>📸</button>

      {/* Bottom nav */}
      <div style={{
        position:'fixed', bottom:0, left:0, right:0, height:70, background:T.white,
        borderTop:`1px solid ${T.border}`, display:'flex', zIndex:100,
        paddingBottom:'env(safe-area-inset-bottom)'
      }}>
        {[
          { id:'home', icon:'🏠', label:'Accueil' },
          { id:'calendar', icon:'📅', label:'Calendrier' },
          { id:'profile', icon:'👤', label:'Profil' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
            color: tab===t.id ? T.accent : T.textTer, transition:'all .2s'
          }}>
            <span style={{ fontSize:20 }}>{t.icon}</span>
            <span style={{ fontSize:10, fontWeight:tab===t.id ? 700 : 500 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Shared style ── */
const inputSt = {
  width:'100%', padding:'14px 16px', background:'#fff',
  border:'1.5px solid #E5E7EB', borderRadius:14, color:'#1A1D26',
  fontSize:14, outline:'none', boxSizing:'border-box', marginBottom:12,
  boxShadow:'0 2px 12px rgba(0,0,0,0.06)'
};
