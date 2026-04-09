import React, { useState, useEffect, useRef, useCallback } from 'react';
import FOOD_DB, { MEALS } from './data/foods';

/* ═══════════════ THEME ═══════════════ */
const T = {
  bg:"#F4F5F7", white:"#FFFFFF", text:"#1A1D26", textSec:"#6B7280", textTer:"#9CA3AF",
  accent:"#3B82F6", accentLight:"rgba(59,130,246,0.1)",
  green:"#22C55E", greenLight:"rgba(34,197,94,0.1)",
  orange:"#F59E0B", orangeLight:"rgba(245,158,11,0.1)",
  red:"#EF4444", redLight:"rgba(239,68,68,0.1)",
  border:"#E5E7EB", shadow:"0 2px 12px rgba(0,0,0,0.06)", shadowLg:"0 8px 30px rgba(0,0,0,0.08)"
};

/* ═══════════════ HELPERS ═══════════════ */
const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const emptyDay = () => ({ breakfast:[], lunch:[], snack:[], dinner:[] });
const dayTotals = (meals) => Object.values(meals).flat().reduce(
  (a,f) => ({ cal:a.cal+f.cal, protein:a.protein+f.protein, carbs:a.carbs+f.carbs, fat:a.fat+f.fat }),
  { cal:0, protein:0, carbs:0, fat:0 }
);
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS_FR = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

/* localStorage helpers */
const saveData = (data) => { try { localStorage.setItem('calsjo_data', JSON.stringify(data)); } catch(e){} };
const loadData = () => { try { const d = localStorage.getItem('calsjo_data'); return d ? JSON.parse(d) : {}; } catch(e) { return {}; } };
const saveGoal = (goal) => { try { localStorage.setItem('calsjo_goal', JSON.stringify(goal)); } catch(e){} };
const loadGoal = () => { try { const g = localStorage.getItem('calsjo_goal'); return g ? JSON.parse(g) : null; } catch(e) { return null; } };

/* ═══════════════ SMALL COMPONENTS ═══════════════ */
function SemiGauge({ value, max, size = 170 }) {
  const sw=13, r=(size-sw)/2, hc=Math.PI*r, pct=Math.min(value/max,1);
  const color = pct > 1 ? T.red : pct > 0.8 ? T.orange : T.accent;
  return (
    <div style={{ position:'relative', width:size, height:size/2+28 }}>
      <svg width={size} height={size/2+sw} viewBox={`0 0 ${size} ${size/2+sw}`}>
        <path d={`M ${sw/2} ${size/2} A ${r} ${r} 0 0 1 ${size-sw/2} ${size/2}`}
          fill="none" stroke={T.border} strokeWidth={sw} strokeLinecap="round"/>
        <path d={`M ${sw/2} ${size/2} A ${r} ${r} 0 0 1 ${size-sw/2} ${size/2}`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={hc} strokeDashoffset={hc*(1-pct)}
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
  const mc = items.reduce((s,f) => s+f.cal, 0);
  return (
    <div style={{ background:T.white, borderRadius:18, padding:'clamp(12px,3vw,16px)', marginBottom:10, boxShadow:T.shadow }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:items.length?10:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>{meal.icon}</span>
          <span style={{ color:T.text, fontSize:'clamp(13px,3.5vw,15px)', fontWeight:600 }}>{meal.label}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {mc > 0 && <span style={{ color:T.accent, fontSize:13, fontWeight:700 }}>{mc} kcal</span>}
          <button onClick={onAdd} style={{ width:32, height:32, borderRadius:10, background:T.accentLight,
            border:`1.5px solid ${T.accent}33`, color:T.accent, fontSize:18,
            display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>+</button>
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
          <button onClick={() => onRemove(f.id)} style={{ color:T.red, fontSize:13, opacity:.6, padding:'0 4px', background:'none', border:'none', cursor:'pointer' }}>✕</button>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════ MAIN APP ═══════════════ */
export default function App() {
  const [allData, setAllData] = useState(() => loadData());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calMonth, setCalMonth] = useState(new Date());

  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState('camera');
  const [manualInput, setManualInput] = useState('');
  const [manualGrams, setManualGrams] = useState('100');
  const [selectedMealType, setSelectedMealType] = useState('lunch');
  const [searchResults, setSearchResults] = useState([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedFoods, setDetectedFoods] = useState([]);
  const [selectedFoodIdx, setSelectedFoodIdx] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceError, setVoiceError] = useState('');
  const [analyzeError, setAnalyzeError] = useState('');

  const [tab, setTab] = useState('home');
  const [dailyGoal] = useState(() => loadGoal() || { cal:2000, protein:150, carbs:250, fat:70 });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const searchTimeout = useRef(null);
  const recognitionRef = useRef(null);

  // Save data whenever it changes
  useEffect(() => { saveData(allData); }, [allData]);

  const getMeals = useCallback((d) => allData[dateKey(d)] || emptyDay(), [allData]);
  const setMealsForDate = useCallback((d, m) => setAllData(p => ({ ...p, [dateKey(d)]: m })), []);

  const todayMeals = getMeals(selectedDate);
  const totals = dayTotals(todayMeals);

  /* ── Camera ── */
  const startCamera = async () => {
    setCameraActive(true);
    setDetectedFoods([]);
    setSelectedFoodIdx(null);
    setAnalyzeError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'environment', width:{ideal:1280}, height:{ideal:960} }});
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch(e) {
      setCameraActive(false);
      setScanMode('manual');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    const base64 = dataUrl.split(',')[1];
    stopCamera();

    setAnalyzing(true);
    setAnalyzeError('');
    setDetectedFoods([]);

    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' })
      });
      const data = await resp.json();

      if (data.error) {
        setAnalyzeError(data.error);
        setAnalyzing(false);
        return;
      }

      if (data.foods && data.foods.length > 0) {
        setDetectedFoods(data.foods.map(f => ({
          ...f,
          cal: Math.round(f.cal || 0),
          protein: Math.round((f.protein || 0) * 10) / 10,
          carbs: Math.round((f.carbs || 0) * 10) / 10,
          fat: Math.round((f.fat || 0) * 10) / 10,
          grams: Math.round(f.grams || 100),
          per: `${Math.round(f.grams || 100)}g`
        })));
      } else {
        setAnalyzeError("Aucun aliment détecté. Essaie le mode Manuel ou Vocal.");
      }
    } catch (err) {
      setAnalyzeError("Erreur de connexion. Vérifie ta connexion internet.");
    }
    setAnalyzing(false);
  };

  /* ── Search (debounced) ── */
  const doSearch = (text) => {
    if (text.length < 2) { setSearchResults([]); return; }
    const l = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const res = Object.entries(FOOD_DB)
      .filter(([k, v]) => {
        const kn = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const vn = v.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return kn.includes(l) || vn.includes(l) || l.includes(kn);
      })
      .map(([, v]) => v)
      .filter((v, i, a) => a.findIndex(x => x.name === v.name) === i);
    setSearchResults(res);
  };

  const handleSearchInput = (text) => {
    setManualInput(text);
    setSelectedFoodIdx(null);
    setDetectedFoods([]);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(text), 300);
  };

  /* ── Voice ── */
  const startVoice = () => {
    setVoiceError('');
    setVoiceText('');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("La reconnaissance vocale n'est pas supportée par ton navigateur. Utilise Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript)
        .join('');
      setVoiceText(transcript);

      if (event.results[0].isFinal) {
        setIsListening(false);
        setManualInput(transcript);
        doSearch(transcript);
        setScanMode('manual');
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'no-speech') {
        setVoiceError("Aucune voix détectée. Réessaie en parlant plus fort.");
      } else if (event.error === 'not-allowed') {
        setVoiceError("Accès au micro refusé. Autorise le micro dans les paramètres du navigateur.");
      } else {
        setVoiceError(`Erreur: ${event.error}. Réessaie.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch(e) {
      setIsListening(false);
      setVoiceError("Impossible de démarrer la reconnaissance vocale.");
    }
  };

  const stopVoice = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  /* ── Add / Remove food ── */
  const addFood = (food) => {
    const entry = {
      ...food,
      id: Date.now() + Math.random(),
    };
    const current = getMeals(selectedDate);
    const updated = { ...current, [selectedMealType]: [...current[selectedMealType], entry] };
    setMealsForDate(selectedDate, updated);
  };

  const addFoodFromDB = (food, grams = 100) => {
    const m = grams / 100;
    addFood({
      ...food,
      cal: Math.round(food.cal * m),
      protein: Math.round(food.protein * m * 10) / 10,
      carbs: Math.round(food.carbs * m * 10) / 10,
      fat: Math.round(food.fat * m * 10) / 10,
      grams
    });
  };

  const addAllDetected = () => {
    detectedFoods.forEach(f => addFood(f));
    resetScanner();
  };

  const removeFood = (mealId, foodId) => {
    const current = getMeals(selectedDate);
    const updated = { ...current, [mealId]: current[mealId].filter(f => f.id !== foodId) };
    setMealsForDate(selectedDate, updated);
  };

  const resetScanner = () => {
    setShowScanner(false);
    setManualInput('');
    setSearchResults([]);
    setDetectedFoods([]);
    setSelectedFoodIdx(null);
    setScanMode('camera');
    setManualGrams('100');
    setAnalyzeError('');
    setVoiceText('');
    setVoiceError('');
    stopCamera();
  };

  /* ── Calendar ── */
  const getCalendarDays = (md) => {
    const y = md.getFullYear(), m = md.getMonth();
    let sd = new Date(y, m, 1).getDay() - 1;
    if (sd < 0) sd = 6;
    const dim = new Date(y, m+1, 0).getDate();
    const days = [];
    for (let i = 0; i < sd; i++) days.push(null);
    for (let i = 1; i <= dim; i++) days.push(new Date(y, m, i));
    return days;
  };

  const isToday = (d) => d && dateKey(d) === dateKey(new Date());
  const isSelected = (d) => d && dateKey(d) === dateKey(selectedDate);
  const hasData = (d) => { if(!d) return false; const m = allData[dateKey(d)]; return m && Object.values(m).flat().length > 0; };

  const now = new Date();

  /* ═══════════════ SCANNER MODAL ═══════════════ */
  const ScannerModal = () => (
    <div style={{ position:'fixed', inset:0, background:T.bg, zIndex:200, display:'flex', flexDirection:'column', animation:'slideUp .3s ease' }}>
      {/* Header */}
      <div style={{ padding:'clamp(12px,3vw,16px) clamp(16px,4vw,20px)', display:'flex', alignItems:'center', justifyContent:'space-between', background:T.white, borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
        <button onClick={resetScanner} style={{ fontSize:22, color:T.text, padding:4, cursor:'pointer' }}>←</button>
        <span style={{ fontSize:'clamp(14px,3.8vw,16px)', fontWeight:700 }}>Ajouter un aliment</span>
        <div style={{ width:28 }}/>
      </div>

      {/* Date */}
      <div style={{ textAlign:'center', padding:'8px 0', color:T.accent, fontSize:12, fontWeight:600, background:T.accentLight }}>
        {selectedDate.toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' })}
      </div>

      {/* Meal selector */}
      <div style={{ display:'flex', gap:6, padding:'10px 16px', overflowX:'auto', flexShrink:0 }}>
        {MEALS.map(m => (
          <button key={m.id} onClick={() => setSelectedMealType(m.id)} style={{
            padding:'8px clamp(10px,3vw,16px)', borderRadius:20, whiteSpace:'nowrap',
            fontSize:'clamp(11px,2.8vw,13px)', fontWeight:600, cursor:'pointer',
            background: selectedMealType===m.id ? T.accent : T.white,
            color: selectedMealType===m.id ? '#fff' : T.textSec,
            boxShadow: selectedMealType===m.id ? '0 2px 8px rgba(59,130,246,0.3)' : T.shadow
          }}>{m.icon} {m.label}</button>
        ))}
      </div>

      {/* Mode tabs */}
      <div style={{ display:'flex', gap:6, padding:'4px 16px 8px', flexShrink:0 }}>
        {[{id:'camera',icon:'📸',label:'Photo IA'},{id:'manual',icon:'✏️',label:'Manuel'},{id:'voice',icon:'🎙️',label:'Vocal'}].map(m => (
          <button key={m.id} onClick={() => {
            setScanMode(m.id);
            setDetectedFoods([]); setSelectedFoodIdx(null); setAnalyzeError('');
            if (m.id === 'camera') startCamera();
            else { stopCamera(); if (m.id === 'voice') startVoice(); }
          }} style={{
            flex:1, padding:'10px 0', borderRadius:12,
            border:`1.5px solid ${scanMode===m.id ? T.accent : T.border}`,
            fontSize:'clamp(11px,2.8vw,12px)', fontWeight:600, cursor:'pointer',
            background: scanMode===m.id ? T.accentLight : T.white,
            color: scanMode===m.id ? T.accent : T.textTer
          }}>{m.icon} {m.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex:1, padding:'8px 16px 24px', overflow:'auto' }}>

        {/* ── CAMERA MODE ── */}
        {scanMode === 'camera' && (
          <div>
            {!analyzing && detectedFoods.length === 0 && (
              <div style={{ borderRadius:20, overflow:'hidden', background:'#1a1a1a', position:'relative', aspectRatio:'4/3', marginBottom:12, boxShadow:T.shadowLg }}>
                {cameraActive ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    <div style={{ position:'absolute', inset:'12%', border:`2px dashed ${T.accent}`, borderRadius:20, opacity:.5 }}/>
                    <button onClick={captureAndAnalyze} style={{
                      position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)',
                      width:68, height:68, borderRadius:'50%', background:T.accent,
                      border:'4px solid white', cursor:'pointer',
                      boxShadow:'0 4px 20px rgba(59,130,246,0.5)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:24, color:'#fff'
                    }}>📸</button>
                  </>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:T.textTer, padding:32 }}>
                    <div style={{ fontSize:52, marginBottom:12 }}>📷</div>
                    <p style={{ fontSize:14, textAlign:'center', marginBottom:4, lineHeight:1.5, color:'#ccc' }}>
                      Prends en photo ton repas
                    </p>
                    <p style={{ fontSize:12, textAlign:'center', marginBottom:16, color:'#888', lineHeight:1.4 }}>
                      L'IA reconnaîtra les aliments,<br/>le packaging et les codes-barres
                    </p>
                    <button onClick={startCamera} style={{
                      padding:'12px 32px', background:T.accent, borderRadius:12,
                      color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer',
                      boxShadow:'0 2px 12px rgba(59,130,246,0.4)'
                    }}>Activer la caméra</button>
                  </div>
                )}
              </div>
            )}

            {/* Analyzing spinner */}
            {analyzing && (
              <div style={{ textAlign:'center', padding:48 }}>
                <div style={{ fontSize:52, animation:'spin 1.2s linear infinite', display:'inline-block' }}>🔍</div>
                <p style={{ color:T.accent, fontSize:16, fontWeight:600, marginTop:16 }}>L'IA analyse ta photo...</p>
                <p style={{ color:T.textTer, fontSize:12, marginTop:4 }}>Détection des aliments en cours</p>
              </div>
            )}

            {/* Error */}
            {analyzeError && !analyzing && (
              <div style={{ background:T.redLight, borderRadius:14, padding:16, marginBottom:12, textAlign:'center' }}>
                <p style={{ color:T.red, fontSize:13, fontWeight:600, marginBottom:8 }}>{analyzeError}</p>
                <button onClick={() => { setAnalyzeError(''); startCamera(); }}
                  style={{ padding:'8px 20px', background:T.accent, borderRadius:10, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  Réessayer
                </button>
              </div>
            )}

            {/* Detected foods list */}
            {detectedFoods.length > 0 && (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <h3 style={{ fontSize:15, fontWeight:700, color:T.text }}>
                    {detectedFoods.length} aliment{detectedFoods.length > 1 ? 's' : ''} détecté{detectedFoods.length > 1 ? 's' : ''}
                  </h3>
                  {detectedFoods.length > 1 && (
                    <button onClick={addAllDetected} style={{
                      padding:'8px 16px', background:T.accent, borderRadius:10,
                      color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer',
                      boxShadow:'0 2px 8px rgba(59,130,246,0.3)'
                    }}>Tout ajouter</button>
                  )}
                </div>

                {detectedFoods.map((f, i) => (
                  <div key={i} style={{
                    background:T.white, borderRadius:16, padding:14, marginBottom:8,
                    border: selectedFoodIdx===i ? `2px solid ${T.accent}` : `1px solid ${T.border}`,
                    boxShadow: selectedFoodIdx===i ? '0 2px 12px rgba(59,130,246,0.15)' : T.shadow,
                    cursor:'pointer', transition:'all .2s'
                  }} onClick={() => setSelectedFoodIdx(selectedFoodIdx===i ? null : i)}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <span style={{ fontSize:30 }}>{f.icon}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ color:T.text, fontSize:14, fontWeight:600 }}>{f.name}</div>
                        <div style={{ color:T.textTer, fontSize:11 }}>{f.grams}g estimé</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ color:T.accent, fontSize:16, fontWeight:700 }}>{f.cal}</div>
                        <div style={{ color:T.textTer, fontSize:10 }}>kcal</div>
                      </div>
                    </div>

                    {selectedFoodIdx === i && (
                      <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${T.border}` }}>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
                          {[
                            { l:'Protéines', v:`${f.protein}g`, c:T.green },
                            { l:'Glucides', v:`${f.carbs}g`, c:T.orange },
                            { l:'Lipides', v:`${f.fat}g`, c:T.red },
                          ].map(x => (
                            <div key={x.l} style={{ background:T.bg, borderRadius:8, padding:8, textAlign:'center' }}>
                              <div style={{ fontSize:9, color:T.textTer, textTransform:'uppercase' }}>{x.l}</div>
                              <div style={{ fontSize:13, fontWeight:700, color:x.c, marginTop:2 }}>{x.v}</div>
                            </div>
                          ))}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); addFood(f); resetScanner(); }}
                          style={{ width:'100%', padding:'10px 0', background:T.accent, borderRadius:10, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                          ✓ Ajouter au {MEALS.find(m => m.id===selectedMealType)?.label}
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ display:'flex', gap:8, marginTop:12 }}>
                  <button onClick={() => { setDetectedFoods([]); setSelectedFoodIdx(null); startCamera(); }}
                    style={{ flex:1, padding:'12px 0', background:T.white, border:`1px solid ${T.border}`, borderRadius:12, color:T.textSec, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    📷 Reprendre une photo
                  </button>
                </div>
              </div>
            )}

            <canvas ref={canvasRef} style={{ display:'none' }}/>

            {!cameraActive && !analyzing && detectedFoods.length === 0 && !analyzeError && (
              <p style={{ color:T.textTer, fontSize:11, textAlign:'center', marginTop:12, lineHeight:1.6 }}>
                Si la caméra ne fonctionne pas, utilise le mode <b style={{ color:T.accent }}>Manuel</b> ou <b style={{ color:T.accent }}>Vocal</b>
              </p>
            )}
          </div>
        )}

        {/* ── MANUAL MODE ── */}
        {scanMode === 'manual' && (
          <div>
            <div style={{ position:'relative', marginBottom:12 }}>
              <input
                placeholder="Rechercher un aliment... (ex: poulet, riz)"
                value={manualInput}
                onChange={e => handleSearchInput(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                style={{
                  width:'100%', padding:'14px 16px 14px 44px', background:T.white,
                  border:`1.5px solid ${T.border}`, borderRadius:14, color:T.text,
                  fontSize:14, outline:'none', boxSizing:'border-box', boxShadow:T.shadow
                }}
              />
              <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, opacity:.35 }}>🔍</span>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {searchResults.map((f, i) => (
                <button key={i} onClick={() => {
                  setDetectedFoods([f]);
                  setSelectedFoodIdx(0);
                  setSearchResults([]);
                }} style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'clamp(10px,2.5vw,14px) clamp(12px,3vw,16px)',
                  background:T.white, borderRadius:14, boxShadow:T.shadow,
                  textAlign:'left', width:'100%', border:'1.5px solid transparent', cursor:'pointer'
                }}>
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

            {/* Selected food detail */}
            {detectedFoods.length > 0 && selectedFoodIdx !== null && (
              <div style={{ background:T.white, borderRadius:18, padding:20, border:`1.5px solid ${T.accent}33`, boxShadow:T.shadowLg, marginTop:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                  <span style={{ fontSize:36 }}>{detectedFoods[selectedFoodIdx].icon}</span>
                  <div>
                    <div style={{ color:T.accent, fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>Sélectionné</div>
                    <div style={{ color:T.text, fontSize:20, fontWeight:700, marginTop:2 }}>{detectedFoods[selectedFoodIdx].name}</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <span style={{ color:T.textSec, fontSize:12 }}>Quantité (g):</span>
                  <input value={manualGrams} onChange={e => setManualGrams(e.target.value)} type="number"
                    style={{ flex:1, padding:'8px 12px', background:T.bg, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, fontSize:14, outline:'none' }}/>
                </div>
                <button onClick={() => { addFoodFromDB(detectedFoods[selectedFoodIdx], parseInt(manualGrams)||100); resetScanner(); }}
                  style={{ width:'100%', padding:'12px 0', background:T.accent, borderRadius:12, color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', boxShadow:'0 2px 10px rgba(59,130,246,0.3)' }}>
                  ✓ Ajouter au {MEALS.find(m => m.id===selectedMealType)?.label}
                </button>
              </div>
            )}

            {manualInput.length >= 2 && searchResults.length === 0 && detectedFoods.length === 0 && (
              <div style={{ textAlign:'center', padding:32, color:T.textTer }}>
                <div style={{ fontSize:36, marginBottom:8 }}>🤷</div>
                <p style={{ fontSize:13 }}>Aucun résultat pour "{manualInput}"</p>
                <p style={{ fontSize:11, marginTop:4 }}>Essaie un autre mot ou le mode Photo IA</p>
              </div>
            )}
          </div>
        )}

        {/* ── VOICE MODE ── */}
        {scanMode === 'voice' && (
          <div style={{ textAlign:'center', padding:32 }}>
            {isListening ? (
              <>
                <div style={{ width:110, height:110, borderRadius:'50%', background:T.accentLight, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', animation:'pulse 1.5s ease infinite' }}>
                  <div style={{ width:72, height:72, borderRadius:'50%', background:T.accent, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:30 }}>🎙️</div>
                </div>
                <p style={{ color:T.accent, fontSize:18, fontWeight:600, marginBottom:4 }}>Écoute en cours...</p>
                {voiceText && <p style={{ color:T.text, fontSize:15, fontWeight:500, marginTop:8, background:T.white, padding:'10px 16px', borderRadius:10, display:'inline-block' }}>"{voiceText}"</p>}
                <p style={{ color:T.textTer, fontSize:12, marginTop:12 }}>Dis le nom de ton aliment</p>
                <button onClick={stopVoice} style={{
                  marginTop:16, padding:'10px 24px', background:T.red, borderRadius:10,
                  color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
                }}>Arrêter</button>
              </>
            ) : (
              <>
                <div style={{ fontSize:56, marginBottom:16 }}>🎙️</div>
                <p style={{ color:T.text, fontSize:17, fontWeight:600, marginBottom:6 }}>Entrée vocale</p>
                <p style={{ color:T.textTer, fontSize:13, marginBottom:24, lineHeight:1.6 }}>
                  Appuie sur le micro et dis le nom<br/>de l'aliment que tu as mangé
                </p>

                {voiceError && (
                  <div style={{ background:T.redLight, borderRadius:12, padding:12, marginBottom:16, textAlign:'center' }}>
                    <p style={{ color:T.red, fontSize:12 }}>{voiceError}</p>
                  </div>
                )}

                {voiceText && !voiceError && (
                  <p style={{ color:T.accent, fontSize:14, marginBottom:16, background:T.accentLight, padding:'8px 16px', borderRadius:10, display:'inline-block' }}>
                    Dernier résultat : « {voiceText} »
                  </p>
                )}

                <div>
                  <button onClick={startVoice} style={{
                    width:80, height:80, borderRadius:'50%', background:T.accent, fontSize:32, color:'#fff',
                    cursor:'pointer', boxShadow:'0 4px 24px rgba(59,130,246,0.4)',
                    transition:'transform .2s'
                  }}>🎙️</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );

  /* ═══════════════ HOME ═══════════════ */
  const HomeScreen = () => {
    const isViewToday = dateKey(selectedDate) === dateKey(new Date());
    const dow = selectedDate.getDay() === 0 ? 6 : selectedDate.getDay()-1;
    return (
      <div style={{ padding:'0 clamp(16px,4vw,24px)', animation:'fadeIn .4s ease' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:'clamp(16px,4vw,24px)', marginBottom:16 }}>
          <div>
            <div style={{ color:T.textTer, fontSize:'clamp(11px,2.6vw,12px)' }}>
              {selectedDate.toLocaleDateString('fr-FR',{ weekday:'short', day:'numeric', month:'long' })}
            </div>
            <h1 style={{ fontSize:'clamp(20px,5.5vw,26px)', fontWeight:800, marginTop:2 }}>Cal's Jo 🔥</h1>
          </div>
        </div>

        {/* Week strip */}
        <div style={{ display:'flex', gap:4, marginBottom:20 }}>
          {Array.from({ length:7 }, (_, i) => {
            const d = new Date(selectedDate);
            d.setDate(selectedDate.getDate() - dow + i);
            const isSel = dateKey(d) === dateKey(selectedDate);
            const isTod = dateKey(d) === dateKey(new Date());
            return (
              <button key={i} onClick={() => setSelectedDate(new Date(d))} style={{
                flex:1, padding:'6px 0', borderRadius:12, textAlign:'center', transition:'all .2s',
                background: isSel ? T.accent : 'transparent',
                boxShadow: isSel ? '0 2px 8px rgba(59,130,246,0.3)' : 'none', cursor:'pointer'
              }}>
                <div style={{ fontSize:10, color: isSel ? 'rgba(255,255,255,0.7)' : T.textTer, marginBottom:2 }}>{DAYS_FR[i]}</div>
                <div style={{ fontSize:14, fontWeight: (isTod||isSel)?700:500, color: isSel?'#fff':isTod?T.accent:T.text }}>{d.getDate()}</div>
              </button>
            );
          })}
        </div>

        <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
          <SemiGauge value={totals.cal} max={dailyGoal.cal}/>
        </div>
        <div style={{ textAlign:'center', color:T.textTer, fontSize:12, marginBottom:16 }}>
          Objectif : <b style={{ color:T.text }}>{dailyGoal.cal}</b> kcal
        </div>

        <div style={{ display:'flex', gap:10, marginBottom:20 }}>
          <MacroPill label="Protéines" value={totals.protein} max={dailyGoal.protein} color={T.green} bg={T.greenLight}/>
          <MacroPill label="Glucides" value={totals.carbs} max={dailyGoal.carbs} color={T.orange} bg={T.orangeLight}/>
          <MacroPill label="Lipides" value={totals.fat} max={dailyGoal.fat} color={T.red} bg={T.redLight}/>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <h2 style={{ fontSize:'clamp(15px,4vw,17px)', fontWeight:700 }}>
            {isViewToday ? "Aujourd'hui" : selectedDate.toLocaleDateString('fr-FR',{ day:'numeric', month:'short' })}
          </h2>
          <button onClick={() => { setTab('calendar'); setCalMonth(new Date(selectedDate)); }} style={{ fontSize:12, color:T.accent, fontWeight:600, cursor:'pointer' }}>Calendrier →</button>
        </div>

        {MEALS.map(meal => (
          <MealCard key={meal.id} meal={meal} items={todayMeals[meal.id]}
            onAdd={() => { setSelectedMealType(meal.id); setShowScanner(true); }}
            onRemove={(fid) => removeFood(meal.id, fid)}/>
        ))}
      </div>
    );
  };

  /* ═══════════════ CALENDAR ═══════════════ */
  const CalendarScreen = () => {
    const calDays = getCalendarDays(calMonth);
    const selMeals = getMeals(selectedDate);
    const selT = dayTotals(selMeals);
    const selCount = Object.values(selMeals).flat().length;
    return (
      <div style={{ padding:'clamp(16px,4vw,24px)', animation:'fadeIn .4s ease' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth()-1, 1))}
            style={{ width:40, height:40, borderRadius:12, background:T.white, boxShadow:T.shadow, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:T.text, cursor:'pointer' }}>‹</button>
          <h2 style={{ fontSize:'clamp(17px,4.5vw,20px)', fontWeight:700 }}>{MONTHS_FR[calMonth.getMonth()]} {calMonth.getFullYear()}</h2>
          <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth()+1, 1))}
            style={{ width:40, height:40, borderRadius:12, background:T.white, boxShadow:T.shadow, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:T.text, cursor:'pointer' }}>›</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
          {DAYS_FR.map(d => <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:600, color:T.textTer, padding:'4px 0' }}>{d}</div>)}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:24 }}>
          {calDays.map((d, i) => {
            if (!d) return <div key={`e-${i}`}/>;
            const sel = isSelected(d); const tod = isToday(d); const has = hasData(d);
            return (
              <button key={i} onClick={() => setSelectedDate(new Date(d))} style={{
                aspectRatio:'1', borderRadius:14, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                background: sel?T.accent : tod?T.accentLight : T.white,
                boxShadow: sel?'0 2px 10px rgba(59,130,246,0.3)' : has?T.shadow : 'none',
                border: tod&&!sel ? `2px solid ${T.accent}` : '2px solid transparent',
                cursor:'pointer', position:'relative', transition:'all .2s'
              }}>
                <span style={{ fontSize:'clamp(13px,3.2vw,15px)', fontWeight:(sel||tod)?700:500, color:sel?'#fff':T.text }}>{d.getDate()}</span>
                {has && <div style={{ width:5, height:5, borderRadius:'50%', background:sel?'#fff':T.accent, marginTop:2 }}/>}
              </button>
            );
          })}
        </div>

        <div style={{ background:T.white, borderRadius:18, padding:'clamp(14px,3.5vw,20px)', boxShadow:T.shadow }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ fontSize:15, fontWeight:700 }}>
              {dateKey(selectedDate)===dateKey(new Date()) ? "Aujourd'hui" : selectedDate.toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' })}
            </h3>
            <button onClick={() => setTab('home')} style={{ fontSize:12, color:T.accent, fontWeight:600, cursor:'pointer' }}>Détails →</button>
          </div>
          {selCount===0 ? (
            <div style={{ textAlign:'center', padding:'16px 0', color:T.textTer }}>
              <div style={{ fontSize:28, marginBottom:4 }}>📝</div>
              <p style={{ fontSize:13 }}>Aucun repas enregistré</p>
              <button onClick={() => { setTab('home'); setShowScanner(true); }}
                style={{ marginTop:8, padding:'8px 20px', background:T.accent, borderRadius:10, color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                + Ajouter un repas
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display:'flex', gap:12, marginBottom:12 }}>
                <div style={{ flex:1, background:T.bg, borderRadius:12, padding:12, textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:800, color:T.accent }}>{selT.cal}</div><div style={{ fontSize:10, color:T.textTer }}>kcal</div>
                </div>
                <div style={{ flex:1, background:T.bg, borderRadius:12, padding:12, textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:800, color:T.green }}>{Math.round(selT.protein)}g</div><div style={{ fontSize:10, color:T.textTer }}>protéines</div>
                </div>
                <div style={{ flex:1, background:T.bg, borderRadius:12, padding:12, textAlign:'center' }}>
                  <div style={{ fontSize:22, fontWeight:800, color:T.text }}>{selCount}</div><div style={{ fontSize:10, color:T.textTer }}>aliments</div>
                </div>
              </div>
              {MEALS.map(m => {
                const items = selMeals[m.id]; if (!items.length) return null;
                return (
                  <div key={m.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderTop:`1px solid ${T.border}` }}>
                    <span style={{ fontSize:13, color:T.textSec }}>{m.icon} {m.label}</span>
                    <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{items.reduce((s,f)=>s+f.cal,0)} kcal</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ═══════════════ LAYOUT ═══════════════ */
  return (
    <div style={{ minHeight:'100vh', background:T.bg, paddingBottom:80, fontFamily:"'DM Sans',sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
        input,button,select,textarea{font-family:inherit}
        button{cursor:pointer;border:none;background:none}
        input::placeholder{color:#9CA3AF}
        @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.12);opacity:.6}}
        @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {showScanner && <ScannerModal/>}

      {tab === 'home' && <HomeScreen/>}
      {tab === 'calendar' && <CalendarScreen/>}

      {/* FAB */}
      <button onClick={() => setShowScanner(true)} style={{
        position:'fixed', bottom:80, right:'clamp(16px,4vw,24px)', width:56, height:56, borderRadius:'50%',
        background:T.accent, color:'#fff', fontSize:24, display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 4px 20px rgba(59,130,246,0.4)', zIndex:50
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
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
            color: tab===t.id ? T.accent : T.textTer, transition:'all .2s'
          }}>
            <span style={{ fontSize:22 }}>{t.icon}</span>
            <span style={{ fontSize:10, fontWeight: tab===t.id ? 700 : 500 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
