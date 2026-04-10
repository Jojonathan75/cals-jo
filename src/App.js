import React, { useState, useEffect, useRef, useCallback } from 'react';
import FOOD_DB, { MEALS } from './data/foods';

const T = {
  bg:"#F4F5F7", white:"#FFFFFF", text:"#1A1D26", textSec:"#6B7280", textTer:"#9CA3AF",
  accent:"#3B82F6", accentLight:"rgba(59,130,246,0.1)",
  green:"#22C55E", greenLight:"rgba(34,197,94,0.1)",
  orange:"#F59E0B", orangeLight:"rgba(245,158,11,0.1)",
  red:"#EF4444", redLight:"rgba(239,68,68,0.1)",
  border:"#E5E7EB", shadow:"0 2px 12px rgba(0,0,0,0.06)", shadowLg:"0 8px 30px rgba(0,0,0,0.08)"
};

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const emptyDay = () => ({ breakfast:[], lunch:[], snack:[], dinner:[] });
const dayTotals = (m) => Object.values(m).flat().reduce((a,f) => ({ cal:a.cal+f.cal, protein:a.protein+f.protein, carbs:a.carbs+f.carbs, fat:a.fat+f.fat }), { cal:0, protein:0, carbs:0, fat:0 });
const MO = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DA = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

const saveData = (d) => { try { localStorage.setItem('calsjo_data', JSON.stringify(d)); } catch(e){} };
const loadData = () => { try { const d = localStorage.getItem('calsjo_data'); return d ? JSON.parse(d) : {}; } catch(e) { return {}; } };

function SemiGauge({ value, max }) {
  const size=170, sw=13, r=(size-sw)/2, hc=Math.PI*r, pct=Math.min(value/max,1);
  const color = pct > 1 ? T.red : pct > 0.8 ? T.orange : T.accent;
  return (
    <div style={{ position:'relative', width:size, height:size/2+28 }}>
      <svg width={size} height={size/2+sw} viewBox={`0 0 ${size} ${size/2+sw}`}>
        <path d={`M ${sw/2} ${size/2} A ${r} ${r} 0 0 1 ${size-sw/2} ${size/2}`} fill="none" stroke={T.border} strokeWidth={sw} strokeLinecap="round"/>
        <path d={`M ${sw/2} ${size/2} A ${r} ${r} 0 0 1 ${size-sw/2} ${size/2}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={hc} strokeDashoffset={hc*(1-pct)} style={{ transition:'stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)' }}/>
      </svg>
      <div style={{ position:'absolute', left:'50%', bottom:8, transform:'translateX(-50%)', textAlign:'center' }}>
        <div style={{ fontSize:'clamp(26px,7vw,38px)', fontWeight:800, color:T.text, lineHeight:1 }}>{value}</div>
        <div style={{ fontSize:12, color:T.textTer, marginTop:2 }}>kcal</div>
      </div>
    </div>
  );
}

function doFoodSearch(text) {
  if (text.length < 2) return [];
  const l = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return Object.entries(FOOD_DB)
    .filter(([k, v]) => {
      const kn = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const vn = v.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return kn.includes(l) || vn.includes(l) || l.includes(kn);
    })
    .map(([, v]) => v)
    .filter((v, i, a) => a.findIndex(x => x.name === v.name) === i);
}

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
  const dailyGoal = { cal:2000, protein:150, carbs:250, fat:70 };

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const searchTimeout = useRef(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { saveData(allData); }, [allData]);

  const getMeals = useCallback((d) => allData[dateKey(d)] || emptyDay(), [allData]);

  const todayMeals = getMeals(selectedDate);
  const totals = dayTotals(todayMeals);

  // Camera
  const startCamera = async () => {
    setCameraActive(true); setDetectedFoods([]); setSelectedFoodIdx(null); setAnalyzeError('');
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment', width:{ideal:1280}, height:{ideal:960} }});
      streamRef.current = s;
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = s; }, 100);
    } catch { setCameraActive(false); setScanMode('manual'); }
  };

  const stopCamera = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setCameraActive(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const base64 = c.toDataURL('image/jpeg', 0.85).split(',')[1];
    stopCamera();
    setAnalyzing(true); setAnalyzeError(''); setDetectedFoods([]);

    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, mediaType: 'image/jpeg' })
      });
      const data = await resp.json();
      if (data.error) { setAnalyzeError(data.error); }
      else if (data.foods && data.foods.length > 0) {
        setDetectedFoods(data.foods.map(f => ({
          ...f, cal: Math.round(f.cal||0),
          protein: Math.round((f.protein||0)*10)/10,
          carbs: Math.round((f.carbs||0)*10)/10,
          fat: Math.round((f.fat||0)*10)/10,
          grams: Math.round(f.grams||100),
          per: `${Math.round(f.grams||100)}g`
        })));
      } else { setAnalyzeError("Aucun aliment détecté. Essaie le mode Manuel ou Vocal."); }
    } catch { setAnalyzeError("Erreur de connexion. Vérifie ta connexion internet."); }
    setAnalyzing(false);
  };

  // AI text analysis
  const analyzeText = async (text) => {
    if (!text || text.length < 2) return;
    setAnalyzing(true); setAnalyzeError(''); setDetectedFoods([]);
    try {
      const resp = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await resp.json();
      if (data.error) { setAnalyzeError(data.error); }
      else if (data.foods && data.foods.length > 0) {
        setDetectedFoods(data.foods.map(f => ({
          ...f, cal: Math.round(f.cal||0),
          protein: Math.round((f.protein||0)*10)/10,
          carbs: Math.round((f.carbs||0)*10)/10,
          fat: Math.round((f.fat||0)*10)/10,
          grams: Math.round(f.grams||100),
          per: `${Math.round(f.grams||100)}g`
        })));
      } else { setAnalyzeError("Aucun aliment reconnu. Réessaie avec plus de détails."); }
    } catch { setAnalyzeError("Erreur de connexion."); }
    setAnalyzing(false);
  };

  // Debounced search
  const handleSearchInput = useCallback((text) => {
    setManualInput(text);
    setSelectedFoodIdx(null);
    setDetectedFoods([]);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchResults(doFoodSearch(text));
    }, 350);
  }, []);

  // Voice
  const startVoice = () => {
    setVoiceError(''); setVoiceText('');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceError("Reconnaissance vocale non supportée. Utilise Chrome."); return; }
    const recognition = new SR();
    recognition.lang = 'fr-FR'; recognition.continuous = false; recognition.interimResults = true;
    recognitionRef.current = recognition;
    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map(r => r[0].transcript).join('');
      setVoiceText(transcript);
      if (event.results[0].isFinal) {
        setIsListening(false);
        setManualInput(transcript);
        // Use AI to analyze the spoken text
        setScanMode('manual');
        setTimeout(() => analyzeText(transcript), 100);
      }
    };
    recognition.onerror = (e) => {
      setIsListening(false);
      if (e.error === 'no-speech') setVoiceError("Aucune voix détectée. Parle plus fort.");
      else if (e.error === 'not-allowed') setVoiceError("Micro refusé. Autorise le micro dans les paramètres.");
      else setVoiceError("Erreur. Réessaie.");
    };
    recognition.onend = () => setIsListening(false);
    try { recognition.start(); } catch { setIsListening(false); setVoiceError("Impossible de démarrer le micro."); }
  };

  // Add food
  const addFood = (food) => {
    const entry = { ...food, id: Date.now() + Math.random() };
    const current = getMeals(selectedDate);
    setAllData(p => ({ ...p, [dateKey(selectedDate)]: { ...current, [selectedMealType]: [...current[selectedMealType], entry] } }));
  };

  const addFoodFromDB = (food, grams) => {
    const m = grams / 100;
    addFood({ ...food, cal:Math.round(food.cal*m), protein:Math.round(food.protein*m*10)/10, carbs:Math.round(food.carbs*m*10)/10, fat:Math.round(food.fat*m*10)/10, grams });
  };

  const removeFood = (mealId, foodId) => {
    const current = getMeals(selectedDate);
    setAllData(p => ({ ...p, [dateKey(selectedDate)]: { ...current, [mealId]: current[mealId].filter(f => f.id !== foodId) } }));
  };

  const resetScanner = () => {
    stopCamera(); setShowScanner(false); setManualInput(''); setSearchResults([]);
    setDetectedFoods([]); setSelectedFoodIdx(null); setScanMode('camera');
    setManualGrams('100'); setAnalyzeError(''); setVoiceText(''); setVoiceError('');
  };

  // Calendar
  const getCalDays = (md) => {
    const y=md.getFullYear(), m=md.getMonth();
    let sd = new Date(y,m,1).getDay()-1; if(sd<0) sd=6;
    const dim = new Date(y,m+1,0).getDate();
    const days = [];
    for (let i=0;i<sd;i++) days.push(null);
    for (let i=1;i<=dim;i++) days.push(new Date(y,m,i));
    return days;
  };

  const isToday = (d) => d && dateKey(d)===dateKey(new Date());
  const isSel = (d) => d && dateKey(d)===dateKey(selectedDate);
  const hasData = (d) => { if(!d) return false; const m=allData[dateKey(d)]; return m && Object.values(m).flat().length>0; };

  const dow = selectedDate.getDay()===0?6:selectedDate.getDay()-1;
  const isViewToday = dateKey(selectedDate)===dateKey(new Date());

  /* ═══════════════ RENDER ═══════════════ */
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
        @keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ═══ SCANNER OVERLAY ═══ */}
      {showScanner && (
        <div style={{ position:'fixed', inset:0, background:T.bg, zIndex:200, display:'flex', flexDirection:'column', animation:'slideUp .25s ease' }}>
          <div style={{ padding:'clamp(12px,3vw,16px) clamp(16px,4vw,20px)', display:'flex', alignItems:'center', justifyContent:'space-between', background:T.white, borderBottom:`1px solid ${T.border}`, flexShrink:0 }}>
            <button onClick={resetScanner} style={{ fontSize:22, color:T.text, padding:4 }}>←</button>
            <span style={{ fontSize:'clamp(14px,3.8vw,16px)', fontWeight:700 }}>Ajouter un aliment</span>
            <div style={{ width:28 }}/>
          </div>

          <div style={{ textAlign:'center', padding:'8px 0', color:T.accent, fontSize:12, fontWeight:600, background:T.accentLight, flexShrink:0 }}>
            {selectedDate.toLocaleDateString('fr-FR',{ weekday:'long', day:'numeric', month:'long' })}
          </div>

          <div style={{ display:'flex', gap:6, padding:'10px 16px', overflowX:'auto', flexShrink:0 }}>
            {MEALS.map(m => (
              <button key={m.id} onClick={() => setSelectedMealType(m.id)} style={{
                padding:'8px clamp(10px,3vw,16px)', borderRadius:20, whiteSpace:'nowrap',
                fontSize:'clamp(11px,2.8vw,13px)', fontWeight:600,
                background: selectedMealType===m.id ? T.accent : T.white,
                color: selectedMealType===m.id ? '#fff' : T.textSec,
                boxShadow: selectedMealType===m.id ? '0 2px 8px rgba(59,130,246,0.3)' : T.shadow
              }}>{m.icon} {m.label}</button>
            ))}
          </div>

          <div style={{ display:'flex', gap:6, padding:'4px 16px 8px', flexShrink:0 }}>
            {[{id:'camera',icon:'📸',label:'Photo IA'},{id:'manual',icon:'✏️',label:'Manuel'},{id:'voice',icon:'🎙️',label:'Vocal'}].map(m => (
              <button key={m.id} onClick={() => {
                setScanMode(m.id); setDetectedFoods([]); setSelectedFoodIdx(null); setAnalyzeError(''); setSearchResults([]);
                if (m.id==='camera') startCamera();
                else { stopCamera(); if (m.id==='voice') startVoice(); }
              }} style={{
                flex:1, padding:'10px 0', borderRadius:12,
                border:`1.5px solid ${scanMode===m.id ? T.accent : T.border}`,
                fontSize:'clamp(11px,2.8vw,12px)', fontWeight:600,
                background: scanMode===m.id ? T.accentLight : T.white,
                color: scanMode===m.id ? T.accent : T.textTer
              }}>{m.icon} {m.label}</button>
            ))}
          </div>

          <div style={{ flex:1, padding:'8px 16px 24px', overflow:'auto' }}>

            {/* CAMERA */}
            {scanMode==='camera' && <>
              {!analyzing && detectedFoods.length===0 && !analyzeError && (
                <div style={{ borderRadius:20, overflow:'hidden', background:'#1a1a1a', position:'relative', aspectRatio:'4/3', marginBottom:12, boxShadow:T.shadowLg }}>
                  {cameraActive ? <>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    <div style={{ position:'absolute', inset:'12%', border:`2px dashed ${T.accent}`, borderRadius:20, opacity:.5 }}/>
                    <button onClick={captureAndAnalyze} style={{ position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)', width:68, height:68, borderRadius:'50%', background:T.accent, border:'4px solid white', boxShadow:'0 4px 20px rgba(59,130,246,0.5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, color:'#fff' }}>📸</button>
                  </> : (
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', color:'#ccc', padding:32 }}>
                      <div style={{ fontSize:52, marginBottom:12 }}>📷</div>
                      <p style={{ fontSize:14, textAlign:'center', marginBottom:4, lineHeight:1.5 }}>Prends en photo ton repas</p>
                      <p style={{ fontSize:12, textAlign:'center', marginBottom:16, color:'#888', lineHeight:1.4 }}>L'IA reconnaîtra les aliments,<br/>le packaging et les codes-barres</p>
                      <button onClick={startCamera} style={{ padding:'12px 32px', background:T.accent, borderRadius:12, color:'#fff', fontSize:14, fontWeight:700, boxShadow:'0 2px 12px rgba(59,130,246,0.4)' }}>Activer la caméra</button>
                    </div>
                  )}
                </div>
              )}

              {analyzing && (
                <div style={{ textAlign:'center', padding:48 }}>
                  <div style={{ fontSize:52, animation:'spin 1.2s linear infinite', display:'inline-block' }}>🔍</div>
                  <p style={{ color:T.accent, fontSize:16, fontWeight:600, marginTop:16 }}>L'IA analyse ta photo...</p>
                </div>
              )}

              {analyzeError && !analyzing && (
                <div style={{ background:T.redLight, borderRadius:14, padding:16, marginBottom:12, textAlign:'center' }}>
                  <p style={{ color:T.red, fontSize:13, fontWeight:600, marginBottom:8 }}>{analyzeError}</p>
                  <button onClick={() => { setAnalyzeError(''); startCamera(); }} style={{ padding:'8px 20px', background:T.accent, borderRadius:10, color:'#fff', fontSize:12, fontWeight:600 }}>Réessayer</button>
                </div>
              )}

              {detectedFoods.length > 0 && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <h3 style={{ fontSize:15, fontWeight:700 }}>{detectedFoods.length} aliment{detectedFoods.length>1?'s':''} détecté{detectedFoods.length>1?'s':''}</h3>
                    {detectedFoods.length > 1 && (
                      <button onClick={() => { detectedFoods.forEach(f => addFood(f)); resetScanner(); }} style={{ padding:'8px 16px', background:T.accent, borderRadius:10, color:'#fff', fontSize:12, fontWeight:600, boxShadow:'0 2px 8px rgba(59,130,246,0.3)' }}>Tout ajouter</button>
                    )}
                  </div>
                  {detectedFoods.map((f, i) => (
                    <div key={i} style={{ background:T.white, borderRadius:16, padding:14, marginBottom:8, border: selectedFoodIdx===i ? `2px solid ${T.accent}` : `1px solid ${T.border}`, boxShadow: selectedFoodIdx===i ? '0 2px 12px rgba(59,130,246,0.15)' : T.shadow, transition:'all .2s' }}
                      onClick={() => setSelectedFoodIdx(selectedFoodIdx===i ? null : i)}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <span style={{ fontSize:30 }}>{f.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ color:T.text, fontSize:14, fontWeight:600 }}>{f.name}</div>
                          <div style={{ color:T.textTer, fontSize:11 }}>{f.grams}g · P:{f.protein}g · G:{f.carbs}g · L:{f.fat}g</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ color:T.accent, fontSize:16, fontWeight:700 }}>{f.cal}</div>
                          <div style={{ color:T.textTer, fontSize:10 }}>kcal</div>
                        </div>
                      </div>
                      {selectedFoodIdx===i && (
                        <button onClick={(e) => { e.stopPropagation(); addFood(f); resetScanner(); }} style={{ width:'100%', padding:'10px 0', background:T.accent, borderRadius:10, color:'#fff', fontSize:13, fontWeight:700, marginTop:10 }}>
                          ✓ Ajouter au {MEALS.find(m=>m.id===selectedMealType)?.label}
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => { setDetectedFoods([]); setSelectedFoodIdx(null); startCamera(); }} style={{ width:'100%', padding:'12px 0', background:T.white, border:`1px solid ${T.border}`, borderRadius:12, color:T.textSec, fontSize:13, fontWeight:600, marginTop:8 }}>📷 Reprendre une photo</button>
                </div>
              )}
              <canvas ref={canvasRef} style={{ display:'none' }}/>
            </>}

            {/* MANUAL */}
            {scanMode==='manual' && <>
              <div style={{ position:'relative', marginBottom:8 }}>
                <input
                  ref={inputRef}
                  key="manual-search-input"
                  placeholder="Décris ton repas... (ex: 300g pâtes bolo)"
                  value={manualInput}
                  onChange={e => handleSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && manualInput.length >= 2) analyzeText(manualInput); }}
                  autoComplete="off" autoCorrect="off" spellCheck={false} autoCapitalize="off"
                  enterKeyHint="search"
                  style={{ width:'100%', padding:'14px 16px 14px 44px', background:T.white, border:`1.5px solid ${T.border}`, borderRadius:14, color:T.text, fontSize:16, outline:'none', boxSizing:'border-box', boxShadow:T.shadow, WebkitAppearance:'none' }}
                />
                <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, opacity:.35, pointerEvents:'none' }}>🔍</span>
              </div>

              {/* AI Analyze button */}
              {manualInput.length >= 2 && !analyzing && detectedFoods.length === 0 && (
                <button onClick={() => analyzeText(manualInput)} style={{
                  width:'100%', padding:'12px 0', background:'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                  borderRadius:12, color:'#fff', fontSize:14, fontWeight:700, marginBottom:12,
                  boxShadow:'0 2px 12px rgba(59,130,246,0.3)', display:'flex', alignItems:'center', justifyContent:'center', gap:8
                }}>
                  🤖 Analyser par IA : "{manualInput.length > 30 ? manualInput.slice(0,30)+'...' : manualInput}"
                </button>
              )}

              {/* Analyzing spinner */}
              {analyzing && (
                <div style={{ textAlign:'center', padding:32 }}>
                  <div style={{ fontSize:44, animation:'spin 1.2s linear infinite', display:'inline-block' }}>🤖</div>
                  <p style={{ color:T.accent, fontSize:14, fontWeight:600, marginTop:12 }}>L'IA analyse "{manualInput.length > 25 ? manualInput.slice(0,25)+'...' : manualInput}"</p>
                </div>
              )}

              {/* Error */}
              {analyzeError && !analyzing && (
                <div style={{ background:T.redLight, borderRadius:14, padding:16, marginBottom:12, textAlign:'center' }}>
                  <p style={{ color:T.red, fontSize:13, fontWeight:600, marginBottom:8 }}>{analyzeError}</p>
                  <button onClick={() => { setAnalyzeError(''); }} style={{ padding:'8px 20px', background:T.accent, borderRadius:10, color:'#fff', fontSize:12, fontWeight:600 }}>OK</button>
                </div>
              )}

              {/* Local DB quick results */}
              {searchResults.length > 0 && detectedFoods.length === 0 && !analyzing && (
                <>
                  <div style={{ fontSize:11, color:T.textTer, fontWeight:600, textTransform:'uppercase', letterSpacing:.5, marginBottom:6, paddingLeft:4 }}>Résultats rapides</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                    {searchResults.map((f, i) => (
                      <button key={f.name+i} onClick={() => { setDetectedFoods([f]); setSelectedFoodIdx(0); setSearchResults([]); }}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'clamp(10px,2.5vw,14px) clamp(12px,3vw,16px)', background:T.white, borderRadius:14, boxShadow:T.shadow, textAlign:'left', width:'100%', border:'1.5px solid transparent' }}>
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
                </>
              )}

              {/* AI detected foods */}
              {detectedFoods.length > 0 && !analyzing && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <h3 style={{ fontSize:14, fontWeight:700, color:T.text }}>
                      🤖 {detectedFoods.length} aliment{detectedFoods.length>1?'s':''} identifié{detectedFoods.length>1?'s':''}
                    </h3>
                    {detectedFoods.length > 1 && (
                      <button onClick={() => { detectedFoods.forEach(f => addFood(f)); resetScanner(); }} style={{ padding:'8px 14px', background:T.accent, borderRadius:10, color:'#fff', fontSize:11, fontWeight:600, boxShadow:'0 2px 8px rgba(59,130,246,0.3)' }}>Tout ajouter</button>
                    )}
                  </div>
                  {detectedFoods.map((f, i) => (
                    <div key={i} style={{ background:T.white, borderRadius:16, padding:14, marginBottom:8, border: selectedFoodIdx===i ? `2px solid ${T.accent}` : `1px solid ${T.border}`, boxShadow: selectedFoodIdx===i ? '0 2px 12px rgba(59,130,246,0.15)' : T.shadow, transition:'all .2s' }}
                      onClick={() => setSelectedFoodIdx(selectedFoodIdx===i ? null : i)}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <span style={{ fontSize:30 }}>{f.icon}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ color:T.text, fontSize:14, fontWeight:600 }}>{f.name}</div>
                          <div style={{ color:T.textTer, fontSize:11 }}>{f.grams}g · P:{f.protein}g · G:{f.carbs}g · L:{f.fat}g</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ color:T.accent, fontSize:16, fontWeight:700 }}>{f.cal}</div>
                          <div style={{ color:T.textTer, fontSize:10 }}>kcal</div>
                        </div>
                      </div>
                      {selectedFoodIdx===i && (
                        <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${T.border}` }}>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:10 }}>
                            {[{l:'Cal',v:f.cal,u:'',c:T.accent},{l:'Prot',v:f.protein,u:'g',c:T.green},{l:'Gluc',v:f.carbs,u:'g',c:T.orange},{l:'Lip',v:f.fat,u:'g',c:T.red}].map(x=>(
                              <div key={x.l} style={{ background:T.bg, borderRadius:8, padding:8, textAlign:'center' }}>
                                <div style={{ fontSize:9, color:T.textTer, textTransform:'uppercase' }}>{x.l}</div>
                                <div style={{ fontSize:14, fontWeight:700, color:x.c, marginTop:2 }}>{x.v}{x.u}</div>
                              </div>
                            ))}
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); addFood(f); resetScanner(); }} style={{ width:'100%', padding:'10px 0', background:T.accent, borderRadius:10, color:'#fff', fontSize:13, fontWeight:700 }}>
                            ✓ Ajouter au {MEALS.find(m=>m.id===selectedMealType)?.label}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {manualInput.length >= 2 && searchResults.length === 0 && detectedFoods.length === 0 && !analyzing && !analyzeError && (
                <div style={{ textAlign:'center', padding:24, color:T.textTer }}>
                  <p style={{ fontSize:12, lineHeight:1.5 }}>Tape ton repas et appuie sur <b style={{color:T.accent}}>Analyser par IA</b><br/>ou appuie <b>Entrée</b> sur ton clavier</p>
                </div>
              )}
            </>}

            {/* VOICE */}
            {scanMode==='voice' && (
              <div style={{ textAlign:'center', padding:32 }}>
                {isListening ? <>
                  <div style={{ width:110, height:110, borderRadius:'50%', background:T.accentLight, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', animation:'pulse 1.5s ease infinite' }}>
                    <div style={{ width:72, height:72, borderRadius:'50%', background:T.accent, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:30 }}>🎙️</div>
                  </div>
                  <p style={{ color:T.accent, fontSize:18, fontWeight:600, marginBottom:4 }}>Écoute en cours...</p>
                  {voiceText && <p style={{ color:T.text, fontSize:15, fontWeight:500, marginTop:8, background:T.white, padding:'10px 16px', borderRadius:10, display:'inline-block' }}>"{voiceText}"</p>}
                  <p style={{ color:T.textTer, fontSize:12, marginTop:12 }}>Dis juste le nom de l'aliment<br/>(ex: "poulet", "riz", "banane")</p>
                  <button onClick={() => { if(recognitionRef.current) recognitionRef.current.stop(); setIsListening(false); }}
                    style={{ marginTop:16, padding:'10px 24px', background:T.red, borderRadius:10, color:'#fff', fontSize:13, fontWeight:600 }}>Arrêter</button>
                </> : <>
                  <div style={{ fontSize:56, marginBottom:16 }}>🎙️</div>
                  <p style={{ color:T.text, fontSize:17, fontWeight:600, marginBottom:6 }}>Entrée vocale</p>
                  <p style={{ color:T.textTer, fontSize:13, marginBottom:24, lineHeight:1.6 }}>Appuie sur le micro et dis<br/>le nom de ton aliment<br/><b>(un seul mot : "poulet", "riz"...)</b></p>
                  {voiceError && <div style={{ background:T.redLight, borderRadius:12, padding:12, marginBottom:16 }}><p style={{ color:T.red, fontSize:12 }}>{voiceError}</p></div>}
                  {voiceText && !voiceError && <p style={{ color:T.accent, fontSize:14, marginBottom:16, background:T.accentLight, padding:'8px 16px', borderRadius:10, display:'inline-block' }}>Dernier : « {voiceText} »</p>}
                  <div><button onClick={startVoice} style={{ width:80, height:80, borderRadius:'50%', background:T.accent, fontSize:32, color:'#fff', boxShadow:'0 4px 24px rgba(59,130,246,0.4)' }}>🎙️</button></div>
                </>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ HOME TAB ═══ */}
      {tab==='home' && !showScanner && (
        <div style={{ padding:'0 clamp(16px,4vw,24px)', animation:'fadeIn .4s ease' }}>
          <div style={{ paddingTop:'clamp(16px,4vw,24px)', marginBottom:16 }}>
            <div style={{ color:T.textTer, fontSize:'clamp(11px,2.6vw,12px)' }}>{selectedDate.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'long'})}</div>
            <h1 style={{ fontSize:'clamp(20px,5.5vw,26px)', fontWeight:800, marginTop:2 }}>Cal's Jo 🔥</h1>
          </div>

          <div style={{ display:'flex', gap:4, marginBottom:20 }}>
            {Array.from({length:7},(_,i) => {
              const d = new Date(selectedDate); d.setDate(selectedDate.getDate()-dow+i);
              const s = dateKey(d)===dateKey(selectedDate), t = dateKey(d)===dateKey(new Date());
              return (
                <button key={i} onClick={() => setSelectedDate(new Date(d))} style={{ flex:1, padding:'6px 0', borderRadius:12, textAlign:'center', background:s?T.accent:'transparent', boxShadow:s?'0 2px 8px rgba(59,130,246,0.3)':'none' }}>
                  <div style={{ fontSize:10, color:s?'rgba(255,255,255,0.7)':T.textTer, marginBottom:2 }}>{DA[i]}</div>
                  <div style={{ fontSize:14, fontWeight:(t||s)?700:500, color:s?'#fff':t?T.accent:T.text }}>{d.getDate()}</div>
                </button>
              );
            })}
          </div>

          <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}><SemiGauge value={totals.cal} max={dailyGoal.cal}/></div>
          <div style={{ textAlign:'center', color:T.textTer, fontSize:12, marginBottom:16 }}>Objectif : <b style={{ color:T.text }}>{dailyGoal.cal}</b> kcal</div>

          <div style={{ display:'flex', gap:10, marginBottom:20 }}>
            {[{l:"Protéines",v:totals.protein,m:dailyGoal.protein,c:T.green,bg:T.greenLight},{l:"Glucides",v:totals.carbs,m:dailyGoal.carbs,c:T.orange,bg:T.orangeLight},{l:"Lipides",v:totals.fat,m:dailyGoal.fat,c:T.red,bg:T.redLight}].map(x => (
              <div key={x.l} style={{ flex:1, background:T.white, borderRadius:14, padding:'clamp(10px,2.5vw,14px)', boxShadow:T.shadow, textAlign:'center' }}>
                <div style={{ width:32, height:32, borderRadius:8, background:x.bg, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 6px' }}><div style={{ width:10, height:10, borderRadius:'50%', background:x.c }}/></div>
                <div style={{ fontSize:10, color:T.textTer, textTransform:'uppercase', letterSpacing:.5, marginBottom:2 }}>{x.l}</div>
                <div style={{ fontSize:'clamp(13px,3.2vw,15px)', fontWeight:700, color:T.text }}>{Math.round(x.v)}<span style={{ fontWeight:400, color:T.textTer, fontSize:10 }}>/{x.m}g</span></div>
              </div>
            ))}
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <h2 style={{ fontSize:'clamp(15px,4vw,17px)', fontWeight:700 }}>{isViewToday?"Aujourd'hui":selectedDate.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</h2>
            <button onClick={() => { setTab('calendar'); setCalMonth(new Date(selectedDate)); }} style={{ fontSize:12, color:T.accent, fontWeight:600 }}>Calendrier →</button>
          </div>

          {MEALS.map(meal => {
            const items = todayMeals[meal.id];
            const mc = items.reduce((s,f) => s+f.cal, 0);
            return (
              <div key={meal.id} style={{ background:T.white, borderRadius:18, padding:'clamp(12px,3vw,16px)', marginBottom:10, boxShadow:T.shadow }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:items.length?10:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:22 }}>{meal.icon}</span>
                    <span style={{ color:T.text, fontSize:'clamp(13px,3.5vw,15px)', fontWeight:600 }}>{meal.label}</span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    {mc>0 && <span style={{ color:T.accent, fontSize:13, fontWeight:700 }}>{mc} kcal</span>}
                    <button onClick={() => { setSelectedMealType(meal.id); setShowScanner(true); }} style={{ width:32, height:32, borderRadius:10, background:T.accentLight, border:`1.5px solid ${T.accent}33`, color:T.accent, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                  </div>
                </div>
                {items.map(f => (
                  <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderTop:`1px solid ${T.border}` }}>
                    <span style={{ fontSize:20 }}>{f.icon}</span>
                    <div style={{ flex:1 }}><div style={{ color:T.text, fontSize:13, fontWeight:500 }}>{f.name}</div><div style={{ color:T.textTer, fontSize:10 }}>{f.grams}g · P:{f.protein}g · G:{f.carbs}g · L:{f.fat}g</div></div>
                    <span style={{ color:T.accent, fontSize:13, fontWeight:700 }}>{f.cal}</span>
                    <button onClick={() => removeFood(meal.id, f.id)} style={{ color:T.red, fontSize:13, opacity:.6, padding:'0 4px' }}>✕</button>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Spacer for FAB */}
          <div style={{ height:60 }}/>
        </div>
      )}

      {/* ═══ CALENDAR TAB ═══ */}
      {tab==='calendar' && !showScanner && (
        <div style={{ padding:'clamp(16px,4vw,24px)', animation:'fadeIn .4s ease' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(),calMonth.getMonth()-1,1))} style={{ width:40, height:40, borderRadius:12, background:T.white, boxShadow:T.shadow, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:T.text }}>‹</button>
            <h2 style={{ fontSize:'clamp(17px,4.5vw,20px)', fontWeight:700 }}>{MO[calMonth.getMonth()]} {calMonth.getFullYear()}</h2>
            <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(),calMonth.getMonth()+1,1))} style={{ width:40, height:40, borderRadius:12, background:T.white, boxShadow:T.shadow, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:T.text }}>›</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
            {DA.map(d => <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:600, color:T.textTer, padding:'4px 0' }}>{d}</div>)}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:24 }}>
            {getCalDays(calMonth).map((d, i) => {
              if (!d) return <div key={`e-${i}`}/>;
              const s=isSel(d), t=isToday(d), h=hasData(d);
              return (
                <button key={i} onClick={() => setSelectedDate(new Date(d))} style={{ aspectRatio:'1', borderRadius:14, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:s?T.accent:t?T.accentLight:T.white, boxShadow:s?'0 2px 10px rgba(59,130,246,0.3)':h?T.shadow:'none', border:t&&!s?`2px solid ${T.accent}`:'2px solid transparent', position:'relative' }}>
                  <span style={{ fontSize:'clamp(13px,3.2vw,15px)', fontWeight:(s||t)?700:500, color:s?'#fff':T.text }}>{d.getDate()}</span>
                  {h && <div style={{ width:5, height:5, borderRadius:'50%', background:s?'#fff':T.accent, marginTop:2 }}/>}
                </button>
              );
            })}
          </div>

          {(() => {
            const sm = getMeals(selectedDate), st = dayTotals(sm), sc = Object.values(sm).flat().length;
            return (
              <div style={{ background:T.white, borderRadius:18, padding:'clamp(14px,3.5vw,20px)', boxShadow:T.shadow }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <h3 style={{ fontSize:15, fontWeight:700 }}>{isViewToday?"Aujourd'hui":selectedDate.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}</h3>
                  <button onClick={() => setTab('home')} style={{ fontSize:12, color:T.accent, fontWeight:600 }}>Détails →</button>
                </div>
                {sc===0 ? (
                  <div style={{ textAlign:'center', padding:'16px 0', color:T.textTer }}>
                    <div style={{ fontSize:28, marginBottom:4 }}>📝</div><p style={{ fontSize:13 }}>Aucun repas enregistré</p>
                    <button onClick={() => { setTab('home'); setShowScanner(true); }} style={{ marginTop:8, padding:'8px 20px', background:T.accent, borderRadius:10, color:'#fff', fontSize:12, fontWeight:600 }}>+ Ajouter</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ display:'flex', gap:12, marginBottom:12 }}>
                      <div style={{ flex:1, background:T.bg, borderRadius:12, padding:12, textAlign:'center' }}><div style={{ fontSize:22, fontWeight:800, color:T.accent }}>{st.cal}</div><div style={{ fontSize:10, color:T.textTer }}>kcal</div></div>
                      <div style={{ flex:1, background:T.bg, borderRadius:12, padding:12, textAlign:'center' }}><div style={{ fontSize:22, fontWeight:800, color:T.green }}>{Math.round(st.protein)}g</div><div style={{ fontSize:10, color:T.textTer }}>prot</div></div>
                      <div style={{ flex:1, background:T.bg, borderRadius:12, padding:12, textAlign:'center' }}><div style={{ fontSize:22, fontWeight:800, color:T.text }}>{sc}</div><div style={{ fontSize:10, color:T.textTer }}>aliments</div></div>
                    </div>
                    {MEALS.map(m => { const it=sm[m.id]; if(!it.length) return null; return (
                      <div key={m.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderTop:`1px solid ${T.border}` }}>
                        <span style={{ fontSize:13, color:T.textSec }}>{m.icon} {m.label}</span>
                        <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{it.reduce((s,f)=>s+f.cal,0)} kcal</span>
                      </div>
                    );})}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* FAB - positioned above bottom nav, centered */}
      {!showScanner && (
        <button onClick={() => setShowScanner(true)} style={{
          position:'fixed', bottom:86, left:'50%', transform:'translateX(-50%)',
          width:56, height:56, borderRadius:'50%', background:T.accent, color:'#fff', fontSize:24,
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 4px 20px rgba(59,130,246,0.4)', zIndex:50
        }}>+</button>
      )}

      {/* Bottom nav */}
      {!showScanner && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, height:70, background:T.white, borderTop:`1px solid ${T.border}`, display:'flex', zIndex:100, paddingBottom:'env(safe-area-inset-bottom)' }}>
          {[{id:'home',icon:'🏠',label:'Accueil'},{id:'calendar',icon:'📅',label:'Calendrier'}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, color:tab===t.id?T.accent:T.textTer }}>
              <span style={{ fontSize:22 }}>{t.icon}</span>
              <span style={{ fontSize:10, fontWeight:tab===t.id?700:500 }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
