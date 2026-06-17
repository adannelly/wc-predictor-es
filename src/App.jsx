import React, { useState, useEffect, useMemo } from 'react';
import { Trophy, Clock, Lock, CheckCircle, User, Activity, Settings, Info, Trash2, CalendarDays, ShieldAlert, Medal, ChevronRight, LogOut, KeyRound } from 'lucide-react';
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

// --- Identity helpers (name + PIN accounts) ---
// A player's identity is their name, not the browser. The name becomes a
// stable account id so the same person can log in from any device.
const ACCOUNT_STORAGE_KEY = 'wc_account_id';

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

// --- Initial Mock Data ---
const INITIAL_MATCHES = [
  { id: 'm1', stage: 'Group A', homeTeam: 'Mexico', awayTeam: 'South Africa', startTime: '2026-06-11T12:00:00Z', homeScore: 2, awayScore: 0, status: 'finished' },
  { id: 'm2', stage: 'Group A', homeTeam: 'South Korea', awayTeam: 'Czechia', startTime: '2026-06-11T19:00:00Z', homeScore: 2, awayScore: 1, status: 'finished' },
  { id: 'm3', stage: 'Group B', homeTeam: 'Canada', awayTeam: 'Bosnia', startTime: '2026-06-12T12:00:00Z', homeScore: 1, awayScore: 1, status: 'finished' },
  { id: 'm4', stage: 'Group D', homeTeam: 'USA', awayTeam: 'Paraguay', startTime: '2026-06-12T18:00:00Z', homeScore: 4, awayScore: 1, status: 'finished' },
  { id: 'm5', stage: 'Group B', homeTeam: 'Qatar', awayTeam: 'Switzerland', startTime: '2026-06-13T12:00:00Z', homeScore: 1, awayScore: 1, status: 'finished' },
  { id: 'm6', stage: 'Group C', homeTeam: 'Brazil', awayTeam: 'Morocco', startTime: '2026-06-13T15:00:00Z', homeScore: 1, awayScore: 1, status: 'finished' },
  { id: 'm7', stage: 'Group C', homeTeam: 'Scotland', awayTeam: 'Haiti', startTime: '2026-06-13T18:00:00Z', homeScore: 1, awayScore: 0, status: 'finished' },
  { id: 'm8', stage: 'Group D', homeTeam: 'Australia', awayTeam: 'Türkiye', startTime: '2026-06-13T21:00:00Z', homeScore: 2, awayScore: 0, status: 'finished' },
  { id: 'm9', stage: 'Group E', homeTeam: 'Germany', awayTeam: 'Curaçao', startTime: '2026-06-14T12:00:00Z', homeScore: 7, awayScore: 1, status: 'finished' },
  { id: 'm10', stage: 'Group F', homeTeam: 'Netherlands', awayTeam: 'Japan', startTime: '2026-06-14T15:00:00Z', homeScore: 2, awayScore: 2, status: 'finished' },
  { id: 'm11', stage: 'Group E', homeTeam: 'Ivory Coast', awayTeam: 'Ecuador', startTime: '2026-06-14T18:00:00Z', homeScore: 1, awayScore: 0, status: 'finished' },
  { id: 'm12', stage: 'Group F', homeTeam: 'Sweden', awayTeam: 'Tunisia', startTime: '2026-06-14T21:00:00Z', homeScore: 5, awayScore: 1, status: 'finished' },
  { id: 'm13', stage: 'Group H', homeTeam: 'Spain', awayTeam: 'Cape Verde', startTime: '2026-06-15T12:00:00Z', homeScore: 0, awayScore: 0, status: 'finished' },
  { id: 'm14', stage: 'Group G', homeTeam: 'Belgium', awayTeam: 'Egypt', startTime: '2026-06-15T15:00:00Z', homeScore: 1, awayScore: 1, status: 'finished' },
  { id: 'm15', stage: 'Group H', homeTeam: 'Saudi Arabia', awayTeam: 'Uruguay', startTime: '2026-06-15T18:00:00Z', homeScore: 1, awayScore: 1, status: 'finished' },
  { id: 'm16', stage: 'Group G', homeTeam: 'Iran', awayTeam: 'New Zealand', startTime: '2026-06-15T21:00:00Z', homeScore: 2, awayScore: 2, status: 'finished' },
  { id: 'm17', stage: 'Group I', homeTeam: 'France', awayTeam: 'Senegal', startTime: '2026-06-16T15:00:00Z', homeScore: 3, awayScore: 1, status: 'finished' },
  { id: 'm18', stage: 'Group I', homeTeam: 'Iraq', awayTeam: 'Norway', startTime: '2026-06-16T18:00:00Z', homeScore: 1, awayScore: 4, status: 'finished' },
  { id: 'm19', stage: 'Group J', homeTeam: 'Argentina', awayTeam: 'Algeria', startTime: '2026-06-16T21:00:00Z', homeScore: 3, awayScore: 0, status: 'finished' },
  { id: 'm20', stage: 'Group J', homeTeam: 'Austria', awayTeam: 'Jordan', startTime: '2026-06-17T00:00:00Z', homeScore: 3, awayScore: 1, status: 'finished' },
  { id: 'm21', stage: 'Group K', homeTeam: 'Portugal', awayTeam: 'DR Congo', startTime: '2026-06-17T13:00:00Z', homeScore: 1, awayScore: 1, status: 'finished' },
  { id: 'm22', stage: 'Group L', homeTeam: 'England', awayTeam: 'Croatia', startTime: '2026-06-17T20:00:00Z', homeScore: null, awayScore: null, status: 'scheduled' },
  { id: 'm23', stage: 'Group L', homeTeam: 'Ghana', awayTeam: 'Panama', startTime: '2026-06-17T23:00:00Z', homeScore: null, awayScore: null, status: 'scheduled' },
  { id: 'm24', stage: 'Group K', homeTeam: 'Uzbekistan', awayTeam: 'Colombia', startTime: '2026-06-18T02:00:00Z', homeScore: null, awayScore: null, status: 'scheduled' },
  { id: 'k1', stage: 'Round of 32', homeTeam: 'Winner Grp A', awayTeam: '3rd Grp C/E/F', startTime: '2026-06-28T16:00:00Z', homeScore: null, awayScore: null, status: 'scheduled' }
];

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
            <><CheckCircle size={14} /> Full Time</>
          ) : isLocked ? (
            <><Lock size={14} /> Locked</>
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
           {isSaving ? <span className="animate-pulse">Saving...</span> : <>Save Prediction <ChevronRight size={18} /></>}
         </button>
      )}

      {/* Results Area */}
      {isFinished && (
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            Actual Score: 
            <span className="px-3 py-1 bg-slate-800 text-white rounded-lg text-sm tracking-normal">
              {match.homeScore} - {match.awayScore}
            </span>
          </div>
          <div>
            {prediction ? (
              <span className={`flex items-center gap-1.5 text-sm font-bold px-4 py-1.5 rounded-xl shadow-sm ${earnedPoints > 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                {earnedPoints === POINTS_EXACT_TOTAL && <Trophy size={16} className="text-yellow-600" />}
                {earnedPoints > 0 ? `+${earnedPoints} Pts Earned` : '0 Pts Earned'}
              </span>
            ) : (
              <span className="text-sm font-medium text-slate-400 italic px-3 py-1 bg-slate-50 rounded-lg">No prediction</span>
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
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">The Pitch</h2>
        <p className="text-slate-500 text-sm font-medium">Predict final scores before match kick-off to earn points.</p>
      </div>

      {upcoming.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Live & Upcoming
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
            <span className="w-2 h-2 rounded-full bg-slate-300"></span> Finished Matches
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
    users.forEach(u => {
      scores[u.uid] = { uid: u.uid, displayName: u.displayName || 'Anonymous', points: 0, exactMatches: 0, correctResults: 0 };
    });

    predictions.forEach(pred => {
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
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Global Standings</h2>
        <p className="text-slate-500 text-sm font-medium">Rankings update instantly as matches conclude.</p>
      </div>
      
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-0">
            {leaderboard.length === 0 && (
              <div className="p-10 text-center text-slate-500 font-medium">No points awarded yet.</div>
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
                    {u.uid === currentUser.uid && <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-indigo-100 text-indigo-700 tracking-wider">You</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 font-medium hidden sm:block">
                     {u.exactMatches} Exact Score{u.exactMatches !== 1 ? 's' : ''} • {u.correctResults} Correct Result{u.correctResults !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Points */}
                <div className="text-right ml-4">
                   <div className="font-black text-indigo-600 text-xl">{u.points}</div>
                   <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PTS</div>
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
        <p className="text-slate-500 text-sm mb-8 font-medium relative z-10">Signed in. Use the same name and PIN to pick up on any phone or computer.</p>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-8 text-left flex items-center gap-3">
           <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600 shrink-0"><Info size={18} /></div>
           <p className="text-xs text-slate-600 font-medium leading-relaxed">Your predictions and points are tied to this name. Logging in elsewhere with the same name and PIN picks up right where you left off.</p>
        </div>

        <button onClick={onLogout} className="bg-slate-900 hover:bg-black text-white px-4 py-4 rounded-2xl w-full font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2">
           <LogOut size={18} /> Log Out
        </button>
     </div>
   </div>
);

const RulesTab = () => (
  <div className="max-w-md mx-auto pt-4 animate-in slide-in-from-bottom-4 duration-500">
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
      <h2 className="text-2xl font-extrabold text-slate-800 mb-8 flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600"><Info size={24} /></div>
        Scoring Rules
      </h2>
      
      <div className="space-y-8">
        <div className="flex items-start gap-5">
          <div className="bg-indigo-50 text-indigo-600 font-black px-4 py-2 rounded-xl text-xl border border-indigo-100 shadow-sm">{POINTS_CORRECT_RESULT}</div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Correct Result</h3>
            <p className="text-sm text-slate-500 mt-1 font-medium leading-relaxed">Earn {POINTS_CORRECT_RESULT} point if you correctly predict the overall outcome (Win, Draw, or Loss) but miss the exact score.</p>
          </div>
        </div>

        <div className="flex items-start gap-5">
          <div className="bg-yellow-50 text-yellow-600 font-black px-4 py-2 rounded-xl text-xl border border-yellow-200 shadow-sm">+{POINTS_EXACT_BONUS}</div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg">Exact Score Bonus</h3>
            <p className="text-sm text-slate-500 mt-1 font-medium leading-relaxed">Earn {POINTS_EXACT_BONUS} additional points (<span className="font-bold text-slate-700">{POINTS_EXACT_TOTAL} points total</span>) if you nail the exact final score.</p>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6 mt-4 space-y-4">
          <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl">
             <Lock size={20} className="text-slate-400 shrink-0 mt-0.5" />
             <p className="text-sm text-slate-600 font-medium">Predictions lock automatically at the match's scheduled kick-off time.</p>
          </div>
          <div className="flex items-start gap-3 bg-slate-50 p-4 rounded-2xl">
             <Trophy size={20} className="text-slate-400 shrink-0 mt-0.5" />
             <p className="text-sm text-slate-600 font-medium">The leaderboard updates instantly as soon as a final score is recorded.</p>
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
    await setDoc(predRef, { uid: selectedUser, matchId: selectedMatch, homeScore: editHome, awayScore: editAway, updatedAt: new Date().toISOString() }, { merge: true });
    setIsSavingEdit(false);
  };

  const handleScoreUpdate = async (matchId, hScore, aScore, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'matches', matchId), { homeScore: hScore, awayScore: aScore, status });
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
          <h2 className="text-xl font-bold flex items-center gap-2"><ShieldAlert size={20} className="text-red-400" /> Admin Simulator</h2>
          <p className="text-slate-400 text-xs mt-1 font-medium">Input match results & manage data.</p>
        </div>
        <button
           onClick={handleToggleLocks}
           className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm flex items-center gap-2 ${globalSettings?.disableLocks ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-emerald-500 text-white hover:bg-emerald-600'}`}
        >
           {globalSettings?.disableLocks ? <><Lock size={16}/> Re-enable Time Locks</> : <><Lock size={16} className="opacity-50"/> Unlock All Matches</>}
        </button>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6 space-y-4">
         <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">Edit Player Entries</h3>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
           <div>
             <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select User</label>
             <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
               <option value="">-- Choose User --</option>
               {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName || 'Anonymous'}</option>)}
             </select>
           </div>
           <div>
             <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Select Match</label>
             <select value={selectedMatch} onChange={e=>setSelectedMatch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
               <option value="">-- Choose Match --</option>
               {matches.map(m => <option key={m.id} value={m.id}>{m.homeTeam} vs {m.awayTeam}</option>)}
             </select>
           </div>
         </div>
         {selectedUser && selectedMatch && (
            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 mt-4 bg-slate-100/50 p-4 rounded-2xl border border-slate-200">
               <span className="text-sm font-bold text-slate-600">Modify Prediction:</span>
               <input type="number" min="0" value={editHome} onChange={e=>setEditHome(e.target.value)} className="w-16 border border-slate-300 rounded-lg p-2 text-center font-bold bg-white" placeholder="-" />
               <span className="font-bold text-slate-400">-</span>
               <input type="number" min="0" value={editAway} onChange={e=>setEditAway(e.target.value)} className="w-16 border border-slate-300 rounded-lg p-2 text-center font-bold bg-white" placeholder="-" />
               <button onClick={handleAdminSavePrediction} disabled={isSavingEdit} className="w-full sm:w-auto sm:ml-auto bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 px-6 rounded-xl transition-colors">
                 {isSavingEdit ? 'Saving...' : 'Force Save'}
               </button>
            </div>
         )}
      </div>
      
      <form onSubmit={handleAddMatch} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-8 space-y-4">
        <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3">Create Match</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Home Team</label>
            <input type="text" value={newHome} onChange={e=>setNewHome(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. Brazil" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Away Team</label>
            <input type="text" value={newAway} onChange={e=>setNewAway(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. France" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Stage</label>
            <input type="text" value={newStage} onChange={e=>setNewStage(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. Group G" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Start Time (Local)</label>
            <input type="datetime-local" value={newTime} onChange={e=>setNewTime(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
        </div>
        <button type="submit" disabled={isAdding} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl w-full transition-all shadow-md mt-4">
          {isAdding ? 'Adding Match...' : 'Add Match to Schedule'}
        </button>
      </form>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-sm">Match Database</div>
        {matches.map(m => (
          <div key={m.id} className="border-b border-slate-100 last:border-b-0 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex-1 flex items-center gap-3 text-sm font-bold text-slate-800 whitespace-nowrap w-full">
              {confirmDelete === m.id ? (
                <div className="flex items-center gap-2 mr-2 bg-red-50 p-1.5 rounded-lg border border-red-100">
                  <span className="text-xs text-red-600 font-bold px-1">Delete?</span>
                  <button onClick={() => handleDeleteMatch(m.id)} className="bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-md hover:bg-red-600 transition-colors">Yes</button>
                  <button onClick={() => setConfirmDelete(null)} className="bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-md hover:bg-slate-300 transition-colors">No</button>
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
            
            <AdminMatchRow match={m} onUpdate={handleScoreUpdate} />
          </div>
        ))}
      </div>
    </div>
  )
}

const AdminMatchRow = ({ match, onUpdate }) => {
  const [h, setH] = useState(match.homeScore ?? '');
  const [a, setA] = useState(match.awayScore ?? '');
  
  return (
    <div className="flex gap-2 items-center w-full sm:w-auto justify-between sm:justify-end bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl">
      <div className="flex items-center gap-1">
        <input type="number" value={h} onChange={e=>setH(e.target.value)} className="w-12 h-10 border border-slate-300 rounded-lg text-center font-bold focus:border-indigo-500 outline-none" placeholder="-" />
        <span className="font-bold text-slate-400 px-1">:</span>
        <input type="number" value={a} onChange={e=>setA(e.target.value)} className="w-12 h-10 border border-slate-300 rounded-lg text-center font-bold focus:border-indigo-500 outline-none" placeholder="-" />
      </div>
      <div className="flex gap-2 ml-4">
         <button onClick={() => onUpdate(match.id, h, a, 'finished')} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-2.5 rounded-lg shadow-sm transition-colors">Set Final</button>
         <button onClick={() => onUpdate(match.id, null, null, 'scheduled')} className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-lg transition-colors">Reset</button>
      </div>
    </div>
  )
}


// --- Login / Register Screen (name + PIN) ---
const LoginScreen = ({ onLogin, busy }) => {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    const cleanName = name.trim();
    if (slugify(cleanName).length === 0) { setError('Please enter a name using letters or numbers.'); return; }
    if (!/^\d{4}$/.test(pin)) { setError('Your PIN must be exactly 4 digits.'); return; }
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
          <h1 className="text-3xl font-black text-white tracking-tight">WC Predictor <span className="text-indigo-300 font-light">26</span></h1>
          <p className="text-indigo-200 text-sm font-medium mt-3 leading-relaxed">Enter your name and a 4-digit PIN to start. Use the same details to log back in from any device.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-7 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Your Name</label>
            <input
              type="text" value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-bold text-slate-800 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
              placeholder="e.g. Adam"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">4-Digit PIN</label>
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
            {busy ? <span className="animate-pulse">Connecting...</span> : <><KeyRound size={18} /> Enter Pool</>}
          </button>

          <p className="text-xs text-slate-400 text-center font-medium leading-relaxed">
            New name? You'll be registered automatically.<br />Returning? Enter the same name and PIN.
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
        setAppError(`Authentication Failed: ${err.message}`);
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
        if (data.length === 0) {
          const seedMatches = async () => {
             for (const m of INITIAL_MATCHES) await setDoc(doc(matchesRef, m.id), m);
          };
          seedMatches();
        } else {
          setMatches(data.sort((a,b) => new Date(a.startTime) - new Date(b.startTime)));
        }
      }, err => { setAppError(`Database Access Denied: ${err.message}`); setIsLoading(false); }));

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
      }, err => { setAppError(`Database Access Denied: ${err.message}`); setIsLoading(false); }));

      const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'global');
      unsubs.push(onSnapshot(settingsRef, (snap) => {
        if (snap.exists()) setGlobalSettings(snap.data());
      }));

    } catch (error) {
      setAppError(`Unexpected setup error: ${error.message}`);
      setIsLoading(false);
    }
    return () => unsubs.forEach(unsub => unsub());
  }, [firebaseUser]);

  const handleSavePrediction = async (matchId, hScore, aScore) => {
     if (!activeAccountId) return;
     const predRef = doc(db, 'artifacts', appId, 'public', 'data', 'predictions', `${activeAccountId}_${matchId}`);
     await setDoc(predRef, {
        uid: activeAccountId, matchId, homeScore: hScore, awayScore: aScore, updatedAt: new Date().toISOString()
     }, { merge: true });
  };

  const handleLogin = async (rawName, pin) => {
     if (!firebaseUser) return { ok: false, error: 'Still connecting — try again in a moment.' };
     setLoginBusy(true);
     try {
        const displayName = rawName.trim();
        const accountId = slugify(displayName);
        const pinHash = await hashPin(pin, accountId);
        const accountRef = doc(db, 'artifacts', appId, 'public', 'data', 'users', accountId);
        const existing = await getDoc(accountRef);
        if (existing.exists()) {
           if (existing.data().pinHash !== pinHash) {
              return { ok: false, error: 'That name is already taken and the PIN does not match.' };
           }
        } else {
           await setDoc(accountRef, { uid: accountId, displayName, pinHash, createdAt: new Date().toISOString() });
        }
        try { localStorage.setItem(ACCOUNT_STORAGE_KEY, accountId); } catch { /* storage blocked */ }
        setActiveAccountId(accountId);
        return { ok: true };
     } catch (err) {
        return { ok: false, error: `Login failed: ${err.message}` };
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
          <h2 className="text-xl font-extrabold text-slate-800 mb-2">Configuration Error</h2>
          <p className="text-sm text-slate-600 font-medium mb-6">{appError}</p>
        </div>
      </div>
    );
  }

  const spinner = (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
       <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
       <div className="text-indigo-900 font-bold tracking-widest uppercase text-sm animate-pulse">Warming up the pitch...</div>
    </div>
  );

  if (!firebaseUser) return spinner;
  if (!activeAccountId) return <LoginScreen onLogin={handleLogin} busy={loginBusy} />;
  if (isLoading) return spinner;

  const currentUserDoc = users.find(u => u.uid === activeAccountId);
  const displayName = currentUserDoc?.displayName || 'Player';
  const user = { uid: activeAccountId, displayName };

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
              <h1 className="text-xl font-black tracking-tight leading-tight">WC Predictor <span className="text-indigo-300 font-light">26</span></h1>
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
         {activeTab === 'rules' && <RulesTab />}
         {activeTab === 'admin' && <AdminPanel matches={matches} users={users} predictions={predictions} globalSettings={globalSettings} />}
         {activeTab === 'profile' && <ProfileTab user={user} onLogout={handleLogout} />}
      </main>
      
      {/* Glassmorphism Bottom Nav */}
      <nav className="fixed bottom-0 w-full z-40 px-4 pb-safe pt-2 pointer-events-none">
         <div className="max-w-md mx-auto bg-white/80 backdrop-blur-xl border border-white shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.1)] rounded-t-3xl sm:rounded-full sm:mb-6 flex justify-around p-2 pointer-events-auto">
            <NavButton icon={<Activity size={22}/>} label="Predict" active={activeTab === 'matches'} onClick={()=>setActiveTab('matches')} />
            <NavButton icon={<Trophy size={22}/>} label="Standings" active={activeTab === 'leaderboard'} onClick={()=>setActiveTab('leaderboard')} />
            <NavButton icon={<Info size={22}/>} label="Rules" active={activeTab === 'rules'} onClick={()=>setActiveTab('rules')} />
            <NavButton icon={<User size={22}/>} label="Profile" active={activeTab === 'profile'} onClick={()=>setActiveTab('profile')} />
            <NavButton icon={<Settings size={22}/>} label="Admin" active={activeTab === 'admin'} onClick={()=>setActiveTab('admin')} />
         </div>
      </nav>
    </div>
  );
}

const NavButton = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick} 
    className={`relative flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300 ${active ? 'text-indigo-600 scale-105' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
  >
    {active && <div className="absolute inset-0 bg-indigo-50 rounded-2xl -z-10"></div>}
    {icon}
    <span className={`text-[10px] mt-1 font-bold ${active ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>{label}</span>
  </button>
);