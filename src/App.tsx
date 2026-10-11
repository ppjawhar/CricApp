import { useEffect, useMemo, useState } from "react";
import AuthProvider, { useAuth } from "./auth/AuthProvider";
import { addClubPlayer, createClub, deleteClub, getClub, listClubs, updateClub, updateClubPlayer, type Club, type ClubPlayer } from "./lib/clubsApi";
import { listMatches, type CricketMatch } from "./lib/matchesApi";
import { loadActiveMatch, saveActiveMatch } from "./lib/supabaseApi";
import MatchSetup from "./matches/MatchSetup";
import ScoringPage from "./matches/ScoringPage";

type IconName =
  | "home"
  | "clubs"
  | "matches"
  | "user"
  | "bell"
  | "arrow"
  | "play"
  | "bolt"
  | "shield"
  | "sync"
  | "plus"
  | "chevron"
  | "back"
  | "more"
  | "undo"
  | "wifi"
  | "search"
  | "users"
  | "pin"
  | "calendar"
  | "settings";

const iconPaths: Record<IconName, React.ReactNode> = {
  home: <><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /><path d="M9 20v-6h6v6" /></>,
  clubs: <><circle cx="9" cy="8" r="4" /><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 4a4 4 0 0 1 0 8M17 15a6 6 0 0 1 4 6" /></>,
  matches: <><rect x="4" y="3" width="16" height="18" rx="3" /><path d="M8 2v3M16 2v3M4 9h16M8 13h3M8 17h6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  arrow: <><path d="M5 12h14M14 7l5 5-5 5" /></>,
  play: <path d="m9 7 8 5-8 5Z" />,
  bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7Z" />,
  shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z" /><path d="m9 12 2 2 4-5" /></>,
  sync: <><path d="M20 7h-5V2" /><path d="M20 7a8 8 0 1 0 1 8" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  back: <path d="m15 18-6-6 6-6" />,
  more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  undo: <><path d="M9 7 4 12l5 5" /><path d="M5 12h8a6 6 0 0 1 6 6" /></>,
  wifi: <><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" /><circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
  users: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="3" /><path d="M2 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 8 4" /></>,
  pin: <><path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" /><circle cx="12" cy="10" r="2" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7-.7-2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7Z" /></>,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

function Button({ children, className = "", onClick, ariaLabel, disabled = false }: { children: React.ReactNode; className?: string; onClick?: () => void; ariaLabel?: string; disabled?: boolean }) {
  return <button type="button" className={className} onClick={onClick} aria-label={ariaLabel} disabled={disabled}>{children}</button>;
}

function Avatar({ initials, tone = "dark" }: { initials: string; tone?: "dark" | "green" | "cream" }) {
  return <span className={`avatar avatar-${tone}`}>{initials}</span>;
}

type Tab = "Home" | "Clubs" | "Matches" | "Profile";
type Delivery = { label: string; runs: number; wicket?: boolean };
type SyncStatus = "loading" | "syncing" | "synced" | "local";

const PHOTO = "https://images.unsplash.com/photo-1779488399581-19bcffd19520?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200";

export default function App() {
  return <AuthProvider><AuthenticatedApp /></AuthProvider>;
}

function AuthenticatedApp() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("Home");
  const [scoring, setScoring] = useState(false);
  const [setupEntry, setSetupEntry] = useState<"quick" | "club" | null>(null);
  const [setupClub, setSetupClub] = useState<Club | undefined>();
  const [currentMatch, setCurrentMatch] = useState<CricketMatch | null>(null);
  const [runs, setRuns] = useState(84);
  const [wickets, setWickets] = useState(3);
  const [balls, setBalls] = useState(57);
  const [dataReady, setDataReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [deliveries, setDeliveries] = useState<Delivery[]>([
    { label: "1", runs: 1 }, { label: "•", runs: 0 }, { label: "4", runs: 4 }, { label: "2", runs: 2 }, { label: "W", runs: 0, wicket: true },
  ]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;

    async function restoreMatch() {
      const scoreKey = `cricapp-score:${user.id}`;
      const saved = localStorage.getItem(scoreKey);
      if (saved) {
        try {
          const state = JSON.parse(saved);
          setRuns(state.runs ?? 84);
          setWickets(state.wickets ?? 3);
          setBalls(state.balls ?? 57);
          if (Array.isArray(state.deliveries)) setDeliveries(state.deliveries);
        } catch {
          localStorage.removeItem(scoreKey);
        }
      }

      try {
        const remote = await loadActiveMatch();
        if (active && remote) {
          setRuns(remote.runs);
          setWickets(remote.wickets);
          setBalls(remote.balls);
          setDeliveries(remote.deliveries);
        }
        if (active) setSyncStatus("synced");
      } catch {
        if (active) setSyncStatus("local");
      } finally {
        if (active) setDataReady(true);
      }
    }

    restoreMatch();
    return () => {
      active = false;
    };
  }, [user.id]);

  useEffect(() => {
    if (!dataReady) return;

    const state = { runs, wickets, balls, deliveries };
    localStorage.setItem(`cricapp-score:${user.id}`, JSON.stringify(state));
    setSyncStatus("syncing");

    const timer = window.setTimeout(async () => {
      try {
        await saveActiveMatch(state);
        setSyncStatus("synced");
      } catch {
        setSyncStatus("local");
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [runs, wickets, balls, deliveries, dataReady, user.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const overs = `${Math.floor(balls / 6)}.${balls % 6}`;
  const projected = useMemo(() => Math.round((runs / Math.max(balls, 1)) * 120), [runs, balls]);

  function addDelivery(value: number | "W" | "WD") {
    if (value === "W") {
      setWickets((current) => Math.min(current + 1, 10));
      setBalls((current) => current + 1);
      setDeliveries((current) => [...current.slice(-5), { label: "W", runs: 0, wicket: true }]);
    } else if (value === "WD") {
      setRuns((current) => current + 1);
      setDeliveries((current) => [...current.slice(-5), { label: "WD", runs: 1 }]);
    } else {
      setRuns((current) => current + value);
      setBalls((current) => current + 1);
      setDeliveries((current) => [...current.slice(-5), { label: value === 0 ? "•" : String(value), runs: value }]);
    }
    setToast("Saved on this device");
  }

  function undoDelivery() {
    const last = deliveries[deliveries.length - 1];
    if (!last) return;
    setRuns((current) => Math.max(0, current - last.runs));
    if (last.wicket) setWickets((current) => Math.max(0, current - 1));
    if (last.label !== "WD") setBalls((current) => Math.max(0, current - 1));
    setDeliveries((current) => current.slice(0, -1));
    setToast("Last delivery undone");
  }

  function startQuick() {
    setSetupClub(undefined);
    setSetupEntry("quick");
  }

  function startClubMatch(club: Club) {
    setSetupClub(club);
    setSetupEntry("club");
  }

  function beginCreatedMatch(match: CricketMatch) {
    setCurrentMatch(match);
    setRuns(0);
    setWickets(0);
    setBalls(0);
    setDeliveries([]);
    setSetupEntry(null);
    setScoring(true);
  }

  if (setupEntry) {
    return <MatchSetup entry={setupEntry} club={setupClub} onCancel={() => setSetupEntry(null)} onCreated={beginCreatedMatch} />;
  }

  if (scoring && currentMatch) {
    return <ScoringPage match={currentMatch} onExit={() => setScoring(false)} onComplete={() => { setScoring(false); setTab("Matches"); }} />;
  }

  if (scoring) {
    const firstBattingId = currentMatch
      ? currentMatch.toss.decision === "bat"
        ? currentMatch.toss.winnerId
        : currentMatch.toss.winnerId === "team-a" ? "team-b" : "team-a"
      : "team-a";
    const battingTeam = currentMatch?.teams.find((team) => team.id === firstBattingId);
    const teamA = currentMatch?.teams[0]?.name || "Northside CC";
    const teamB = currentMatch?.teams[1]?.name || "Park XI";
    return (
      <main className="app-shell scoring-shell">
        <header className="score-header">
          <Button className="icon-button dark-button" onClick={() => setScoring(false)} ariaLabel="Back to home"><Icon name="back" /></Button>
          <div className="score-head-copy">
            <span className="eyebrow light">LIVE · 1ST INNINGS</span>
            <strong>{teamA} vs {teamB}</strong>
          </div>
          <Button className="icon-button dark-button" ariaLabel="More match options"><Icon name="more" /></Button>
        </header>

        <section className="scoreboard">
          <div className="sync-line"><span className="live-dot" /> Live scoring <span>·</span> <Icon name="wifi" size={15} /> {syncStatus === "synced" ? "Synced" : syncStatus === "syncing" ? "Sync pending" : syncStatus === "loading" ? "Restoring" : "Saved on this device"}</div>
          <div className="score-main">
            <div><span className="team-label">{(battingTeam?.name || teamA).toUpperCase()}</span><div className="giant-score">{runs}<small>/{wickets}</small></div></div>
            <div className="overs-block"><strong>{overs}</strong><span>OVERS</span></div>
          </div>
          <div className="target-row"><span>Run rate <strong>{(runs / Math.max(balls / 6, 1)).toFixed(2)}</strong></span><span>Projected <strong>{projected}</strong></span></div>
        </section>

        <section className="players-panel">
          <div className="player-line"><div><span className="strike-mark">*</span><strong>Arjun Mehta</strong><small>STRIKER</small></div><div className="player-stat"><strong>36</strong><small>28 BALLS</small></div></div>
          <div className="player-line muted-line"><div><span className="strike-mark empty" /><strong>Sam Wilson</strong><small>NON-STRIKER</small></div><div className="player-stat"><strong>18</strong><small>14 BALLS</small></div></div>
          <div className="bowler-line"><span>Bowler</span><strong>M. Ali</strong><span>2.3–0–17–1</span></div>
        </section>

        <section className="recent-strip">
          <span className="eyebrow">THIS OVER</span>
          <div className="ball-list">{deliveries.map((ball, index) => <span key={`${ball.label}-${index}`} className={`ball ${ball.wicket ? "wicket-ball" : ""}`}>{ball.label}</span>)}</div>
          <span className="over-runs">{deliveries.reduce((sum, ball) => sum + ball.runs, 0)} runs</span>
        </section>

        <section className="controls-panel">
          <div className="controls-title"><div><span className="eyebrow">ADD DELIVERY</span><strong>Runs off the bat</strong></div><Button className="undo-button" onClick={undoDelivery}><Icon name="undo" size={18} /> Undo</Button></div>
          <div className="run-grid">
            {[0, 1, 2, 3, 4, 6].map((value) => <Button key={value} className="run-button" onClick={() => addDelivery(value)}>{value}</Button>)}
          </div>
          <div className="event-grid">
            <Button className="event-button" onClick={() => addDelivery("WD")}><span className="event-icon">WD</span><span><strong>Extras</strong><small>Wide, no-ball, byes</small></span><Icon name="chevron" /></Button>
            <Button className="event-button wicket-event" onClick={() => addDelivery("W")}><span className="event-icon">W</span><span><strong>Wicket</strong><small>Select dismissal</small></span><Icon name="chevron" /></Button>
          </div>
        </section>
        {toast && <div className="toast"><Icon name="shield" size={17} />{toast}</div>}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><span /><i /></span>
          <strong>CricApp</strong>
        </div>
        <div className="top-actions">
          <Button className="icon-button" ariaLabel="Notifications"><Icon name="bell" /></Button>
          <Button className="avatar-button" onClick={() => setTab("Profile")} ariaLabel="Open profile"><Avatar initials={getInitials(user.user_metadata.full_name, user.email)} tone="green" /></Button>
        </div>
      </header>

      {tab === "Home" && <Home runs={runs} wickets={wickets} overs={overs} onResume={() => setScoring(true)} onQuick={startQuick} onClub={() => setTab("Clubs")} />}
      {tab === "Clubs" && <Clubs onStart={startClubMatch} />}
      {tab === "Matches" && <Matches onResume={(match) => { setCurrentMatch(match); setScoring(true); }} onCreateQuick={startQuick} onCreateClub={startClubMatch} />}
      {tab === "Profile" && <Profile name={user.user_metadata.full_name || "CricApp Player"} email={user.email || ""} onSignOut={signOut} />}

      <nav className="bottom-nav" aria-label="Main navigation">
        {(["Home", "Clubs", "Matches", "Profile"] as Tab[]).map((item) => (
          <Button key={item} className={`nav-item ${tab === item ? "active" : ""}`} onClick={() => setTab(item)}>
            <span className="nav-icon"><Icon name={item === "Home" ? "home" : item === "Clubs" ? "clubs" : item === "Matches" ? "matches" : "user"} /></span>
            <span>{item}</span>
          </Button>
        ))}
      </nav>
    </main>
  );
}

function getInitials(name?: string, email?: string) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email?.slice(0, 2).toUpperCase() || "CP";
}

function Home({ runs, wickets, overs, onResume, onQuick, onClub }: { runs: number; wickets: number; overs: string; onResume: () => void; onQuick: () => void; onClub: () => void }) {
  return <div className="page home-page">
    <section className="welcome-row">
      <div><span className="eyebrow">SATURDAY, 11 OCT</span><h1>Ready for the crease?</h1><p>Start a new game or pick up where you left off.</p></div>
      <div className="weather"><span>24°</span><small>Perfect cricket weather</small></div>
    </section>

    <section className="hero-card">
      <img src={PHOTO} alt="Cricketers playing on a green field" />
      <div className="hero-shade" />
      <div className="hero-content">
        <div className="live-pill"><span /> MATCH IN PROGRESS</div>
        <div className="hero-match"><div><span>NORTHSIDE CC</span><strong>{runs}/{wickets}</strong><small>{overs} overs</small></div><div className="versus">VS</div><div className="opponent"><span>PARK XI</span><strong>—</strong><small>Yet to bat</small></div></div>
        <div className="hero-footer"><div><small>Current partnership</small><strong>54 runs · 37 balls</strong></div><Button className="primary-button light-button" onClick={onResume}>Resume scoring <Icon name="arrow" /></Button></div>
      </div>
    </section>

    <section className="section-block">
      <div className="section-heading"><div><span className="eyebrow">NEW MATCH</span><h2>How are you playing?</h2></div></div>
      <div className="action-grid">
        <Button className="action-card green-card" onClick={onQuick}><span className="action-icon"><Icon name="bolt" size={25} /></span><span className="action-copy"><strong>Quick scoring</strong><small>Start in under 2 minutes</small></span><span className="round-arrow"><Icon name="arrow" size={18} /></span></Button>
        <Button className="action-card navy-card" onClick={onClub}><span className="action-icon"><Icon name="shield" size={25} /></span><span className="action-copy"><strong>Club match</strong><small>Use your roster & records</small></span><span className="round-arrow"><Icon name="arrow" size={18} /></span></Button>
      </div>
    </section>

    <section className="section-block">
      <div className="section-heading"><div><span className="eyebrow">YOUR CLUBS</span><h2>Pick up with your team</h2></div><Button className="text-button" onClick={onClub}>View all <Icon name="arrow" size={16} /></Button></div>
      <div className="club-list">
        <Button className="club-row" onClick={onClub}><Avatar initials="NC" tone="dark" /><span className="club-copy"><strong>Northside Cricket Club</strong><small><Icon name="pin" size={14} /> Riverside Oval · 18 players</small></span><span className="club-record"><strong>8–3</strong><small>SEASON</small></span><Icon name="chevron" /></Button>
        <Button className="club-row" onClick={onClub}><Avatar initials="WK" tone="cream" /><span className="club-copy"><strong>Weekend Kings</strong><small><Icon name="pin" size={14} /> East Park · 12 players</small></span><span className="club-record"><strong>5–5</strong><small>SEASON</small></span><Icon name="chevron" /></Button>
      </div>
    </section>

    <section className="section-block recent-section">
      <div className="section-heading"><div><span className="eyebrow">RECENT</span><h2>Last matches</h2></div><Button className="text-button">Match history <Icon name="arrow" size={16} /></Button></div>
      <div className="result-card"><span className="result-badge win">WON</span><div className="result-copy"><strong>Northside CC <span>142/6</span></strong><p>Beat Riverside XI by 18 runs</p><small>4 Oct · Club match</small></div><Icon name="chevron" /></div>
      <div className="result-card"><span className="result-badge loss">LOST</span><div className="result-copy"><strong>Weekend Kings <span>108/9</span></strong><p>Lost to Hillview by 3 wickets</p><small>28 Sep · Club match</small></div><Icon name="chevron" /></div>
    </section>
  </div>;
}

function Clubs({ onStart }: { onStart: (club: Club) => void }) {
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [listMode, setListMode] = useState<"mine" | "browse">("mine");
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [browseClubs, setBrowseClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "roster" | "matches" | "stats">("overview");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubLocation, setClubLocation] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<ClubPlayer | null>(null);
  const [editingClub, setEditingClub] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerNickname, setPlayerNickname] = useState("");
  const [playerRole, setPlayerRole] = useState("all-rounder");
  const [playerStatus, setPlayerStatus] = useState<"active" | "archived">("active");

  useEffect(() => {
    let active = true;
    listClubs()
      .then((result) => {
        if (!active) return;
        setMyClubs(result.myClubs);
        setBrowseClubs(result.browseClubs);
      })
      .catch((reason) => active && setError(reason.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function openClub(club: Club) {
    setSelectedClub(club);
    setView("detail");
    setDetailTab("overview");
    setError("");
    try {
      setSelectedClub(await getClub(club.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load club");
    }
  }

  async function submitClub(event: React.FormEvent) {
    event.preventDefault();
    if (!clubName.trim()) {
      setError("Enter a name for your club.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const club = await createClub({ name: clubName, location: clubLocation });
      setMyClubs((current) => [club, ...current]);
      setBrowseClubs((current) => [club, ...current]);
      setSelectedClub(club);
      setView("detail");
      setClubName("");
      setClubLocation("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create club");
    } finally {
      setSaving(false);
    }
  }

  async function submitPlayer(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedClub || !playerName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const club = editingPlayer
        ? await updateClubPlayer(selectedClub.id, editingPlayer.id, { name: playerName, nickname: playerNickname, role: playerRole, status: playerStatus })
        : await addClubPlayer(selectedClub.id, { name: playerName, nickname: playerNickname, role: playerRole });
      setSelectedClub(club);
      setMyClubs((current) => current.map((item) => item.id === club.id ? club : item));
      setPlayerName("");
      setPlayerNickname("");
      setPlayerRole("all-rounder");
      setPlayerStatus("active");
      setEditingPlayer(null);
      setAddingPlayer(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add player");
    } finally {
      setSaving(false);
    }
  }

  function openAddPlayer() {
    setPlayerName("");
    setPlayerNickname("");
    setPlayerRole("all-rounder");
    setPlayerStatus("active");
    setEditingPlayer(null);
    setError("");
    setAddingPlayer(true);
  }

  function openEditPlayer(player: ClubPlayer) {
    setPlayerName(player.name);
    setPlayerNickname(player.nickname || "");
    setPlayerRole(player.role || "all-rounder");
    setPlayerStatus(player.status);
    setEditingPlayer(player);
    setError("");
    setAddingPlayer(true);
  }

  function openClubSettings() {
    if (!selectedClub) return;
    setEditName(selectedClub.name);
    setEditLocation(selectedClub.location || "");
    setDeleteConfirm("");
    setError("");
    setEditingClub(true);
  }

  async function submitClubUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedClub || !editName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const club = await updateClub(selectedClub.id, { name: editName, location: editLocation });
      setSelectedClub(club);
      setMyClubs((current) => current.map((item) => item.id === club.id ? club : item));
      setBrowseClubs((current) => current.map((item) => item.id === club.id ? { ...club, players: [] } : item));
      setEditingClub(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update club");
    } finally {
      setSaving(false);
    }
  }

  async function confirmClubDeletion() {
    if (!selectedClub || deleteConfirm !== selectedClub.name) return;
    setSaving(true);
    setError("");
    try {
      await deleteClub(selectedClub.id);
      setMyClubs((current) => current.filter((item) => item.id !== selectedClub.id));
      setBrowseClubs((current) => current.filter((item) => item.id !== selectedClub.id));
      setEditingClub(false);
      setSelectedClub(null);
      setView("list");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete club");
    } finally {
      setSaving(false);
    }
  }

  if (view === "create") {
    const previewInitials = clubName.trim() ? clubName.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase() : "CC";
    return <div className="page club-flow-page">
      <Button className="flow-back" onClick={() => { setView("list"); setError(""); }}><Icon name="back" /> Back to clubs</Button>
      <section className="club-flow-head"><span className="eyebrow">NEW CLUB</span><h1>Build your club home</h1><p>Create a shared place for your roster, matches and season records.</p></section>
      <div className="create-club-preview"><Avatar initials={previewInitials} tone="green" /><div><span>YOUR NEW CLUB</span><strong>{clubName.trim() || "Club name"}</strong><small><Icon name="pin" size={13} /> {clubLocation.trim() || "Add a home ground or location"}</small></div></div>
      <form className="club-form" onSubmit={submitClub}>
        <label><span>Club name <i>Required</i></span><input value={clubName} maxLength={80} onChange={(event) => setClubName(event.target.value)} placeholder="e.g. Northside Cricket Club" autoFocus /></label>
        <label><span>Location <i>Optional</i></span><input value={clubLocation} maxLength={120} onChange={(event) => setClubLocation(event.target.value)} placeholder="Home ground, town or city" /></label>
        <div className="form-note"><Icon name="shield" /><p><strong>You’ll be the club admin.</strong><span>You can invite members, manage the roster and appoint organizers later.</span></p></div>
        {error && <div className="club-error">{error}</div>}
        <button className="club-submit" type="submit" disabled={saving}>{saving ? "Creating club…" : "Create club"} {!saving && <span>→</span>}</button>
      </form>
    </div>;
  }

  if (view === "detail" && selectedClub) {
    const canEdit = selectedClub.membership?.role === "admin" || selectedClub.membership?.role === "organizer";
    return <div className="page club-detail-page">
      <div className="detail-actions"><Button className="flow-back" onClick={() => { setView("list"); setError(""); }}><Icon name="back" /> All clubs</Button>{selectedClub.membership?.role === "admin" && <Button className="icon-button" onClick={openClubSettings} ariaLabel="Club settings"><Icon name="settings" /></Button>}</div>
      <section className="club-detail-hero">
        <div className="club-detail-title"><Avatar initials={selectedClub.initials} tone="green" /><div><span className="eyebrow light">{selectedClub.membership?.role?.toUpperCase() || "PUBLIC CLUB"}</span><h1>{selectedClub.name}</h1><p><Icon name="pin" size={14} /> {selectedClub.location || "Location not added"}</p></div></div>
        <div className="club-metrics"><div><strong>{selectedClub.players.length}</strong><span>PLAYERS</span></div><div><strong>{selectedClub.matchCount}</strong><span>MATCHES</span></div><div><strong>{selectedClub.record.wins}–{selectedClub.record.losses}</strong><span>RECORD</span></div></div>
        {selectedClub.joined && <Button className="primary-button light-button wide" onClick={() => onStart(selectedClub)}><Icon name="play" /> Start club match</Button>}
      </section>
      <div className="club-tabs">
        {(["overview", "roster", "matches", "stats"] as const).map((tab) => <Button key={tab} className={detailTab === tab ? "active" : ""} onClick={() => setDetailTab(tab)}>{tab === "roster" ? "Players" : tab}</Button>)}
      </div>
      {error && <div className="club-error detail-error">{error}</div>}

      {detailTab === "overview" && <div className="club-tab-content">
        <section className="detail-section"><div className="section-heading"><div><span className="eyebrow">CLUB SNAPSHOT</span><h2>This season</h2></div></div>
          <div className="snapshot-grid"><div><span className="snapshot-icon green"><Icon name="users" /></span><strong>{selectedClub.players.length}</strong><small>Active players</small></div><div><span className="snapshot-icon cream"><Icon name="matches" /></span><strong>{selectedClub.matchCount}</strong><small>Matches played</small></div></div>
        </section>
        <section className="detail-section"><span className="eyebrow">RECENT ACTIVITY</span><div className="club-empty-inline"><span className="empty-ball" /><div><strong>Your club story starts here</strong><p>Add players and score your first club match.</p></div></div></section>
        {canEdit && <section className="admin-card"><span className="setting-icon"><Icon name="shield" /></span><div><strong>Club admin tools</strong><p>Manage members, invitations and club settings.</p></div><Icon name="chevron" /></section>}
      </div>}

      {detailTab === "roster" && <div className="club-tab-content">
        <div className="section-heading"><div><h2>{selectedClub.players.length} players</h2></div>{canEdit && <Button className="text-button" onClick={openAddPlayer}><Icon name="plus" /> Add player</Button>}</div>
        {selectedClub.players.length === 0 ? <div className="full-empty"><span className="empty-illustration"><Icon name="users" size={29} /></span><h3>No players yet</h3><p>Add your regular players now. They don’t need CricApp accounts.</p>{canEdit && <Button className="primary-button light-button" onClick={openAddPlayer}><Icon name="plus" /> Add first player</Button>}</div> :
          <div className="detail-roster">{selectedClub.players.map((player, index) => <div className={`detail-player ${player.status === "archived" ? "archived-player" : ""}`} key={player.id}><span className="player-number">{String(index + 1).padStart(2, "0")}</span><Avatar initials={getInitials(player.name)} tone="cream" /><div><strong>{player.name}</strong><small>{player.nickname ? `${player.nickname} · ` : ""}{player.role ? player.role.replace("-", " ") : "Player"}{player.status === "archived" ? " · Archived" : ""}</small></div>{canEdit ? <Button className="edit-player-button" onClick={() => openEditPlayer(player)} ariaLabel={`Edit ${player.name}`}><Icon name="settings" size={17} /></Button> : <span className="available-dot" />}</div>)}</div>}
      </div>}

      {detailTab === "matches" && <div className="club-tab-content"><div className="full-empty"><span className="empty-illustration"><Icon name="matches" size={29} /></span><h3>No matches yet</h3><p>Club matches and completed scorecards will appear here.</p>{selectedClub.joined && <Button className="primary-button light-button" onClick={() => onStart(selectedClub)}><Icon name="play" /> Start first match</Button>}</div></div>}
      {detailTab === "stats" && <div className="club-tab-content"><div className="full-empty"><span className="empty-illustration"><Icon name="bolt" size={29} /></span><h3>Stats are warming up</h3><p>Complete a club match to unlock batting and bowling leaders.</p></div></div>}

      {addingPlayer && <div className="sheet-backdrop" onMouseDown={() => setAddingPlayer(false)}><form className="player-sheet" onSubmit={submitPlayer} onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-title"><div><span className="eyebrow">PLAYERS</span><h2>{editingPlayer ? "Update player" : "Add a player"}</h2></div><Button className="sheet-close" onClick={() => { setAddingPlayer(false); setEditingPlayer(null); }}>×</Button></div>
        <label><span>Player name</span><input value={playerName} onChange={(event) => setPlayerName(event.target.value)} placeholder="Full name" autoFocus /></label>
        <label><span>Nickname <i>Optional</i></span><input value={playerNickname} onChange={(event) => setPlayerNickname(event.target.value)} placeholder="What the team calls them" /></label>
        <label><span>Playing role</span><select value={playerRole} onChange={(event) => setPlayerRole(event.target.value)}><option value="batter">Batter</option><option value="bowler">Bowler</option><option value="all-rounder">All-rounder</option><option value="wicketkeeper">Wicketkeeper</option></select></label>
        {editingPlayer && <label><span>Player status</span><select value={playerStatus} onChange={(event) => setPlayerStatus(event.target.value as "active" | "archived")}><option value="active">Active</option><option value="archived">Archived</option></select></label>}
        {error && <div className="club-error">{error}</div>}
        <button className="club-submit" type="submit" disabled={saving || !playerName.trim()}>{saving ? "Saving player…" : editingPlayer ? "Save player changes" : "Add player"} {!saving && <span>→</span>}</button>
      </form></div>}
      {editingClub && <div className="sheet-backdrop settings-backdrop" onMouseDown={() => setEditingClub(false)}><div className="player-sheet club-settings-sheet" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-title"><div><span className="eyebrow">CLUB ADMIN</span><h2>Club settings</h2></div><Button className="sheet-close" onClick={() => setEditingClub(false)}>×</Button></div>
        <form className="settings-form" onSubmit={submitClubUpdate}>
          <label><span>Club name</span><input value={editName} maxLength={80} onChange={(event) => setEditName(event.target.value)} /></label>
          <label><span>Location <i>Optional</i></span><input value={editLocation} maxLength={120} onChange={(event) => setEditLocation(event.target.value)} placeholder="Home ground, town or city" /></label>
          {error && <div className="club-error">{error}</div>}
          <button className="club-submit" type="submit" disabled={saving || !editName.trim()}>{saving ? "Saving changes…" : "Save changes"} {!saving && <span>→</span>}</button>
        </form>
        <section className="danger-zone"><span className="eyebrow">DANGER ZONE</span><h3>Delete this club</h3><p>This permanently removes the club and its roster. Clubs with match history are protected from deletion.</p>
          <label><span>Type <strong>{selectedClub.name}</strong> to confirm</span><input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder={selectedClub.name} /></label>
          <Button className="delete-club-button" onClick={confirmClubDeletion} disabled={saving || deleteConfirm !== selectedClub.name}>{saving ? "Deleting…" : "Delete club permanently"}</Button>
        </section>
      </div></div>}
    </div>;
  }

  const source = listMode === "mine" ? myClubs : browseClubs;
  const filtered = source.filter((club) => `${club.name} ${club.location || ""}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page clubs-page">
    <section className="clubs-title-row"><div className="page-title"><span className="eyebrow">{myClubs.length} MEMBERSHIP{myClubs.length === 1 ? "" : "S"}</span><h1>Your clubs</h1><p>Manage rosters, matches and club records.</p></div><Button className="create-club-button" onClick={() => { setView("create"); setError(""); }}><Icon name="plus" /> Create</Button></section>
    <div className="club-list-tabs"><Button className={listMode === "mine" ? "active" : ""} onClick={() => setListMode("mine")}>My Clubs <span>{myClubs.length}</span></Button><Button className={listMode === "browse" ? "active" : ""} onClick={() => setListMode("browse")}>Browse Clubs</Button></div>
    <label className="club-search"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by club or location" /></label>
    {error && <div className="club-error">{error}<Button onClick={() => window.location.reload()}>Retry</Button></div>}
    {loading ? <div className="club-skeletons"><span /><span /><span /></div> :
      filtered.length === 0 ? <div className="full-empty list-empty"><span className="empty-illustration"><Icon name={search ? "search" : "shield"} size={29} /></span><h3>{search ? "No clubs found" : listMode === "mine" ? "Create your first club" : "No clubs to browse yet"}</h3><p>{search ? "Try another club name or location." : listMode === "mine" ? "Bring your team, roster and match records together." : "New community clubs will appear here."}</p>{!search && listMode === "mine" && <Button className="primary-button light-button" onClick={() => setView("create")}><Icon name="plus" /> Create a club</Button>}</div> :
      <div className="clubs-database-list">{filtered.map((club, index) => <Button className="database-club-card" key={club.id} onClick={() => openClub(club)}><Avatar initials={club.initials} tone={index % 2 ? "cream" : "dark"} /><span className="database-club-copy"><span className="club-card-label">{club.membership?.role || (club.joined ? "member" : "community club")}</span><strong>{club.name}</strong><small><Icon name="pin" size={13} /> {club.location || "Location not added"}</small><span className="club-card-meta"><b><Icon name="users" size={13} /> {club.players.length || club.memberCount} players</b><b>{club.matchCount} matches</b></span></span><Icon name="chevron" /></Button>)}</div>}
  </div>;
}

function Matches({
  onResume,
  onCreateQuick,
  onCreateClub,
}: {
  onResume: (match: CricketMatch) => void;
  onCreateQuick: () => void;
  onCreateClub: (club: Club) => void;
}) {
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [filter, setFilter] = useState<"all" | "ready" | "club" | "quick">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([listMatches(), listClubs()])
      .then(([matchData, clubData]) => {
        if (!active) return;
        setMatches(matchData);
        setClubs(clubData.myClubs);
      })
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "Unable to load matches"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const filteredMatches = matches.filter((match) => {
    if (filter === "ready") return match.status === "ready";
    if (filter === "quick") return match.mode === "quick";
    if (filter === "club") return match.mode !== "quick";
    return true;
  });

  function formatMatchType(mode: CricketMatch["mode"]) {
    if (mode === "club-internal") return "Internal club match";
    if (mode === "club-external") return "External club match";
    return "Quick match";
  }

  return <div className="page matches-page">
    <section className="matches-title-row"><div className="page-title"><span className="eyebrow">MATCH CENTRE</span><h1>Your matches</h1><p>Set up games, resume scoring and revisit scorecards.</p></div><Button className="create-club-button new-match-button" onClick={() => setCreating(true)}><Icon name="plus" /> New match</Button></section>
    <div className="match-summary-strip"><div><strong>{matches.length}</strong><span>TOTAL</span></div><div><strong>{matches.filter((match) => match.status === "ready").length}</strong><span>READY</span></div><div><strong>{matches.filter((match) => match.mode !== "quick").length}</strong><span>CLUB</span></div></div>
    <div className="filter-pills match-filters">
      {(["all", "ready", "club", "quick"] as const).map((item) => <Button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</Button>)}
    </div>
    {error && <div className="club-error">{error}<Button onClick={() => window.location.reload()}>Retry</Button></div>}
    {loading ? <div className="match-skeletons"><span /><span /><span /></div> :
      filteredMatches.length === 0 ? <div className="full-empty matches-empty"><span className="empty-illustration"><Icon name="matches" size={29} /></span><h3>{matches.length ? "No matches in this view" : "Create your first match"}</h3><p>{matches.length ? "Choose another filter to see more matches." : "Set up a Quick Match or use an authorized club roster."}</p>{!matches.length && <Button className="primary-button light-button" onClick={() => setCreating(true)}><Icon name="plus" /> Create a match</Button>}</div> :
      <div className="matches-database-list">{filteredMatches.map((match) => {
        const created = new Date(match.createdAt);
        return <Button className="database-match-card" key={match.id} onClick={() => onResume(match)}>
          <div className="database-match-top"><span className={`match-status-badge ${match.status}`}>{match.status}</span><small>{created.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</small></div>
          <div className="database-versus"><div><Avatar initials={getInitials(match.teams[0].name)} tone="dark" /><strong>{match.teams[0].name}</strong></div><span>VS</span><div><Avatar initials={getInitials(match.teams[1].name)} tone="cream" /><strong>{match.teams[1].name}</strong></div></div>
          <div className="database-match-footer"><span>{formatMatchType(match.mode)} · {match.rules.overs} overs</span><strong>Start scoring <Icon name="arrow" size={15} /></strong></div>
        </Button>;
      })}</div>}

    {creating && <div className="sheet-backdrop" onMouseDown={() => setCreating(false)}><div className="player-sheet match-create-sheet" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><div className="sheet-title"><div><span className="eyebrow">NEW MATCH</span><h2>How are you playing?</h2></div><Button className="sheet-close" onClick={() => setCreating(false)}>×</Button></div>
      <button type="button" className="match-launch-card quick-launch" onClick={onCreateQuick}><span className="launch-icon"><Icon name="bolt" /></span><span><strong>Quick scoring</strong><small>Create two independent teams</small></span><Icon name="arrow" /></button>
      <div className="launch-divider"><span>OR USE A CLUB</span></div>
      {clubs.length === 0 ? <div className="setup-empty"><strong>No authorized clubs</strong><p>Create a club or ask an admin for organizer access.</p></div> :
        <div className="match-club-options">{clubs.map((club) => <button type="button" key={club.id} className="match-launch-card" onClick={() => onCreateClub(club)}><Avatar initials={club.initials} tone="green" /><span><strong>{club.name}</strong><small>Internal or external club match</small></span><Icon name="arrow" /></button>)}</div>}
    </div></div>}
  </div>;
}

function Profile({ name, email, onSignOut }: { name: string; email: string; onSignOut: () => Promise<void> }) {
  return <div className="page">
    <section className="profile-hero"><Avatar initials={getInitials(name, email)} tone="green" /><div><h1>{name}</h1><p>{email}</p><span>PLAYER · ORGANIZER</span></div></section>
    <section className="stats-banner"><div><strong>23</strong><span>MATCHES</span></div><div><strong>486</strong><span>RUNS</span></div><div><strong>17</strong><span>WICKETS</span></div></section>
    <section className="section-block"><span className="eyebrow">ACCOUNT</span><div className="settings-list">
      <div><span className="setting-icon"><Icon name="users" /></span><span><strong>Club memberships</strong><small>2 active clubs</small></span><Icon name="chevron" /></div>
      <div><span className="setting-icon"><Icon name="bell" /></span><span><strong>Notifications</strong><small>Match reminders are on</small></span><Icon name="chevron" /></div>
      <div><span className="setting-icon"><Icon name="sync" /></span><span><strong>Offline & sync</strong><small>All changes are synced</small></span><span className="available-dot" /></div>
      <div><span className="setting-icon"><Icon name="settings" /></span><span><strong>App settings</strong><small>Scoring and appearance</small></span><Icon name="chevron" /></div>
    </div></section>
    <section className="install-card"><span className="install-icon"><Icon name="bolt" /></span><div><strong>Keep CricApp on your home screen</strong><p>Install the app for faster access and reliable offline scoring.</p></div><Button className="small-button">Install</Button></section>
    <Button className="sign-out-button" onClick={onSignOut}>Sign out</Button>
  </div>;
}
