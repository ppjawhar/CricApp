import { useEffect, useMemo, useState } from "react";
import type { CricketMatch, MatchPlayer, MatchTeam } from "../lib/matchesApi";

type ExtraType = "wide" | "no-ball" | "bye" | "leg-bye";
type DismissalType = "bowled" | "caught" | "lbw" | "run-out" | "stumped" | "hit-wicket";
type Phase = "live" | "new-batter" | "new-bowler" | "innings-break" | "completed";

type ScoreDelivery = {
  id: string;
  innings: number;
  batterId: string;
  bowlerId: string;
  batRuns: number;
  extraType?: ExtraType;
  extraRuns: number;
  legal: boolean;
  wicket?: { playerId: string; type: DismissalType };
  label: string;
};

type Innings = {
  battingTeamId: MatchTeam["id"];
  runs: number;
  wickets: number;
  legalBalls: number;
  deliveries: ScoreDelivery[];
  dismissed: string[];
};

type ScoreState = {
  innings: Innings[];
  activeInnings: number;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  batterDisplayOrder: [string, string];
  freeHit: boolean;
  phase: Phase;
  result?: string;
  pendingDismissedEnd?: "striker" | "non-striker";
  pendingDismissedPlayerId?: string;
  pendingOverEnd?: boolean;
};

type DraftDelivery = {
  batRuns: number;
  extraType?: ExtraType;
  extraRuns: number;
  wicket?: { playerId: string; type: DismissalType };
  runsSelected?: boolean;
};

const emptyDraft = (): DraftDelivery => ({ batRuns: 0, extraRuns: 0 });

function firstBattingTeam(match: CricketMatch) {
  const battingId = match.toss.decision === "bat"
    ? match.toss.winnerId
    : match.toss.winnerId === "team-a" ? "team-b" : "team-a";
  return match.teams.find((team) => team.id === battingId)!;
}

function initialState(match: CricketMatch): ScoreState {
  const batting = firstBattingTeam(match);
  return {
    innings: [{ battingTeamId: batting.id, runs: 0, wickets: 0, legalBalls: 0, deliveries: [], dismissed: [] }],
    activeInnings: 0,
    strikerId: match.toss.strikerId,
    nonStrikerId: match.toss.nonStrikerId,
    bowlerId: match.toss.bowlerId,
    batterDisplayOrder: [match.toss.strikerId, match.toss.nonStrikerId],
    freeHit: false,
    phase: "live",
  };
}

function playerName(team: MatchTeam, id: string) {
  return team.players.find((player) => player.id === id)?.name || "Select player";
}

export default function ScoringPage({
  match,
  onExit,
  onComplete,
}: {
  match: CricketMatch;
  onExit: () => void;
  onComplete: () => void;
}) {
  const storageKey = `cricapp-match-score:${match.id}`;
  const [state, setState] = useState<ScoreState>(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return initialState(match);
    try {
      const restored = JSON.parse(saved);
      return {
        ...restored,
        batterDisplayOrder: restored.batterDisplayOrder || [restored.strikerId, restored.nonStrikerId],
      };
    } catch {
      return initialState(match);
    }
  });
  const [history, setHistory] = useState<ScoreState[]>([]);
  const [sheet, setSheet] = useState<"wicket" | null>(null);
  const [dismissalType, setDismissalType] = useState<DismissalType>("bowled");
  const [dismissedPlayer, setDismissedPlayer] = useState(state.strikerId);
  const [draft, setDraft] = useState<DraftDelivery>(emptyDraft);
  const [toast, setToast] = useState("");

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state, storageKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const innings = state.innings[state.activeInnings];
  const battingTeam = match.teams.find((team) => team.id === innings.battingTeamId)!;
  const fieldingTeam = match.teams.find((team) => team.id !== innings.battingTeamId)!;
  const target = state.activeInnings === 1 ? state.innings[0].runs + 1 : undefined;
  const wicketLimit = battingTeam.id === "team-a" ? match.rules.wicketLimits.teamA : match.rules.wicketLimits.teamB;
  const ballsRemaining = match.rules.overs * match.rules.ballsPerOver - innings.legalBalls;

  const batterFigures = useMemo(() => {
    const figures = new Map<string, { runs: number; balls: number }>();
    for (const delivery of innings.deliveries) {
      const current = figures.get(delivery.batterId) || { runs: 0, balls: 0 };
      current.runs += delivery.batRuns;
      if (delivery.legal) current.balls += 1;
      figures.set(delivery.batterId, current);
    }
    return figures;
  }, [innings.deliveries]);

  const bowlerFigures = useMemo(() => {
    const deliveries = innings.deliveries.filter((delivery) => delivery.bowlerId === state.bowlerId);
    return {
      balls: deliveries.filter((delivery) => delivery.legal).length,
      runs: deliveries.reduce((sum, delivery) => sum + delivery.batRuns + (delivery.extraType === "bye" || delivery.extraType === "leg-bye" ? 0 : delivery.extraRuns), 0),
      wickets: deliveries.filter((delivery) => delivery.wicket && delivery.wicket.type !== "run-out").length,
    };
  }, [innings.deliveries, state.bowlerId]);

  const thisOver = useMemo(() => {
    const result: ScoreDelivery[] = [];
    for (let index = innings.deliveries.length - 1; index >= 0; index -= 1) {
      if (result.filter((delivery) => delivery.legal).length >= innings.legalBalls % match.rules.ballsPerOver && innings.legalBalls % match.rules.ballsPerOver !== 0) break;
      result.unshift(innings.deliveries[index]);
      if (innings.legalBalls % match.rules.ballsPerOver === 0 && result.some((delivery) => delivery.legal)) {
        const legal = result.filter((delivery) => delivery.legal).length;
        if (legal >= match.rules.ballsPerOver) break;
      }
    }
    return result.slice(-10);
  }, [innings.deliveries, innings.legalBalls, match.rules.ballsPerOver]);

  function pushHistory() {
    setHistory((current) => [...current.slice(-19), structuredClone(state)]);
  }

  function finishSecondInnings(next: ScoreState, successfulChase: boolean) {
    const firstTeam = match.teams.find((team) => team.id === next.innings[0].battingTeamId)!;
    const secondTeam = match.teams.find((team) => team.id === next.innings[1].battingTeamId)!;
    const firstRuns = next.innings[0].runs;
    const second = next.innings[1];
    if (successfulChase) {
      next.result = `${secondTeam.name} won by ${Math.max(0, wicketLimit - second.wickets)} wickets`;
    } else if (second.runs === firstRuns) {
      next.result = "Match tied";
    } else {
      next.result = `${firstTeam.name} won by ${firstRuns - second.runs} runs`;
    }
    next.phase = "completed";
  }

  function addDelivery(input: { batRuns?: number; extraType?: ExtraType; extraRuns?: number; wicket?: { playerId: string; type: DismissalType } }) {
    if (state.phase !== "live") return;
    pushHistory();
    setState((current) => {
      const next = structuredClone(current);
      const active = next.innings[next.activeInnings];
      const batRuns = input.batRuns || 0;
      const extras = input.extraRuns || 0;
      const legal = input.extraType !== "wide" && input.extraType !== "no-ball";
      const total = batRuns + extras;
      const baseLabel = input.extraType === "wide" ? `${extras}Wd` : input.extraType === "no-ball" ? `Nb${batRuns ? `+${batRuns}` : ""}` : input.extraType === "bye" ? `${extras}B` : input.extraType === "leg-bye" ? `${extras}Lb` : batRuns === 0 ? "•" : String(batRuns);
      const label = input.wicket ? `${baseLabel === "•" ? "" : `${baseLabel}+`}W` : baseLabel;
      active.runs += total;
      if (legal) active.legalBalls += 1;
      if (input.wicket) {
        active.wickets += 1;
        active.dismissed.push(input.wicket.playerId);
        next.pendingDismissedEnd = input.wicket.playerId === next.nonStrikerId ? "non-striker" : "striker";
        next.pendingDismissedPlayerId = input.wicket.playerId;
        next.pendingOverEnd = legal && active.legalBalls % match.rules.ballsPerOver === 0;
      }
      active.deliveries.push({
        id: crypto.randomUUID(),
        innings: next.activeInnings,
        batterId: next.strikerId,
        bowlerId: next.bowlerId,
        batRuns,
        extraType: input.extraType,
        extraRuns: extras,
        legal,
        wicket: input.wicket,
        label,
      });

      const completedRuns = input.extraType === "wide"
        ? Math.max(0, extras - match.rules.widePenalty)
        : input.extraType === "no-ball"
          ? batRuns
          : batRuns || extras;
      if (completedRuns % 2 === 1) [next.strikerId, next.nonStrikerId] = [next.nonStrikerId, next.strikerId];
      if (input.extraType === "no-ball" && match.rules.freeHit) next.freeHit = true;
      else if (legal) next.freeHit = false;

      const chaseWon = next.activeInnings === 1 && target !== undefined && active.runs >= target;
      const inningsEnded = active.wickets >= wicketLimit || active.legalBalls >= match.rules.overs * match.rules.ballsPerOver;
      if (chaseWon) {
        finishSecondInnings(next, true);
      } else if (inningsEnded) {
        if (next.activeInnings === 0) next.phase = "innings-break";
        else finishSecondInnings(next, false);
      } else if (input.wicket) {
        const activeBattingTeam = match.teams.find((team) => team.id === active.battingTeamId)!;
        const remaining = activeBattingTeam.players.filter((player) => !active.dismissed.includes(player.id));
        if (match.rules.lastMan && remaining.length === 1) {
          next.strikerId = remaining[0].id;
          next.nonStrikerId = remaining[0].id;
          next.batterDisplayOrder = [remaining[0].id, remaining[0].id];
          next.pendingDismissedEnd = undefined;
          next.pendingDismissedPlayerId = undefined;
          next.pendingOverEnd = false;
          next.phase = legal && active.legalBalls % match.rules.ballsPerOver === 0 ? "new-bowler" : "live";
        } else {
          next.phase = "new-batter";
        }
      } else if (legal && active.legalBalls % match.rules.ballsPerOver === 0) {
        [next.strikerId, next.nonStrikerId] = [next.nonStrikerId, next.strikerId];
        next.phase = "new-bowler";
      }
      return next;
    });
    setSheet(null);
    setToast("Delivery saved on this device");
  }

  function selectRuns(runs: number) {
    setDraft((current) => {
      if (current.extraType === "wide") {
        return { ...current, batRuns: 0, extraRuns: match.rules.widePenalty + runs, runsSelected: true };
      }
      if (current.extraType === "bye" || current.extraType === "leg-bye") {
        return { ...current, batRuns: 0, extraRuns: runs, runsSelected: true };
      }
      return { ...current, batRuns: runs, runsSelected: true };
    });
  }

  function selectDirectExtra(type: ExtraType) {
    setDraft((current) => {
      if (current.extraType === type) {
        const selectedRuns = type === "wide"
          ? Math.max(0, current.extraRuns - match.rules.widePenalty)
          : type === "bye" || type === "leg-bye"
            ? current.extraRuns
            : current.batRuns;
        return { ...current, batRuns: selectedRuns, extraType: undefined, extraRuns: 0 };
      }
      const selectedRuns = current.extraType === "wide"
        ? Math.max(0, current.extraRuns - match.rules.widePenalty)
        : current.extraType === "bye" || current.extraType === "leg-bye"
          ? current.extraRuns
          : current.batRuns;
      return {
        ...current,
        batRuns: type === "wide" || type === "bye" || type === "leg-bye" ? 0 : selectedRuns,
        extraType: type,
        extraRuns: type === "wide"
          ? match.rules.widePenalty + selectedRuns
          : type === "no-ball"
            ? match.rules.noBallPenalty
            : selectedRuns,
      };
    });
  }

  function commitDraft() {
    addDelivery(draft);
    setDraft(emptyDraft());
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setState(previous);
    setHistory((current) => current.slice(0, -1));
    setDraft(emptyDraft());
    setSheet(null);
    setToast("Last delivery undone");
  }

  function handleUndo() {
    if (draft.runsSelected || draft.extraType || draft.wicket) {
      setDraft(emptyDraft());
      setSheet(null);
      setToast("Pending delivery cleared");
      return;
    }
    undo();
  }

  function chooseNewBatter(playerId: string) {
    setState((current) => {
      const next = structuredClone(current);
      if (next.pendingDismissedEnd === "non-striker") next.nonStrikerId = playerId;
      else next.strikerId = playerId;
      const dismissedId = next.pendingDismissedPlayerId;
      next.batterDisplayOrder = (next.batterDisplayOrder || [next.strikerId, next.nonStrikerId]).map((id) => id === dismissedId ? playerId : id) as [string, string];
      next.pendingDismissedEnd = undefined;
      next.pendingDismissedPlayerId = undefined;
      if (next.pendingOverEnd) {
        [next.strikerId, next.nonStrikerId] = [next.nonStrikerId, next.strikerId];
        next.pendingOverEnd = false;
        next.phase = "new-bowler";
      } else {
        next.phase = "live";
      }
      return next;
    });
  }

  function chooseBowler(playerId: string) {
    setState((current) => ({ ...current, bowlerId: playerId, phase: "live" }));
  }

  function startSecondInnings(strikerId: string, nonStrikerId: string, bowlerId: string) {
    const secondBatting = fieldingTeam;
    setHistory([]);
    setState((current) => ({
      ...current,
      innings: [...current.innings, { battingTeamId: secondBatting.id, runs: 0, wickets: 0, legalBalls: 0, deliveries: [], dismissed: [] }],
      activeInnings: 1,
      strikerId,
      nonStrikerId,
      bowlerId,
      batterDisplayOrder: [strikerId, nonStrikerId],
      freeHit: false,
      phase: "live",
    }));
  }

  if (state.phase === "completed") {
    return <main className="full-score-shell score-complete-page"><section className="score-complete-hero"><span>MATCH COMPLETE</span><h1>{state.result}</h1><p>{match.teams[0].name} vs {match.teams[1].name}</p></section><div className="final-innings-list">{state.innings.map((item, index) => { const team = match.teams.find((entry) => entry.id === item.battingTeamId)!; return <div key={team.id}><span>{index + 1}</span><strong>{team.name}</strong><b>{item.runs}/{item.wickets}</b><small>{Math.floor(item.legalBalls / match.rules.ballsPerOver)}.{item.legalBalls % match.rules.ballsPerOver} ov</small></div>; })}</div><button type="button" className="score-primary-action" onClick={onComplete}>View match list</button></main>;
  }

  if (state.phase === "innings-break") {
    const secondBatting = fieldingTeam;
    const secondFielding = battingTeam;
    return <SecondInningsSetup batting={secondBatting} fielding={secondFielding} target={innings.runs + 1} onBack={onExit} onStart={startSecondInnings} />;
  }

  const displayedBatters = state.batterDisplayOrder || [state.strikerId, state.nonStrikerId];
  const availableBatters = battingTeam.players.filter((player) => !innings.dismissed.includes(player.id) && player.id !== state.strikerId && player.id !== state.nonStrikerId);
  const draftIsLegal = draft.extraType !== "wide" && draft.extraType !== "no-ball";
  const nextCompletesOver = draftIsLegal && (innings.legalBalls + 1) % match.rules.ballsPerOver === 0;
  const draftRuns = draft.batRuns + draft.extraRuns;
  const hasDraftSelection = Boolean(draft.runsSelected || draft.extraType || draft.wicket);
  const pendingDeliveryNumber = `${Math.floor(innings.legalBalls / match.rules.ballsPerOver)}.${innings.legalBalls % match.rules.ballsPerOver + 1}`;
  const selectedRunValue = !draft.runsSelected
    ? null
    : draft.extraType === "wide"
      ? Math.max(0, draft.extraRuns - match.rules.widePenalty)
      : draft.extraType === "bye" || draft.extraType === "leg-bye"
        ? draft.extraRuns
        : draft.batRuns;
  const draftDescription = [
    draft.extraType ? draft.extraType.replace("-", " ") : draft.batRuns ? `${draft.batRuns} bat run${draft.batRuns === 1 ? "" : "s"}` : "dot ball",
    draft.wicket ? `${draft.wicket.type.replace("-", " ")} wicket` : "",
  ].filter(Boolean).join(" + ");

  return <main className="full-score-shell">
    <header className="live-score-header"><button type="button" onClick={onExit}>←</button><div><span>LIVE · {state.activeInnings === 0 ? "1ST" : "2ND"} INNINGS</span><strong>{match.teams[0].name} vs {match.teams[1].name}</strong></div><button type="button" onClick={onExit}>Pause</button></header>
    <section className="live-scoreboard">
      <div className="score-status"><span className="live-dot" /> Saved on this device {state.freeHit && <b>FREE HIT</b>}</div>
      <div className="live-score-main"><div><span>{battingTeam.name.toUpperCase()}</span><strong>{innings.runs}<small>/{innings.wickets}</small></strong></div><div><b>{Math.floor(innings.legalBalls / match.rules.ballsPerOver)}.{innings.legalBalls % match.rules.ballsPerOver}</b><span>OVERS</span></div></div>
      <div className="score-context">{target ? <><span>Target <strong>{target}</strong></span><span>Need <strong>{Math.max(0, target - innings.runs)}</strong> from <strong>{ballsRemaining}</strong></span></> : <><span>Run rate <strong>{innings.legalBalls ? (innings.runs * match.rules.ballsPerOver / innings.legalBalls).toFixed(2) : "0.00"}</strong></span><span>{match.rules.overs} over match</span></>}</div>
    </section>
    <section className="live-player-panel">
      {displayedBatters.filter((id, index) => index === 0 || id !== displayedBatters[0]).map((batterId) => { const figures = batterFigures.get(batterId) || { runs: 0, balls: 0 }; const onStrike = batterId === state.strikerId; return <div key={batterId}><span className={onStrike ? "on-strike" : ""}>{onStrike ? "*" : ""}</span><p><strong>{playerName(battingTeam, batterId)}</strong><small>{onStrike ? "STRIKER" : "NON-STRIKER"}</small></p><b>{figures.runs}<small>{figures.balls} balls</small></b></div>; })}
      <footer><span>Bowler</span><strong>{playerName(fieldingTeam, state.bowlerId)}</strong><span>{Math.floor(bowlerFigures.balls / match.rules.ballsPerOver)}.{bowlerFigures.balls % match.rules.ballsPerOver}–{bowlerFigures.runs}–{bowlerFigures.wickets}</span></footer>
    </section>
    <section className="live-over-strip"><span>THIS OVER</span><div>{thisOver.length ? thisOver.map((delivery) => <i key={delivery.id} className={delivery.wicket ? "wicket" : ""}>{delivery.label}</i>) : <small>First ball of the over</small>}</div></section>
    <section className="live-controls">
      <div className="live-control-head"><div><span>ADD DELIVERY</span><strong>{draft.extraType === "wide" ? "Additional wide runs" : draft.extraType === "bye" ? "Completed bye runs" : draft.extraType === "leg-bye" ? "Completed leg-bye runs" : "Runs off the bat"}</strong></div><button type="button" onClick={handleUndo} disabled={!history.length && !hasDraftSelection}>↶ Undo</button></div>
      <div className="live-run-grid">{[0, 1, 2, 3, 4, 6].map((run) => <button type="button" key={run} className={selectedRunValue === run ? "selected" : ""} onClick={() => selectRuns(run)}>{run}</button>)}</div>
      <div className="delivery-option-grid">
        <button type="button" className={draft.extraType === "wide" ? "selected" : ""} onClick={() => selectDirectExtra("wide")}><span>WD</span><strong>Wide</strong></button>
        <button type="button" className={draft.extraType === "no-ball" ? "selected" : ""} onClick={() => selectDirectExtra("no-ball")}><span>NB</span><strong>No ball</strong></button>
        <button type="button" className={draft.extraType === "bye" ? "selected" : ""} onClick={() => selectDirectExtra("bye")}><span>B</span><strong>Bye</strong></button>
        <button type="button" className={draft.extraType === "leg-bye" ? "selected" : ""} onClick={() => selectDirectExtra("leg-bye")}><span>LB</span><strong>Leg bye</strong></button>
        <button type="button" className={`wicket ${draft.wicket ? "selected" : ""}`} onClick={() => { const restricted = state.freeHit || draft.extraType === "no-ball"; setDismissedPlayer(state.strikerId); setDismissalType(restricted ? "run-out" : draft.wicket?.type || "bowled"); setSheet("wicket"); }}><span>W</span><strong>Wicket</strong></button>
      </div>
      <div className="delivery-draft"><div><span>DELIVERY: {pendingDeliveryNumber}</span><strong>{hasDraftSelection ? draftDescription : "–"}</strong><small>{hasDraftSelection ? `${draftRuns} run${draftRuns === 1 ? "" : "s"} · ${draftIsLegal ? "legal ball" : "does not count in over"}` : "–"}</small></div></div>
      <button type="button" className="next-delivery-button" onClick={commitDraft}><span>{nextCompletesOver ? "Save & Next over" : "Save & Next ball"}</span><b>→</b></button>
    </section>

    {sheet === "wicket" && <div className="score-sheet-backdrop" onMouseDown={() => setSheet(null)}><div className="score-sheet" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle" /><h2>Record wicket</h2><p>Run-out keeps the runs and extras already selected. Other dismissals record a zero-run wicket.</p><label><span>Dismissed player</span><select value={dismissedPlayer} onChange={(event) => setDismissedPlayer(event.target.value)}><option value={state.strikerId}>{playerName(battingTeam, state.strikerId)}</option><option value={state.nonStrikerId}>{playerName(battingTeam, state.nonStrikerId)}</option></select></label><label><span>Dismissal</span><select value={dismissalType} onChange={(event) => setDismissalType(event.target.value as DismissalType)}>{((state.freeHit || draft.extraType === "no-ball") ? ["run-out"] : ["bowled", "caught", "lbw", "run-out", "stumped", "hit-wicket"]).map((type) => <option key={type} value={type}>{type.replace("-", " ")}</option>)}</select></label><button type="button" className="score-primary-action danger" onClick={() => { setDraft((current) => dismissalType === "run-out" ? { ...current, wicket: { playerId: dismissedPlayer, type: dismissalType } } : { batRuns: 0, extraRuns: 0, wicket: { playerId: dismissedPlayer, type: dismissalType } }); setSheet(null); }}>Add wicket to delivery</button></div></div>}
    {state.phase === "new-batter" && <SelectionSheet title="Choose the next batter" subtitle={`${innings.wickets} wicket${innings.wickets === 1 ? "" : "s"} down`} players={availableBatters} onSelect={chooseNewBatter} />}
    {state.phase === "new-bowler" && <SelectionSheet title="Choose the next bowler" subtitle={`Over ${Math.floor(innings.legalBalls / match.rules.ballsPerOver) + 1}`} players={fieldingTeam.players.filter((player) => player.id !== state.bowlerId || fieldingTeam.players.length === 1)} onSelect={chooseBowler} />}
    {toast && <div className="score-toast">{toast}</div>}
  </main>;
}

function SelectionSheet({ title, subtitle, players, onSelect }: { title: string; subtitle: string; players: MatchPlayer[]; onSelect: (id: string) => void }) {
  return <div className="score-sheet-backdrop locked"><div className="score-sheet"><div className="sheet-handle" /><span className="score-sheet-kicker">{subtitle}</span><h2>{title}</h2><div className="score-player-choices">{players.map((player) => <button type="button" key={player.id} onClick={() => onSelect(player.id)}><span>{player.name.slice(0, 2).toUpperCase()}</span><strong>{player.name}</strong><b>›</b></button>)}</div></div></div>;
}

function SecondInningsSetup({ batting, fielding, target, onBack, onStart }: { batting: MatchTeam; fielding: MatchTeam; target: number; onBack: () => void; onStart: (striker: string, nonStriker: string, bowler: string) => void }) {
  const [striker, setStriker] = useState(batting.players[0]?.id || "");
  const [nonStriker, setNonStriker] = useState(batting.players[1]?.id || "");
  const [bowler, setBowler] = useState(fielding.players[0]?.id || "");
  const valid = striker && nonStriker && striker !== nonStriker && bowler;
  return <main className="full-score-shell innings-break-page"><header><button type="button" onClick={onBack}>←</button><span>INNINGS BREAK</span></header><section className="break-target"><span>TARGET</span><strong>{target}</strong><p>{batting.name} need {target} runs to win</p></section><section className="break-summary"><div><strong>Second innings</strong><p>Choose the opening players before play resumes.</p></div><label><span>Striker</span><select value={striker} onChange={(event) => setStriker(event.target.value)}>{batting.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><label><span>Non-striker</span><select value={nonStriker} onChange={(event) => setNonStriker(event.target.value)}>{batting.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><label><span>Opening bowler</span><select value={bowler} onChange={(event) => setBowler(event.target.value)}>{fielding.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><button type="button" className="score-primary-action" disabled={!valid} onClick={() => onStart(striker, nonStriker, bowler)}>Start second innings</button></section></main>;
}
