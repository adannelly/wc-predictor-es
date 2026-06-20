import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Clock, Lock, CheckCircle, User, Users, Activity, Settings, Info, Trash2, CalendarDays, ShieldAlert, Medal, ChevronRight, LogOut, KeyRound } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, setDoc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';

// --- Firebase Configuration ---
const userProvidedConfig = {
  apiKey: "AIzaSyDZIT2YUO3xAmmCH7NpCQ3emIKe-VtFWwQ",
  authDomain: "world-cup-predictor-817df.firebaseapp.com",
  databaseURL: "https://world-cup-predictor-817df-default-rtdb.firebaseio.com",
  projectId: "world-cup-predictor-817df",
  storageBucket: "world-cup-predictor-817df.firebasestorage.app",
  messagingSenderId: "958625300779",
  appId: "1:958625300779:web:14e1652dbd2272c628456e",
  measurementId: "G-9NNBZJ4EC9"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : userProvidedConfig;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wc-predictor-123';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Edition (language + user separation) ---
// Both the English and Spanish sites share ONE Firebase backend (same matches,
// scores and settings). What differs per deployment is this single value, read
// from the build env: set VITE_EDITION=es in the Spanish deployment; English
// leaves it unset. The edition drives the language AND keeps users separate.
const EDITION = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_EDITION === 'es') ? 'es' : 'en';

// Spanish accounts are namespaced with an "es_" prefix so an English "maria"
// and a Spanish "maria" never collide. English keeps no prefix, so all the
// accounts and predictions you already have are untouched.
const EDITION_PREFIX = EDITION === 'es' ? 'es_' : '';

// Which edition a stored user/prediction belongs to. Falls back to the id
// prefix, then to 'en' — so legacy English records (no edition field) read 'en'.
const editionOfUid = (uid) => (typeof uid === 'string' && uid.startsWith('es_')) ? 'es' : 'en';
const docEdition = (d) => (d && d.edition) || editionOfUid(d && d.uid);

// --- Language strings ---
const STRINGS = {
  en: {
    appTitleSuffix: '26',
    nav: { predict: 'Predict', standings: 'Standings', picks: 'Picks', rules: 'Rules', profile: 'Profile', admin: 'Admin' },
    spinner: 'Warming up the pitch...',
    configError: 'Configuration Error',
    authFailed: (m) => `Authentication Failed: ${m}`,
    dbDenied: (m) => `Database Access Denied: ${m}`,
    setupError: (m) => `Unexpected setup error: ${m}`,
    stillConnecting: 'Still connecting — try again in a moment.',
    nameTaken: 'That name is already taken and the PIN does not match.',
    loginFailed: (m) => `Login failed: ${m}`,
    errEnterName: 'Please enter a name using letters or numbers.',
    errPin: 'Your PIN must be exactly 4 digits.',
    pitchTitle: 'The Pitch',
    pitchSubtitle: 'Predict final scores before match kick-off to earn points.',
    liveUpcoming: 'Live & Upcoming',
    finishedMatches: 'Finished Matches',
    fullTime: 'Full Time',
    locked: 'Locked',
    saving: 'Saving...',
    savePrediction: 'Save Prediction',
    actualScore: 'Actual Score:',
    ptsEarned: (n) => `+${n} Pts Earned`,
    zeroPts: '0 Pts Earned',
    noPrediction: 'No prediction',
    standingsTitle: 'Global Standings',
    standingsSubtitle: 'Rankings update instantly as matches conclude.',
    noPoints: 'No points awarded yet.',
    you: 'You',
    exactScores: (n) => `${n} Exact Score${n !== 1 ? 's' : ''}`,
    correctResults: (n) => `${n} Correct Result${n !== 1 ? 's' : ''}`,
    pts: 'PTS',
    profileNote: 'Signed in. Use the same name and PIN to pick up on any phone or computer.',
    profileInfo: 'Your predictions and points are tied to this name. Logging in elsewhere with the same name and PIN picks up right where you left off.',
    logOut: 'Log Out',
    scoringRules: 'Scoring Rules',
    correctResultTitle: 'Correct Result',
    correctResultBody: (p) => `Earn ${p} point if you correctly predict the overall outcome (Win, Draw, or Loss) but miss the exact score.`,
    exactBonusTitle: 'Exact Score Bonus',
    exactBonusBodyPre: (b) => `Earn ${b} additional points (`,
    exactBonusBodyTotal: (t) => `${t} points total`,
    exactBonusBodyPost: ') if you nail the exact final score.',
    ruleLock: "Predictions lock automatically at the match's scheduled kick-off time.",
    ruleBoard: 'The leaderboard updates instantly as soon as a final score is recorded.',
    adminTitle: 'Admin Simulator',
    adminSubtitle: 'Input match results & manage data.',
    reEnableLocks: 'Re-enable Time Locks',
    unlockAll: 'Unlock All Matches',
    scheduleTools: 'Schedule Tools',
    scheduleToolsBody: 'Load the complete group stage — all 12 groups, 72 matches, set to "scheduled" so everyone can predict them. This replaces the current schedule.',
    seedConfirm: 'This wipes the current matches and loads a fresh group stage. Continue?',
    loading: 'Loading...',
    yesLoad: 'Yes, load it',
    cancel: 'Cancel',
    loadGroupStage: 'Load Full Group Stage',
    editEntries: 'Edit Player Entries',
    selectUser: 'Select User',
    chooseUser: '-- Choose User --',
    selectMatch: 'Select Match',
    chooseMatch: '-- Choose Match --',
    modifyPrediction: 'Modify Prediction:',
    forceSave: 'Force Save',
    createMatch: 'Create Match',
    homeTeam: 'Home Team',
    awayTeam: 'Away Team',
    stageLabel: 'Stage',
    startTimeLocal: 'Start Time (Local)',
    addingMatch: 'Adding Match...',
    addMatch: 'Add Match to Schedule',
    matchDatabase: 'Match Database',
    deleteQ: 'Delete?',
    yes: 'Yes',
    no: 'No',
    setFinal: 'Set Final',
    reset: 'Reset',
    savedTime: 'Saved ✓',
    saveTime: 'Save Time',
    egHome: 'e.g. Brazil',
    egAway: 'e.g. France',
    egStage: 'e.g. Group G',
    picksTitle: "Everyone's Picks",
    picksSubtitle: "Every player's prediction is visible here, for every match.",
    noMatches: 'No matches scheduled yet.',
    noPredForMatch: 'No predictions for this match.',
    loginSubtitle: 'Enter your name and a 4-digit PIN to start. Use the same details to log back in from any device.',
    yourName: 'Your Name',
    pinLabel: '4-Digit PIN',
    connecting: 'Connecting...',
    enterPool: 'Enter Pool',
    loginFooterNew: "New name? You'll be registered automatically.",
    loginFooterReturn: 'Returning? Enter the same name and PIN.',
    egName: 'e.g. Adam',
  },
  es: {
    appTitleSuffix: '26',
    nav: { predict: 'Predecir', standings: 'Posiciones', picks: 'Pronósticos', rules: 'Reglas', profile: 'Perfil', admin: 'Admin' },
    spinner: 'Calentando el campo...',
    configError: 'Error de configuración',
    authFailed: (m) => `Error de autenticación: ${m}`,
    dbDenied: (m) => `Acceso a la base de datos denegado: ${m}`,
    setupError: (m) => `Error de configuración inesperado: ${m}`,
    stillConnecting: 'Aún conectando — inténtalo de nuevo en un momento.',
    nameTaken: 'Ese nombre ya está en uso y el PIN no coincide.',
    loginFailed: (m) => `Error al iniciar sesión: ${m}`,
    errEnterName: 'Introduce un nombre con letras o números.',
    errPin: 'El PIN debe tener exactamente 4 dígitos.',
    pitchTitle: 'El Campo',
    pitchSubtitle: 'Pronostica los marcadores finales antes del inicio del partido para ganar puntos.',
    liveUpcoming: 'En vivo y próximos',
    finishedMatches: 'Partidos finalizados',
    fullTime: 'Finalizado',
    locked: 'Bloqueado',
    saving: 'Guardando...',
    savePrediction: 'Guardar pronóstico',
    actualScore: 'Marcador real:',
    ptsEarned: (n) => `+${n} pts ganados`,
    zeroPts: '0 pts ganados',
    noPrediction: 'Sin pronóstico',
    standingsTitle: 'Clasificación general',
    standingsSubtitle: 'La clasificación se actualiza al instante cuando terminan los partidos.',
    noPoints: 'Aún no se han otorgado puntos.',
    you: 'Tú',
    exactScores: (n) => `${n} marcador${n !== 1 ? 'es' : ''} exacto${n !== 1 ? 's' : ''}`,
    correctResults: (n) => `${n} resultado${n !== 1 ? 's' : ''} correcto${n !== 1 ? 's' : ''}`,
    pts: 'PTS',
    profileNote: 'Sesión iniciada. Usa el mismo nombre y PIN para continuar en cualquier teléfono o computadora.',
    profileInfo: 'Tus pronósticos y puntos están vinculados a este nombre. Iniciar sesión en otro lugar con el mismo nombre y PIN retoma justo donde lo dejaste.',
    logOut: 'Cerrar sesión',
    scoringRules: 'Reglas de puntuación',
    correctResultTitle: 'Resultado correcto',
    correctResultBody: (p) => `Gana ${p} punto si aciertas el resultado general (victoria, empate o derrota) pero fallas el marcador exacto.`,
    exactBonusTitle: 'Bono por marcador exacto',
    exactBonusBodyPre: (b) => `Gana ${b} puntos adicionales (`,
    exactBonusBodyTotal: (t) => `${t} puntos en total`,
    exactBonusBodyPost: ') si aciertas el marcador final exacto.',
    ruleLock: 'Los pronósticos se bloquean automáticamente a la hora de inicio del partido.',
    ruleBoard: 'La clasificación se actualiza al instante en cuanto se registra un marcador final.',
    adminTitle: 'Panel de administración',
    adminSubtitle: 'Introduce resultados y gestiona los datos.',
    reEnableLocks: 'Reactivar bloqueos',
    unlockAll: 'Desbloquear todos',
    scheduleTools: 'Herramientas de calendario',
    scheduleToolsBody: 'Carga la fase de grupos completa — los 12 grupos, 72 partidos, en estado «programado» para que todos puedan pronosticar. Esto reemplaza el calendario actual.',
    seedConfirm: 'Esto borra los partidos actuales y carga una fase de grupos nueva. ¿Continuar?',
    loading: 'Cargando...',
    yesLoad: 'Sí, cargar',
    cancel: 'Cancelar',
    loadGroupStage: 'Cargar fase de grupos completa',
    editEntries: 'Editar pronósticos de jugadores',
    selectUser: 'Seleccionar jugador',
    chooseUser: '-- Elegir jugador --',
    selectMatch: 'Seleccionar partido',
    chooseMatch: '-- Elegir partido --',
    modifyPrediction: 'Modificar pronóstico:',
    forceSave: 'Guardar',
    createMatch: 'Crear partido',
    homeTeam: 'Equipo local',
    awayTeam: 'Equipo visitante',
    stageLabel: 'Fase',
    startTimeLocal: 'Hora de inicio (local)',
    addingMatch: 'Añadiendo partido...',
    addMatch: 'Añadir partido al calendario',
    matchDatabase: 'Base de datos de partidos',
    deleteQ: '¿Eliminar?',
    yes: 'Sí',
    no: 'No',
    setFinal: 'Marcar final',
    reset: 'Reiniciar',
    savedTime: 'Guardado ✓',
    saveTime: 'Guardar hora',
    egHome: 'Ej. Brasil',
    egAway: 'Ej. Francia',
    egStage: 'Ej. Grupo G',
    picksTitle: 'Pronósticos de todos',
    picksSubtitle: 'Aquí se ve el pronóstico de cada jugador, para cada partido.',
    noMatches: 'Aún no hay partidos programados.',
    noPredForMatch: 'Sin pronósticos para este partido.',
    loginSubtitle: 'Introduce tu nombre y un PIN de 4 dígitos para empezar. Usa los mismos datos para volver a entrar desde cualquier dispositivo.',
    yourName: 'Tu nombre',
    pinLabel: 'PIN de 4 dígitos',
    connecting: 'Conectando...',
    enterPool: 'Entrar a la quiniela',
    loginFooterNew: '¿Nombre nuevo? Te registraremos automáticamente.',
    loginFooterReturn: '¿Vuelves? Introduce el mismo nombre y PIN.',
    egName: 'Ej. Adam',
  },
};

// Active language for this build.
const T = STRINGS[EDITION];

// --- Identity helpers (name + PIN accounts) ---
// A player's identity is their name, not the browser. The name becomes a
// stable account id so the same person can log in from any device.
const ACCOUNT_STORAGE_KEY = `wc_account_id_${EDITION}`;

// Turn a display name into a Firestore-safe id, e.g. "Adam D" -> "adam_d".
const slugify = (name) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

// Hash the PIN (salted with the account id) so raw PINs never touch the DB.
async function hashPin(pin, accountId) {
  const data = new TextEncoder().encode(`wc26:${accountId}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Scoring Configuration ---
// Single source of truth for the scoring system. The Rules tab and all
// point calculations reference these, so the displayed rules can never
// drift out of sync with the actual math.
const POINTS_CORRECT_RESULT = 1;  // correct outcome only (Win / Draw / Loss)
const POINTS_EXACT_BONUS = 3;     // additional points for nailing the exact score
const POINTS_EXACT_TOTAL = POINTS_CORRECT_RESULT + POINTS_EXACT_BONUS; // = 4

// --- Flag Utility ---
const FLAG_MAP = {
  'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷', 'Czechia': '🇨🇿',
  'Canada': '🇨🇦', 'Bosnia': '🇧🇦', 'USA': '🇺🇸', 'Paraguay': '🇵🇾', 'Qatar': '🇶🇦',
  'Switzerland': '🇨🇭', 'Brazil': '🇧🇷', 'Morocco': '🇲🇦', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Haiti': '🇭🇹', 'Australia': '🇦🇺', 'Türkiye': '🇹🇷', 'Germany': '🇩🇪',
  'Curaçao': '🇨🇼', 'Netherlands': '🇳🇱', 'Japan': '🇯🇵', 'Ivory Coast': '🇨🇮',
  'Ecuador': '🇪🇨', 'Sweden': '🇸🇪', 'Tunisia': '🇹🇳', 'Spain': '🇪🇸',
  'Cape Verde': '🇨🇻', 'Belgium': '🇧🇪', 'Egypt': '🇪🇬', 'Saudi Arabia': '🇸🇦',
  'Uruguay': '🇺🇾', 'Iran': '🇮🇷', 'New Zealand': '🇳🇿', 'France': '🇫🇷',
  'Senegal': '🇸🇳', 'Iraq': '🇮🇶', 'Norway': '🇳🇴', 'Argentina': '🇦🇷',
  'Algeria': '🇩🇿', 'Austria': '🇦🇹', 'Jordan': '🇯🇴', 'Portugal': '🇵🇹',
  'DR Congo': '🇨🇩', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Croatia': '🇭🇷', 'Ghana': '🇬🇭',
  'Panama': '🇵🇦', 'Uzbekistan': '🇺🇿', 'Colombia': '🇨🇴'
};

const getFlag = (teamName) => FLAG_MAP[teamName] || '⚽';

// --- Tournament Structure ---
// The 12 groups (A–L), four teams each, taken from the team list above.
const GROUPS = {
  A: ['Mexico', 'South Africa', 'South Korea', 'Czechia'],
  B: ['Canada', 'Bosnia', 'Qatar', 'Switzerland'],
  C: ['Brazil', 'Morocco', 'Scotland', 'Haiti'],
  D: ['USA', 'Paraguay', 'Australia', 'Türkiye'],
  E: ['Germany', 'Curaçao', 'Ivory Coast', 'Ecuador'],
  F: ['Netherlands', 'Japan', 'Sweden', 'Tunisia'],
  G: ['Belgium', 'Egypt', 'Iran', 'New Zealand'],
  H: ['Spain', 'Cape Verde', 'Saudi Arabia', 'Uruguay'],
  I: ['France', 'Senegal', 'Iraq', 'Norway'],
  J: ['Argentina', 'Algeria', 'Austria', 'Jordan'],
  K: ['Portugal', 'DR Congo', 'Uzbekistan', 'Colombia'],
  L: ['England', 'Croatia', 'Ghana', 'Panama'],
};

// Build every group-stage fixture: 12 groups × 3 matchdays × 2 games = 72.
// A 4-team round robin: each team plays the other three exactly once.
// IDs are deterministic (gs_<group>_<matchday>_<game>) so re-seeding never
// creates duplicates — it just overwrites the same fixtures.
function buildGroupStage() {
  const MATCHDAYS = [
    { md: 1, base: '2026-06-11', pairs: [[0, 1], [2, 3]] },
    { md: 2, base: '2026-06-18', pairs: [[0, 2], [3, 1]] },
    { md: 3, base: '2026-06-25', pairs: [[3, 0], [1, 2]] },
  ];
  const out = [];
  Object.keys(GROUPS).forEach((g, gi) => {
    const teams = GROUPS[g];
    const dayInWindow = Math.floor(gi / 4); // spread the 12 groups across 3 days
    const hour = 12 + (gi % 4) * 3;          // stagger kickoffs: 12/15/18/21 UTC
    MATCHDAYS.forEach(({ md, base, pairs }) => {
      pairs.forEach((pair, pIdx) => {
        const start = new Date(`${base}T00:00:00Z`);
        start.setUTCDate(start.getUTCDate() + dayInWindow);
        start.setUTCHours(hour + pIdx, 0, 0, 0);
        out.push({
          id: `gs_${g}_${md}_${pIdx + 1}`,
          stage: `Group ${g}`,
          homeTeam: teams[pair[0]],
          awayTeam: teams[pair[1]],
          startTime: start.toISOString(),
          homeScore: null,
          awayScore: null,
          status: 'scheduled',
        });
      });
    });
  });
  return out;
}

// The full group-stage schedule. Used to seed an empty database, and the
// Admin panel can reload it on demand.
const INITIAL_MATCHES = buildGroupStage();

// --- Admin ---
// The account allowed to see the Admin tab. Whoever registers this name owns
// it (protected by their PIN), so claim it before sharing the app.
const ADMIN_ACCOUNT_ID = 'admin';
// The admin account for THIS edition (e.g. "admin" in English, "es_admin" in
// Spanish). Each edition has its own admin login; both manage the shared games.
const EDITION_ADMIN_ID = EDITION_PREFIX + ADMIN_ACCOUNT_ID;

// --- Core Game Logic ---
function getPoints(predHome, predAway, actualHome, actualAway) {
  if (actualHome === null || actualAway === null || predHome === null || predAway === null || predHome === '' || predAway === '') return 0;

  const pHome = parseInt(predHome, 10);
  const pAway = parseInt(predAway, 10);
  const aHome = parseInt(actualHome, 10);
  const aAway = parseInt(actualAway, 10);

  if (isNaN(pHome) || isNaN(pAway) || isNaN(aHome) || isNaN(aAway)) return 0;

  const predResult = pHome > pAway ? 'home' : pHome < pAway ? 'away' : 'draw';
  const actResult = aHome > aAway ? 'home' : aHome < aAway ? 'away' : 'draw';

  let points = 0;
  if (predResult === actResult) {
    // Correct outcome earns the base point...
    points += POINTS_CORRECT_RESULT;
    // ...and an exact-score match earns the bonus on top of it.
    if (pHome === aHome && pAway === aAway) {
      points += POINTS_EXACT_BONUS;
    }
  }
  return points;
}

// Convert a stored ISO/UTC time into the "YYYY-MM-DDTHH:mm" local string that
// a <input type="datetime-local"> expects, so admins edit in their own time zone.
function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// --- Components ---

const MatchCard = ({ match, prediction, onSavePrediction, currentUserId, disableLocks }) => {
  const [homeScore, setHomeScore] = useState(prediction?.homeScore ?? '');
  const [awayScore, setAwayScore] = useState(prediction?.awayScore ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000); 
    return () => clearInterval(timer);
  }, []);

  const startTime = new Date(match.startTime);
  const isLocked = !disableLocks && now >= startTime;
  const isFinished = match.status === 'finished';
  const isDirty = (homeScore !== (prediction?.homeScore ?? '')) || (awayScore !== (prediction?.awayScore ?? ''));

  const handleSave = async () => {
    setIsSaving(true);
    await onSavePrediction(match.id, homeScore, awayScore);
    setIsSaving(false);
  };

  let earnedPoints = null;
  if (isFinished && prediction) {
    earnedPoints = getPoints(prediction.homeScore, prediction.awayScore, match.homeScore, match.awayScore);
  }

  // Visual state classes
  const cardBgClass = isFinished ? 'bg-white border-gray-200' : isLocked ? 'bg-slate-50 border-gray-200 opacity-90' : 'bg-white border-indigo-100 shadow-md hover:shadow-lg';
  const badgeClass = isFinished ? 'bg-blue-100 text-blue-800' : isLocked ? 'bg-gray-200 text-gray-600' : 'bg-indigo-100 text-indigo-800';

  return (
    <div className={`relative overflow-hidden border rounded-3xl p-5 mb-6 transition-all duration-300 ${cardBgClass}`}>
      
      {/* Top Bar: Stage & Time */}
      <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
           <CalendarDays size={14} className="text-gray-400" />
           {match.stage}
        </span>
        <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${badgeClass}`}>
          {isFinished ? (
            <><CheckCircle size={14} /> {T.fullTime}</>
          ) : isLocked ? (
            <><Lock size={14} /> {T.locked}</>
          ) : (
            <><Clock size={14} /> {startTime.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
          )}
        </div>
      </div>

      {/* Main Scoreboard Area */}
      <div className="flex items-center justify-between gap-2">
        {/* Home Team */}
        <div className="flex-1 flex flex-col items-center">
          <span className="text-4xl sm:text-5xl mb-2 drop-shadow-sm">{getFlag(match.homeTeam)}</span>
          <span className="font-extrabold text-gray-800 text-sm sm:text-base text-center leading-tight truncate w-full px-1">{match.homeTeam}</span>
        </div>
        
        {/* Scores */}
        <div className="flex flex-col items-center justify-center shrink-0 mx-2">
           <div className="flex items-center gap-2 bg-slate-100 p-2 sm:p-3 rounded-2xl shadow-inner border border-slate-200/60">
             <input 
               type="number" min="0"
               value={homeScore} 
               onChange={e => setHomeScore(e.target.value)} 
               disabled={isLocked || isFinished || isSaving}
               className={`w-12 h-14 sm:w-14 sm:h-16 text-center rounded-xl font-black text-2xl sm:text-3xl transition-all outline-none 
                 ${isLocked || isFinished ? 'bg-transparent text-slate-500' : 'bg-white text-indigo-950 shadow-sm border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'}`}
               placeholder="-"
             />
             <span className="text-slate-400 font-bold text-xl">:</span>
             <input 
               type="number" min="0"
               value={awayScore} 
               onChange={e => setAwayScore(e.target.value)} 
               disabled={isLocked || isFinished || isSaving}
               className={`w-12 h-14 sm:w-14 sm:h-16 text-center rounded-xl font-black text-2xl sm:text-3xl transition-all outline-none 
                 ${isLocked || isFinished ? 'bg-transparent text-slate-500' : 'bg-white text-indigo-950 shadow-sm border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'}`}
               placeholder="-"
             />
           </div>
        </div>

        {/* Away Team */}
        <div className="flex-1 flex flex-col items-center">
          <span className="text-4xl sm:text-5xl mb-2 drop-shadow-sm">{getFlag(match.awayTeam)}</span>
          <span className="font-extrabold text-gray-800 text-sm sm:text-base text-center leading-tight truncate w-full px-1">{match.awayTeam}</span>
        </div>
      </div>

      {/* Action Area */}
      {isDirty && !isLocked && !isFinished && (
         <button 
           onClick={handleSave} 
           disabled={isSaving} 
           className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg shadow-indigo-600/30 active:scale-[0.98]"
         >
           {isSaving ? <span className="animate-pulse">{T.saving}</span> : <>{T.savePrediction} <ChevronRight size={18} /></>}
         </button>
      )}

      {/* Results Area */}
      {isFinished && (
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            {T.actualScore}
            <span className="px-3 py-1 bg-slate-800 text-white rounded-lg text-sm tracking-normal">
              {match.homeScore} - {match.awayScore}
            </span>
          </div>
          <div>
            {prediction ? (
              <span className={`flex items-center gap-1.5 text-sm font-bold px-4 py-1.5 rounded-xl shadow-sm ${earnedPoints > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                {earnedPoints === POINTS_EXACT_TOTAL && <Trophy size={16} className="text-yellow-600" />}
                {earnedPoints > 0 ? T.ptsEarned(earnedPoints) : T.zeroPts}
              </span>
            ) : (
              <span className="text-sm font-medium text-slate-400 italic px-3 py-1 bg-slate-50 rounded-lg">{T.noPrediction}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MatchesTab = ({ matches, predictions, user, onSavePrediction, disableLocks }) => {
  const upcoming = matches.filter(m => m.status !== 'finished');
  const finished = matches.filter(m => m.status === 'finished').reverse(); // Newest finished first

  return (
    <div className="pb-8 animate-in fade-in duration-500">
      <div className="mb-8 text-center sm:text-left">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">{T.pitchTitle}</h2>
        <p className="text-slate-500 text-sm font-medium">{T.pitchSubtitle}</p>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span> {T.liveUpcoming}
          </h3>
          {upcoming.map(m => {
            const userPred = predictions.find(p => p.matchId === m.id && p.uid === user.uid);
            return <MatchCard key={m.id} match={m} prediction={userPred} currentUserId={user.uid} onSavePrediction={onSavePrediction} disableLocks={disableLocks} />;
          })}
        </div>
      )}

      {finished.length > 0 && (
        <div>
           <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 mt-10">
            <span className="w-2 h-2 rounded-full bg-slate-300"></span> {T.finishedMatches}
          </h3>
          {finished.map(m => {
            const userPred = predictions.find(p => p.matchId === m.id && p.uid === user.uid);
            return <MatchCard key={m.id} match={m} prediction={userPred} currentUserId={user.uid} onSavePrediction={onSavePrediction} disableLocks={disableLocks} />;
          })}
        </div>
      )}
    </div>
  );
};

const LeaderboardTab = ({ users, predictions, matches, currentUser }) => {
  const leaderboard = useMemo(() => {
    const scores = {};
    users.filter(u => docEdition(u) === EDITION && u.uid !== EDITION_ADMIN_ID).forEach(u => {
      scores[u.uid] = { uid: u.uid, displayName: u.displayName || 'Anonymous', points: 0, exactMatches: 0, correctResults: 0 };
    });

    predictions.forEach(pred => {
      if (docEdition(pred) !== EDITION || pred.uid === EDITION_ADMIN_ID) return; // only this edition; admin doesn't compete
      const match = matches.find(m => m.id === pred.matchId);
      if (!match || match.status !== 'finished') return;

      const points = getPoints(pred.homeScore, pred.awayScore, match.homeScore, match.awayScore);
      
      if (!scores[pred.uid]) {
        scores[pred.uid] = { uid: pred.uid, displayName: 'Anonymous', points: 0, exactMatches: 0, correctResults: 0 };
      }
      
      scores[pred.uid].points += points;
      if (points === POINTS_EXACT_TOTAL) scores[pred.uid].exactMatches += 1;
      else if (points === POINTS_CORRECT_RESULT) scores[pred.uid].correctResults += 1;
    });

    return Object.values(scores).sort((a, b) => b.points - a.points);
  }, [users, predictions, matches]);

  const getRankStyle = (index) => {
    switch(index) {
      case 0: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 1: return 'bg-slate-200 text-slate-700 border-slate-300';
      case 2: return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  return (
    <div className="pb-8 animate-in fade-in duration-500">
       <div className="mb-8 text-center sm:text-left">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">{T.standingsTitle}</h2>
        <p className="text-slate-500 text-sm font-medium">{T.standingsSubtitle}</p>
      </div>
      
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-0">
            {leaderboard.length === 0 && (
              <div className="p-10 text-center text-slate-500 font-medium">{T.noPoints}</div>
            )}
            
            {leaderboard.map((u, i) => (
              <div key={u.uid} className={`flex items-center p-4 border-b border-slate-100 last:border-b-0 transition-colors ${u.uid === currentUser.uid ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                
                {/* Rank Badge */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border shadow-sm shrink-0 ${getRankStyle(i)}`}>
                  {i < 3 ? <Medal size={18} className={i===0?'text-yellow-600':i===1?'text-slate-500':'text-orange-600'} /> : `#${i + 1}`}
                </div>

                {/* User Info */}
                <div className="ml-4 flex-1">
                  <div className="font-bold text-slate-800 text-base flex items-center gap-2">
                    {u.displayName}
                    {u.uid === currentUser.uid && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-indigo-100 text-indigo-700 tracking-wider">{T.you}</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 font-medium hidden sm:block">
                     {T.exactScores(u.exactMatches)} • {T.correctResults(u.correctResults)}
                  </div>
                </div>

                {/* Points */}
                <div className="text-right ml-4">
                   <div className="font-black text-indigo-600 text-xl">{u.points}</div>
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{T.pts}</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

const ProfileTab = ({ user, onLogout }) => (
   <div className="max-w-md mx-auto pt-4 animate-in slide-in-from-bottom-4 duration-500">
     <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-10"></div>

        <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border-4 border-white relative z-10">
          <User size={40} className="text-indigo-600" />
        </div>

        <h2 className="text-2xl font-extrabold text-slate-800 mb-1 relative z-10">{user.displayName}</h2>
        <p className="text-slate-500 text-sm mb-8 font-medium relative z-10">{T.profileNote}</p>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-8 text-left flex items-center gap-3">
           <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 shrink-0"><Info size={18} /></div>
           <p className="text-xs text-slate-600 font-medium leading-relaxed">{T.profileInfo}</p>
        </div>

        <button onClick={onLogout} className="bg-slate-900 hover:bg-black text-white px-4 py-4 rounded-2xl w-full font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2">
           <LogOut size={18} /> {T.logOut}
        </button>
     </div>
   </div>
);

const RulesTab = () => (
  <div className="max-w-md mx-auto pt-4 animate-in slide-in-from-bottom-4 duration-500">
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
      <h2 className="text-2xl font-extrabold text-slate-800 mb-8 flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Info size={24} /></div>
        {T.scoringRules}
      </h2>
      
      <div className="space-y-8">
        <div className="flex items-start gap-5">
          <div className="bg-indigo-50 text-indigo-600 font-black px-4 py-2 rounded-xl text-xl border border-indigo-100 shadow-sm">{POINTS_CORRECT_RESULT}</div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">{T.correctResultTitle}</h3>
            <p className="text-sm text-slate-500 mt-1 font-medium leading-relaxed">{T.correctResultBody(POINTS_CORRECT_RESULT)}</p>
          </div>
        </div>

        <div className="flex items-start gap-5">
          <div className="bg-yellow-50 text-yellow-600 font-black px-4 py-2 rounded-xl text-xl border border-yellow-200 shadow-sm">+{POINTS_EXACT_BONUS}</div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">{T.exactBonusTitle}</h3>
            <p className="text-sm text-slate-500 mt-1 font-medium leading-relaxed">{T.exactBonusBodyPre(POINTS_EXACT_BONUS)}<span className="font-bold text-slate-700">{T.exactBonusBodyTotal(POINTS_EXACT_TOTAL)}</span>{T.exactBonusBodyPost}</p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 mt-4 space-y-4">
          <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl">
             <Lock size={20} className="text-slate-400 shrink-0 mt-0.5" />
             <p className="text-sm text-slate-600 font-medium">{T.ruleLock}</p>
          </div>
          <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl">
             <Trophy size={20} className="text-slate-400 shrink-0 mt-0.5" />
             <p className="text-sm text-slate-600 font-medium">{T.ruleBoard}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const AdminPanel = ({ matches, users, predictions, globalSettings }) => {
  const [newHome, setNewHome] = useState('');
  const [newAway, setNewAway] = useState('');
  const [newStage, setNewStage] = useState('Group Stage');
  const [newTime, setNewTime] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [selectedUser, setSelectedUser] = useState('');
  const [selectedMatch, setSelectedMatch] = useState('');
  const [editHome, setEditHome] = useState('');
  const [editAway, setEditAway] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);


  useEffect(() => {
    if (selectedUser && selectedMatch) {
      const p = predictions.find(p => p.uid === selectedUser && p.matchId === selectedMatch);
      setEditHome(p?.homeScore ?? '');
      setEditAway(p?.awayScore ?? '');
    } else {
      setEditHome('');
      setEditAway('');
    }
  }, [selectedUser, selectedMatch, predictions]);

  const handleToggleLocks = async () => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global'), {
      disableLocks: !globalSettings?.disableLocks
    }, { merge: true });
  };

  const handleAdminSavePrediction = async () => {
    if (!selectedUser || !selectedMatch) return;
    setIsSavingEdit(true);
    const predRef = doc(db, 'artifacts', appId, 'public', 'data', 'predictions', `${selectedUser}_${selectedMatch}`);
    await setDoc(predRef, { uid: selectedUser, matchId: selectedMatch, homeScore: editHome, awayScore: editAway, edition: editionOfUid(selectedUser), updatedAt: new Date().toISOString() }, { merge: true });
    setIsSavingEdit(false);
  };

  const handleScoreUpdate = async (matchId, hScore, aScore, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', matchId), { homeScore: hScore, awayScore: aScore, status });
  }

  // Updates ONLY the kickoff time. The match keeps its document id, so every
  // prediction attached to it stays linked — nothing is erased.
  const handleTimeUpdate = async (matchId, iso) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', matchId), { startTime: iso });
  }

  const handleAddMatch = async (e) => {
    e.preventDefault();
    if (!newHome || !newAway || !newTime) return;
    setIsAdding(true);
    const newMatchRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'matches'));
    await setDoc(newMatchRef, {
       id: newMatchRef.id, homeTeam: newHome, awayTeam: newAway, stage: newStage,
       startTime: new Date(newTime).toISOString(), homeScore: null, awayScore: null, status: 'scheduled'
    });
    setNewHome(''); setNewAway(''); setNewTime(''); setIsAdding(false);
  }

  const handleDeleteMatch = async (matchId) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', matchId));
    setConfirmDelete(null);
  };

  return (
    <div className="pb-8 animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 p-6 rounded-3xl text-white shadow-lg">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><ShieldAlert size={20} className="text-red-400" /> {T.adminTitle}</h2>
          <p className="text-slate-400 text-xs mt-1 font-medium">{T.adminSubtitle}</p>
        </div>
        <button
           onClick={handleToggleLocks}
           className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center gap-2 ${globalSettings?.disableLocks ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
        >
           {globalSettings?.disableLocks ? <><Lock size={16}/> {T.reEnableLocks}</> : <><Lock size={16} className="opacity-50"/> {T.unlockAll}</>}
        </button>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6 space-y-4">
         <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">{T.editEntries}</h3>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
           <div>
             <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{T.selectUser}</label>
             <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
               <option value="">{T.chooseUser}</option>
               {users.map(u => <option key={u.uid} value={u.uid}>{(u.displayName || 'Anonymous')} ({docEdition(u).toUpperCase()})</option>)}
             </select>
           </div>
           <div>
             <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{T.selectMatch}</label>
             <select value={selectedMatch} onChange={e=>setSelectedMatch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
               <option value="">{T.chooseMatch}</option>
               {matches.map(m => <option key={m.id} value={m.id}>{m.homeTeam} vs {m.awayTeam}</option>)}
             </select>
           </div>
         </div>
         {selectedUser && selectedMatch && (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 mt-4 bg-slate-100/50 p-4 rounded-2xl border border-slate-200">
               <span className="text-sm font-bold text-slate-600">{T.modifyPrediction}</span>
               <input type="number" min="0" value={editHome} onChange={e=>setEditHome(e.target.value)} className="w-16 border border-slate-300 rounded-lg p-2 text-center font-bold bg-white" placeholder="-" />
               <span className="font-bold text-slate-400">-</span>
               <input type="number" min="0" value={editAway} onChange={e=>setEditAway(e.target.value)} className="w-16 border border-slate-300 rounded-lg p-2 text-center font-bold bg-white" placeholder="-" />
               <button onClick={handleAdminSavePrediction} disabled={isSavingEdit} className="w-full sm:w-auto sm:ml-auto bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-6 rounded-xl transition-colors">
                 {isSavingEdit ? T.saving : T.forceSave}
               </button>
            </div>
         )}
      </div>
      
      <form onSubmit={handleAddMatch} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-8 space-y-4">
        <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3">{T.createMatch}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{T.homeTeam}</label>
            <input type="text" value={newHome} onChange={e=>setNewHome(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder={T.egHome} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{T.awayTeam}</label>
            <input type="text" value={newAway} onChange={e=>setNewAway(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder={T.egAway} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{T.stageLabel}</label>
            <input type="text" value={newStage} onChange={e=>setNewStage(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder={T.egStage} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{T.startTimeLocal}</label>
            <input type="datetime-local" value={newTime} onChange={e=>setNewTime(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
        </div>
        <button type="submit" disabled={isAdding} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl w-full transition-all shadow-md mt-4">
          {isAdding ? T.addingMatch : T.addMatch}
        </button>
      </form>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-sm">{T.matchDatabase}</div>
        {matches.map(m => (
          <div key={m.id} className="border-b border-slate-100 last:border-b-0 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 flex items-center gap-3 text-sm font-bold text-slate-800 whitespace-nowrap w-full">
              {confirmDelete === m.id ? (
                <div className="flex items-center gap-2 mr-2 bg-red-50 p-1.5 rounded-lg border border-red-100">
                  <span className="text-xs text-red-600 font-bold px-1">{T.deleteQ}</span>
                  <button onClick={() => handleDeleteMatch(m.id)} className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-md hover:bg-red-600 transition-colors">{T.yes}</button>
                  <button onClick={() => setConfirmDelete(null)} className="bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-md hover:bg-slate-300 transition-colors">{T.no}</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(m.id)} className="text-slate-300 hover:text-red-500 transition-colors bg-slate-50 p-2 rounded-lg">
                  <Trash2 size={16} />
                </button>
              )}
              <span className="flex items-center gap-1.5 truncate">
                {getFlag(m.homeTeam)} {m.homeTeam} <span className="text-slate-400 font-normal mx-1">vs</span> {getFlag(m.awayTeam)} {m.awayTeam}
              </span>
            </div>
            
            <AdminMatchRow match={m} onUpdate={handleScoreUpdate} onUpdateTime={handleTimeUpdate} />
          </div>
        ))}
      </div>
    </div>
  )
}

const AdminMatchRow = ({ match, onUpdate, onUpdateTime }) => {
  const [h, setH] = useState(match.homeScore ?? '');
  const [a, setA] = useState(match.awayScore ?? '');
  const [t, setT] = useState(toLocalInput(match.startTime));
  const [savedTime, setSavedTime] = useState(false);

  const saveTime = async () => {
    if (!t) return;
    await onUpdateTime(match.id, new Date(t).toISOString());
    setSavedTime(true);
    setTimeout(() => setSavedTime(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2 w-full sm:w-auto bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl">
      {/* Score row */}
      <div className="flex gap-2 items-center justify-between sm:justify-end">
        <div className="flex items-center gap-1">
          <input type="number" value={h} onChange={e=>setH(e.target.value)} className="w-12 h-10 border border-slate-300 rounded-lg text-center font-bold focus:border-indigo-500 outline-none" placeholder="-" />
          <span className="font-bold text-slate-400 px-1">:</span>
          <input type="number" value={a} onChange={e=>setA(e.target.value)} className="w-12 h-10 border border-slate-300 rounded-lg text-center font-bold focus:border-indigo-500 outline-none" placeholder="-" />
        </div>
        <div className="flex gap-2 ml-4">
           <button onClick={() => onUpdate(match.id, h, a, 'finished')} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2.5 rounded-lg shadow-sm transition-colors">{T.setFinal}</button>
           <button onClick={() => onUpdate(match.id, null, null, 'scheduled')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-lg transition-colors">{T.reset}</button>
        </div>
      </div>
      {/* Kickoff time row */}
      <div className="flex gap-2 items-center justify-between sm:justify-end">
        <input type="datetime-local" value={t} onChange={e=>setT(e.target.value)} className="h-10 border border-slate-300 rounded-lg px-2 text-xs font-medium focus:border-indigo-500 outline-none bg-white" />
        <button onClick={saveTime} className={`text-xs font-bold px-3 py-2.5 rounded-lg transition-colors ${savedTime ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-800 hover:bg-slate-900 text-white'}`}>
          {savedTime ? T.savedTime : T.saveTime}
        </button>
      </div>
    </div>
  )
}


// --- Everyone's Picks (read-only) ---
// Shows every player's prediction per match. To keep the game fair, a player's
// pick for a match is only revealed once it can no longer be changed — i.e.
// the match has kicked off (with locks on) or is finished. Until then, only
// the viewer sees their own pick. This page never writes any data.
const AllPicksTab = ({ matches, predictions, users, currentUser, disableLocks }) => {
  const nameFor = (uid) => users.find(u => u.uid === uid)?.displayName || 'Player';
  const picksFor = (matchId) => predictions.filter(p => p.matchId === matchId && docEdition(p) === EDITION && p.uid !== EDITION_ADMIN_ID);

  // Match the Pitch page ordering exactly: "Live & Upcoming" first (soonest
  // kickoff first), then "Finished" (most recently finished first). The
  // `matches` array arrives sorted ascending by start time, so we mirror it.
  const upcoming = matches.filter(m => m.status !== 'finished');
  const finished = matches.filter(m => m.status === 'finished').reverse();

  const renderMatchCard = (m) => {
    const isFinished = m.status === 'finished';
    const rows = picksFor(m.id).map(p => ({
      uid: p.uid,
      name: nameFor(p.uid),
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      points: isFinished ? getPoints(p.homeScore, p.awayScore, m.homeScore, m.awayScore) : null,
    }));
    if (isFinished) rows.sort((a, b) => b.points - a.points);
    else rows.sort((a, b) => a.name.localeCompare(b.name));

    return (
      <div key={m.id} className="bg-white border border-slate-200 rounded-3xl p-5 mb-6">
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <CalendarDays size={14} className="text-slate-400" /> {m.stage}
          </span>
          {isFinished ? (
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-800"><CheckCircle size={14} /> {T.fullTime}</span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-gray-200 text-gray-600"><Lock size={14} /> {T.locked}</span>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mb-5">
          <span className="font-extrabold text-slate-800 text-sm sm:text-base text-right flex-1 truncate">{getFlag(m.homeTeam)} {m.homeTeam}</span>
          <span className={`px-3 py-1 rounded-lg text-sm font-black shrink-0 ${isFinished ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
            {isFinished ? `${m.homeScore} - ${m.awayScore}` : 'vs'}
          </span>
          <span className="font-extrabold text-slate-800 text-sm sm:text-base text-left flex-1 truncate">{m.awayTeam} {getFlag(m.awayTeam)}</span>
        </div>

        {rows.length === 0 ? (
          <p className="text-center text-sm text-slate-400 italic py-3">{T.noPredForMatch}</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map(r => (
              <div key={r.uid} className={`flex items-center justify-between rounded-xl px-3 py-2 ${r.uid === currentUser.uid ? 'bg-indigo-50' : 'bg-slate-50'}`}>
                <span className="font-bold text-slate-700 text-sm flex items-center gap-2 truncate min-w-0">
                  <span className="truncate">{r.name}</span>
                  {r.uid === currentUser.uid && <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-indigo-100 text-indigo-700 tracking-wider shrink-0">{T.you}</span>}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-black text-slate-800 text-sm tabular-nums">{r.homeScore}–{r.awayScore}</span>
                  {isFinished && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${r.points > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>
                      {r.points > 0 ? `+${r.points}` : '0'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="pb-8 animate-in fade-in duration-500">
      <div className="mb-8 text-center sm:text-left">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">{T.picksTitle}</h2>
        <p className="text-slate-500 text-sm font-medium">{T.picksSubtitle}</p>
      </div>

      {matches.length === 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center text-slate-500 font-medium mb-8">
          {T.noMatches}
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span> {T.liveUpcoming}
          </h3>
          {upcoming.map(renderMatchCard)}
        </div>
      )}

      {finished.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 mt-10">
            <span className="w-2 h-2 rounded-full bg-slate-300"></span> {T.finishedMatches}
          </h3>
          {finished.map(renderMatchCard)}
        </div>
      )}
    </div>
  );
};


// --- Login / Register Screen (name + PIN) ---
const LoginScreen = ({ onLogin, busy }) => {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    const cleanName = name.trim();
    if (slugify(cleanName).length === 0) { setError(T.errEnterName); return; }
    if (!/^\d{4}$/.test(pin)) { setError(T.errPin); return; }
    const result = await onLogin(cleanName, pin);
    if (result && !result.ok) setError(result.error);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 shadow-inner mb-4">
            <Trophy size={32} className="text-yellow-400" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">WC Predictor <span className="text-indigo-300 font-light">{T.appTitleSuffix}</span></h1>
          <p className="text-indigo-200 text-sm font-medium mt-3 leading-relaxed">{T.loginSubtitle}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-7 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{T.yourName}</label>
            <input
              type="text" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
              placeholder={T.egName}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{T.pinLabel}</label>
            <input
              type="password" inputMode="numeric" maxLength={4} value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-bold text-slate-800 tracking-[0.6em] text-center focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
              placeholder="••••"
            />
          </div>

          {error && (
            <div className="text-sm font-bold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>
          )}

          <button
            onClick={submit} disabled={busy}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-4 rounded-2xl w-full transition-all shadow-lg shadow-indigo-600/30 active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {busy ? <span className="animate-pulse">{T.connecting}</span> : <><KeyRound size={18} /> {T.enterPool}</>}
          </button>

          <p className="text-xs text-slate-400 text-center font-medium leading-relaxed">
            {T.loginFooterNew}<br />{T.loginFooterReturn}
          </p>
        </div>
      </div>
    </div>
  );
};


// --- Main Application ---
export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [activeAccountId, setActiveAccountId] = useState(() => {
    try { return localStorage.getItem(ACCOUNT_STORAGE_KEY) || null; } catch { return null; }
  });
  const [loginBusy, setLoginBusy] = useState(false);
  const [activeTab, setActiveTab] = useState('matches');
  
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [users, setUsers] = useState([]);
  const [globalSettings, setGlobalSettings] = useState({ disableLocks: false });
  const [isLoading, setIsLoading] = useState(true);
  const [appError, setAppError] = useState(null); 

  useEffect(() => {
    // Let Firebase restore any saved session FIRST. Only sign in anonymously
    // if there genuinely is no existing user. This stops the app from minting
    // a brand-new anonymous account (and a new leaderboard entry) on every
    // visit, so returning players keep their identity and predictions.
    const unsubscribe = onAuthStateChanged(auth, async (existingUser) => {
      if (existingUser) {
        setFirebaseUser(existingUser);
        return;
      }
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
        // onAuthStateChanged fires again automatically with the new user.
      } catch (err) {
        setAppError(T.authFailed(err.message));
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    let unsubs = [];
    try {
      const matchesRef = collection(db, 'artifacts', appId, 'public', 'data', 'matches');
      unsubs.push(onSnapshot(matchesRef, (snap) => {
        const data = [];
        snap.forEach(d => data.push(d.data()));
        // Matches are entered manually by the admin. Whatever exists is shown,
        // sorted by kickoff; an empty schedule simply shows nothing until the
        // admin adds matches (no auto-population).
        setMatches(data.sort((a,b) => new Date(a.startTime) - new Date(b.startTime)));
      }, err => { setAppError(T.dbDenied(err.message)); setIsLoading(false); }));

      const predsRef = collection(db, 'artifacts', appId, 'public', 'data', 'predictions');
      unsubs.push(onSnapshot(predsRef, (snap) => {
        const data = [];
        snap.forEach(d => data.push(d.data()));
        setPredictions(data);
      }));

      const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
      unsubs.push(onSnapshot(usersRef, (snap) => {
        const data = [];
        snap.forEach(d => data.push(d.data()));
        setUsers(data);
        setIsLoading(false); 
      }, err => { setAppError(T.dbDenied(err.message)); setIsLoading(false); }));

      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');
      unsubs.push(onSnapshot(settingsRef, (snap) => {
        if (snap.exists()) setGlobalSettings(snap.data());
      }));

    } catch (error) {
      setAppError(T.setupError(error.message));
      setIsLoading(false);
    }
    return () => unsubs.forEach(unsub => unsub());
  }, [firebaseUser]);

  const handleSavePrediction = async (matchId, hScore, aScore) => {
     if (!activeAccountId) return;
     const predRef = doc(db, 'artifacts', appId, 'public', 'data', 'predictions', `${activeAccountId}_${matchId}`);
     await setDoc(predRef, {
        uid: activeAccountId, matchId, homeScore: hScore, awayScore: aScore, edition: EDITION, updatedAt: new Date().toISOString()
     }, { merge: true });
  };

  const handleLogin = async (rawName, pin) => {
     if (!firebaseUser) return { ok: false, error: T.stillConnecting };
     setLoginBusy(true);
     try {
        const displayName = rawName.trim();
        const accountId = EDITION_PREFIX + slugify(displayName);
        const pinHash = await hashPin(pin, accountId);
        const accountRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', accountId);
        const existing = await getDoc(accountRef);
        if (existing.exists()) {
           if (existing.data().pinHash !== pinHash) {
              return { ok: false, error: T.nameTaken };
           }
        } else {
           await setDoc(accountRef, { uid: accountId, displayName, pinHash, edition: EDITION, createdAt: new Date().toISOString() });
        }
        try { localStorage.setItem(ACCOUNT_STORAGE_KEY, accountId); } catch { /* storage blocked */ }
        setActiveAccountId(accountId);
        return { ok: true };
     } catch (err) {
        return { ok: false, error: T.loginFailed(err.message) };
     } finally {
        setLoginBusy(false);
     }
  };

  const handleLogout = () => {
     try { localStorage.removeItem(ACCOUNT_STORAGE_KEY); } catch { /* storage blocked */ }
     setActiveAccountId(null);
     setActiveTab('matches');
  };

  if (appError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="bg-white p-8 rounded-3xl max-w-lg border border-red-100 shadow-xl shadow-red-100/50">
          <ShieldAlert size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-extrabold text-slate-800 mb-2">{T.configError}</h2>
          <p className="text-sm text-slate-600 font-medium mb-6">{appError}</p>
        </div>
      </div>
    );
  }

  const spinner = (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
       <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
       <div className="text-indigo-900 font-bold tracking-widest uppercase text-sm animate-pulse">{T.spinner}</div>
    </div>
  );

  if (!firebaseUser) return spinner;
  if (!activeAccountId) return <LoginScreen onLogin={handleLogin} busy={loginBusy} />;
  if (isLoading) return spinner;

  const currentUserDoc = users.find(u => u.uid === activeAccountId);
  const displayName = currentUserDoc?.displayName || 'Player';
  const user = { uid: activeAccountId, displayName };
  const isAdmin = activeAccountId === EDITION_ADMIN_ID;

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-200 text-slate-800">
      {/* Premium Header */}
      <header className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-purple-900 text-white sticky top-0 z-30 shadow-lg shadow-indigo-900/20 pb-4 pt-safe sm:pt-4 px-4 rounded-b-3xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjIiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-30"></div>
        <div className="max-w-2xl mx-auto flex justify-between items-center relative z-10 pt-2">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md p-2 rounded-xl border border-white/20 shadow-inner">
              <Trophy size={22} className="text-yellow-400" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-tight">WC Predictor <span className="text-indigo-300 font-light">{T.appTitleSuffix}</span></h1>
            </div>
          </div>
          <div onClick={() => setActiveTab('profile')} className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border border-white/10 cursor-pointer transition-colors">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            {displayName}
          </div>
        </div>
      </header>
      
      {/* Main Viewport */}
      <main className="max-w-2xl mx-auto p-4 sm:p-6 pb-32">
         {activeTab === 'matches' && <MatchesTab matches={matches} predictions={predictions} user={user} onSavePrediction={handleSavePrediction} disableLocks={globalSettings?.disableLocks} />}
         {activeTab === 'leaderboard' && <LeaderboardTab users={users} predictions={predictions} matches={matches} currentUser={user} />}
         {activeTab === 'picks' && <AllPicksTab matches={matches} predictions={predictions} users={users} currentUser={user} disableLocks={globalSettings?.disableLocks} />}
         {activeTab === 'rules' && <RulesTab />}
         {activeTab === 'admin' && isAdmin && <AdminPanel matches={matches} users={users} predictions={predictions} globalSettings={globalSettings} />}
         {activeTab === 'profile' && <ProfileTab user={user} onLogout={handleLogout} />}
      </main>
      
      {/* Glassmorphism Bottom Nav */}
      <nav className="fixed bottom-0 w-full z-40 px-4 pb-safe pt-2 pointer-events-none">
         <div className="max-w-md mx-auto bg-white/80 backdrop-blur-xl border border-white shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)] rounded-t-3xl sm:rounded-full sm:mb-6 flex justify-around p-2 pointer-events-auto">
            <NavButton icon={<Activity size={22}/>} label={T.nav.predict} active={activeTab === 'matches'} onClick={()=>setActiveTab('matches')} />
            <NavButton icon={<Trophy size={22}/>} label={T.nav.standings} active={activeTab === 'leaderboard'} onClick={()=>setActiveTab('leaderboard')} />
            <NavButton icon={<Users size={22}/>} label={T.nav.picks} active={activeTab === 'picks'} onClick={()=>setActiveTab('picks')} />
            <NavButton icon={<Info size={22}/>} label={T.nav.rules} active={activeTab === 'rules'} onClick={()=>setActiveTab('rules')} />
            <NavButton icon={<User size={22}/>} label={T.nav.profile} active={activeTab === 'profile'} onClick={()=>setActiveTab('profile')} />
            {isAdmin && <NavButton icon={<Settings size={22}/>} label={T.nav.admin} active={activeTab === 'admin'} onClick={()=>setActiveTab('admin')} />}
         </div>
      </nav>
    </div>
  );
}

const NavButton = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick} 
    className={`relative flex flex-col items-center justify-center flex-1 min-w-0 max-w-[72px] h-14 rounded-2xl transition-all duration-300 ${active ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
  >
    {active && <div className="absolute inset-0 bg-indigo-50 rounded-2xl -z-10"></div>}
    {icon}
    <span className={`text-[10px] mt-1 font-bold ${active ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>{label}</span>
  </button>
);