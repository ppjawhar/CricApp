import { useEffect, useMemo, useState } from "react";
import type { Club } from "../lib/clubsApi";
import { createMatch, type CricketMatch, type MatchPlayer, type MatchTeam } from "../lib/matchesApi";
import { createId } from "../lib/id";
import PageHeader from "../components/PageHeader";

type SetupStep = "type" | "teams" | "rules" | "toss" | "review" | "openers";

function namedTemporaryPlayers(prefix: string, names: string[]): MatchPlayer[] {
  return names.map((name, index) => ({
    id: createId(),
    name: name.trim() || `${prefix} Player ${index + 1}`,
    source: "temporary" as const,
  }));
}

export default function MatchSetup({
  entry,
  club,
  template,
  onCancel,
  onCreated,
}: {
  entry: "quick" | "club";
  club?: Club;
  template?: CricketMatch;
  onCancel: () => void;
  onCreated: (match: CricketMatch) => void;
}) {
  const draftKey = `cricapp-setup:${entry}:${club?.id || "quick"}:${template?.id || "new"}`;
  const savedDraft = useMemo(() => { try { return JSON.parse(localStorage.getItem(draftKey) || "null") || {}; } catch { return {}; } }, [draftKey]);
  const [step, setStep] = useState<SetupStep>(savedDraft.step || (template ? "toss" : entry === "club" ? "type" : "teams"));
  const [mode, setMode] = useState<CricketMatch["mode"]>(savedDraft.mode || template?.mode || (entry === "quick" ? "quick" : "club-internal"));
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>(savedDraft.selectedPlayers || []);
  const [manualAssignments, setManualAssignments] = useState<Record<string, "team-a" | "team-b">>(savedDraft.manualAssignments || {});
  const [teamAName, setTeamAName] = useState(savedDraft.teamAName || template?.teams[0].name || (entry === "quick" ? "Team A" : "Northside"));
  const [teamBName, setTeamBName] = useState(savedDraft.teamBName || template?.teams[1].name || (entry === "quick" ? "Team B" : "Southside"));
  const [teamACount, setTeamACount] = useState(savedDraft.teamACount || template?.teams[0].players.length || 6);
  const [teamBCount, setTeamBCount] = useState(savedDraft.teamBCount || template?.teams[1].players.length || 6);
  const [teamAPlayerNames, setTeamAPlayerNames] = useState<string[]>(savedDraft.teamAPlayerNames || template?.teams[0].players.map((player) => player.name) || Array.from({ length: 6 }, (_, index) => `A Player ${index + 1}`));
  const [teamBPlayerNames, setTeamBPlayerNames] = useState<string[]>(savedDraft.teamBPlayerNames || template?.teams[1].players.map((player) => player.name) || Array.from({ length: 6 }, (_, index) => `B Player ${index + 1}`));
  const [opponentName, setOpponentName] = useState(savedDraft.opponentName || "Opponent Team");
  const [opponentCount, setOpponentCount] = useState(savedDraft.opponentCount || 6);
  const [opponentPlayerNames, setOpponentPlayerNames] = useState<string[]>(savedDraft.opponentPlayerNames || Array.from({ length: 6 }, (_, index) => `Opponent Player ${index + 1}`));
  const [teams, setTeams] = useState<[MatchTeam, MatchTeam] | null>(savedDraft.teams || template?.teams || null);
  const [overs, setOvers] = useState(savedDraft.overs || template?.rules.overs || 10);
  const [ballsPerOver, setBallsPerOver] = useState(savedDraft.ballsPerOver || template?.rules.ballsPerOver || 6);
  const [widePenalty, setWidePenalty] = useState(savedDraft.widePenalty ?? template?.rules.widePenalty ?? 1);
  const [noBallPenalty, setNoBallPenalty] = useState(savedDraft.noBallPenalty ?? template?.rules.noBallPenalty ?? 1);
  const [freeHit, setFreeHit] = useState(savedDraft.freeHit ?? template?.rules.freeHit ?? true);
  const [lastMan, setLastMan] = useState(savedDraft.lastMan ?? template?.rules.lastMan ?? false);
  const [wicketLimitA, setWicketLimitA] = useState(savedDraft.wicketLimitA || template?.rules.wicketLimits.teamA || 0);
  const [wicketLimitB, setWicketLimitB] = useState(savedDraft.wicketLimitB || template?.rules.wicketLimits.teamB || 0);
  const [venue, setVenue] = useState(savedDraft.venue ?? template?.rules.venue ?? club?.location ?? "");
  const [scheduledDate, setScheduledDate] = useState(savedDraft.scheduledDate || new Date().toISOString().slice(0, 10));
  const [tossMethod, setTossMethod] = useState<"physical" | "in-app">(savedDraft.tossMethod || "in-app");
  const [tossWinner, setTossWinner] = useState<"team-a" | "team-b" | "">(savedDraft.tossWinner || "");
  const [tossing, setTossing] = useState(false);
  const [decision, setDecision] = useState<"bat" | "bowl">(savedDraft.decision || "bat");
  const [striker, setStriker] = useState(savedDraft.striker || "");
  const [nonStriker, setNonStriker] = useState(savedDraft.nonStriker || "");
  const [bowler, setBowler] = useState(savedDraft.bowler || "");
  const [scorerId, setScorerId] = useState(
    savedDraft.scorerId ||
      template?.scoringOwnerId ||
      club?.members?.find((member) => member.role === "admin")?.userId ||
      club?.createdBy ||
      "",
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const activeRoster = useMemo(() => club?.players.filter((player) => player.status === "active") ?? [], [club]);
  const steps: SetupStep[] = entry === "club" ? ["type", "teams", "rules", "toss", "review", "openers"] : ["teams", "rules", "toss", "review", "openers"];
  const stepIndex = steps.indexOf(step);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify({ step, mode, selectedPlayers, manualAssignments, teamAName, teamBName, teamACount, teamBCount, teamAPlayerNames, teamBPlayerNames, opponentName, opponentCount, opponentPlayerNames, teams, overs, ballsPerOver, widePenalty, noBallPenalty, freeHit, lastMan, wicketLimitA, wicketLimitB, venue, scheduledDate, tossMethod, tossWinner, decision, striker, nonStriker, bowler, scorerId }));
  }, [draftKey, step, mode, selectedPlayers, manualAssignments, teamAName, teamBName, teamACount, teamBCount, teamAPlayerNames, teamBPlayerNames, opponentName, opponentCount, opponentPlayerNames, teams, overs, ballsPerOver, widePenalty, noBallPenalty, freeHit, lastMan, wicketLimitA, wicketLimitB, venue, scheduledDate, tossMethod, tossWinner, decision, striker, nonStriker, bowler, scorerId]);

  function chooseType(nextMode: CricketMatch["mode"]) {
    setMode(nextMode);
    setSelectedPlayers([]);
    setTeamAName(nextMode === "club-internal" ? `${club?.name || "Club"} A` : club?.name || "Club Team");
    setTeamBName(nextMode === "club-internal" ? `${club?.name || "Club"} B` : "Opponent Team");
    setStep("teams");
    setError("");
  }

  function togglePlayer(id: string) {
    const removing = selectedPlayers.includes(id);
    setSelectedPlayers((current) => removing ? current.filter((playerId) => playerId !== id) : [...current, id]);
    setManualAssignments((current) => {
      if (removing) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      const teamACount = Object.values(current).filter((team) => team === "team-a").length;
      const teamBCount = Object.values(current).filter((team) => team === "team-b").length;
      return { ...current, [id]: teamACount <= teamBCount ? "team-a" : "team-b" };
    });
  }

  function changeQuickPlayerCount(team: "a" | "b", nextCount: number) {
    const count = Math.max(2, Math.min(20, nextCount));
    const updateNames = (current: string[], prefix: string) =>
      Array.from({ length: count }, (_, index) => current[index] ?? `${prefix} Player ${index + 1}`);
    if (team === "a") {
      setTeamACount(count);
      setTeamAPlayerNames((current) => updateNames(current, "A"));
    } else {
      setTeamBCount(count);
      setTeamBPlayerNames((current) => updateNames(current, "B"));
    }
  }

  function updateQuickPlayerName(team: "a" | "b", index: number, value: string) {
    const setter = team === "a" ? setTeamAPlayerNames : setTeamBPlayerNames;
    setter((current) => current.map((name, playerIndex) => playerIndex === index ? value : name));
  }

  function changeOpponentCount(nextCount: number) {
    const count = Math.max(2, Math.min(20, nextCount));
    setOpponentCount(count);
    setOpponentPlayerNames((current) =>
      Array.from({ length: count }, (_, index) => current[index] ?? `Opponent Player ${index + 1}`),
    );
  }

  function buildTeams() {
    let nextTeams: [MatchTeam, MatchTeam];
    if (mode === "quick") {
      if (teamACount < 2 || teamBCount < 2) return setError("Each team needs at least two players.");
      nextTeams = [
        { id: "team-a", name: teamAName.trim() || "Team A", players: namedTemporaryPlayers("A", teamAPlayerNames) },
        { id: "team-b", name: teamBName.trim() || "Team B", players: namedTemporaryPlayers("B", teamBPlayerNames) },
      ];
    } else if (mode === "club-external") {
      if (selectedPlayers.length < 2) return setError("Select at least two club players.");
      if (opponentCount < 2) return setError("The opponent needs at least two players.");
      const homePlayers = activeRoster.filter((player) => selectedPlayers.includes(player.id)).map((player) => ({ id: player.id, name: player.name, source: "roster" as const }));
      nextTeams = [
        { id: "team-a", name: club?.name || "Club Team", players: homePlayers },
        { id: "team-b", name: opponentName.trim() || "Opponent Team", players: namedTemporaryPlayers("Opponent", opponentPlayerNames) },
      ];
    } else {
      if (selectedPlayers.length < 4) return setError("Select at least four players for an internal match.");
      const chosen = activeRoster.filter((player) => selectedPlayers.includes(player.id));
      const first: MatchPlayer[] = [];
      const second: MatchPlayer[] = [];
      chosen.forEach((player) => {
        const target = manualAssignments[player.id] === "team-b" ? second : first;
        target.push({ id: player.id, name: player.name, source: "roster" });
      });
      if (first.length < 2 || second.length < 2) return setError("Assign at least two players to each team.");
      nextTeams = [
        { id: "team-a", name: teamAName.trim() || "Team A", players: first },
        { id: "team-b", name: teamBName.trim() || "Team B", players: second },
      ];
    }
    setTeams(nextTeams);
    setWicketLimitA(lastMan ? nextTeams[0].players.length : nextTeams[0].players.length - 1);
    setWicketLimitB(lastMan ? nextTeams[1].players.length : nextTeams[1].players.length - 1);
    setError("");
    setStep("rules");
  }

  function continueFromRules() {
    if (overs < 1 || ballsPerOver < 1 || widePenalty < 0 || noBallPenalty < 0) {
      setError("Enter valid positive match rules.");
      return;
    }
    if (!teams || wicketLimitA < 1 || wicketLimitB < 1 || wicketLimitA > (lastMan ? teams[0].players.length : teams[0].players.length - 1) || wicketLimitB > (lastMan ? teams[1].players.length : teams[1].players.length - 1)) {
      setError("Wicket limits must fit each team and the selected last-man rule.");
      return;
    }
    setError("");
    setStep("toss");
  }

  function changeLastMan(enabled: boolean) {
    setLastMan(enabled);
    if (teams) {
      setWicketLimitA(enabled ? teams[0].players.length : Math.min(wicketLimitA, teams[0].players.length - 1));
      setWicketLimitB(enabled ? teams[1].players.length : Math.min(wicketLimitB, teams[1].players.length - 1));
    }
  }

  function runToss() {
    if (tossing) return;
    setTossWinner("");
    setTossing(true);
    setError("");
    window.setTimeout(() => {
      setTossWinner(Math.random() < 0.5 ? "team-a" : "team-b");
      setTossing(false);
    }, 1700);
  }

  function battingAndFieldingTeams() {
    if (!teams || !tossWinner) return null;
    const winnerBats = decision === "bat";
    const battingId = winnerBats ? tossWinner : tossWinner === "team-a" ? "team-b" : "team-a";
    return {
      batting: teams.find((team) => team.id === battingId)!,
      fielding: teams.find((team) => team.id !== battingId)!,
    };
  }

  function continueFromToss() {
    const sides = battingAndFieldingTeams();
    if (!sides) return setError("Confirm the toss winner.");
    setError("");
    setStep("review");
  }

  function continueToOpeners() {
    const sides = battingAndFieldingTeams();
    if (!sides) return setError("Complete the toss before choosing opening players.");
    setStriker(sides.batting.players[0]?.id || "");
    setNonStriker(sides.batting.players[1]?.id || "");
    setBowler(sides.fielding.players[0]?.id || "");
    setError("");
    setStep("openers");
  }

  function openingPlayersAreValid() {
    const sides = battingAndFieldingTeams();
    if (!sides) return false;
    const battingIds = new Set(sides.batting.players.map((player) => player.id));
    const fieldingIds = new Set(sides.fielding.players.map((player) => player.id));
    return battingIds.has(striker) && battingIds.has(nonStriker) && striker !== nonStriker && fieldingIds.has(bowler);
  }

  async function saveMatch() {
    if (!teams || !tossWinner) return;
    if (!openingPlayersAreValid()) {
      setError("Select two different opening batters and a bowler from the fielding side.");
      return;
    }
    if (mode !== "quick" && !scorerId) {
      setError("Choose a scorer for this match.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const match = await createMatch({
        mode,
        clubId: mode === "quick" ? undefined : club?.id,
        scoringOwnerId: mode === "quick" ? undefined : scorerId,
        teams,
        rules: {
          overs,
          ballsPerOver,
          widePenalty,
          noBallPenalty,
          freeHit,
          lastMan,
          venue: venue.trim() || undefined,
          scheduledDate,
          wicketLimits: {
            teamA: wicketLimitA,
            teamB: wicketLimitB,
          },
        },
        toss: { method: tossMethod, winnerId: tossWinner, decision, strikerId: striker, nonStrikerId: nonStriker, bowlerId: bowler },
      });
      localStorage.removeItem(draftKey);
      onCreated(match);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create match");
    } finally {
      setSaving(false);
    }
  }

  const sides = battingAndFieldingTeams();

  function goBack() {
    if (stepIndex <= 0) {
      onCancel();
      return;
    }
    setError("");
    setStep(steps[stepIndex - 1]);
  }

  return (
    <main className="match-setup-shell">
      <PageHeader title="Create match" eyebrow={entry === "quick" ? "QUICK SCORING" : club?.name?.toUpperCase()} onBack={goBack} backLabel={stepIndex > 0 ? "Previous setup step" : "Exit match setup"} action={<span className="setup-step-count">{stepIndex + 1}/{steps.length}</span>} />
      <div className="setup-progress">{steps.map((item, index) => <span key={item} className={index <= stepIndex ? "complete" : ""} />)}</div>

      <section className="setup-content">
        {step === "type" && <div className="setup-section">
          <span className="setup-kicker">MATCH TYPE</span><h1>Who are you playing?</h1><p>Choose how this match should appear in your club records.</p>
          <button type="button" className="match-type-card" onClick={() => chooseType("club-internal")}><span className="type-mark">A:B</span><span><strong>Within the club</strong><small>Split today’s players into two teams</small></span><b>→</b></button>
          <button type="button" className="match-type-card" onClick={() => chooseType("club-external")}><span className="type-mark dark">VS</span><span><strong>Against another team</strong><small>Use your roster and temporary opponents</small></span><b>→</b></button>
        </div>}

        {step === "teams" && <div className="setup-section">
          <span className="setup-kicker">TEAMS & PLAYERS</span><h1>{mode === "quick" ? "Set up both sides" : mode === "club-external" ? "Choose your lineup" : "Who’s playing today?"}</h1>
          <p>{mode === "quick" ? "Name the teams and choose how many temporary players to generate." : "Select active players from the club roster."}</p>
          {mode === "quick" ? <div className="quick-team-grid">
            <TeamCountCard label="TEAM A" name={teamAName} count={teamACount} onName={setTeamAName} onCount={(count) => changeQuickPlayerCount("a", count)} />
            <TeamCountCard label="TEAM B" name={teamBName} count={teamBCount} onName={setTeamBName} onCount={(count) => changeQuickPlayerCount("b", count)} />
          </div> : <>
            <div className="selection-summary"><strong>{selectedPlayers.length}</strong><span>players selected</span>{mode === "club-internal" && <small>Assign each selected player below</small>}</div>
            {activeRoster.length === 0 ? <div className="setup-empty"><strong>No active players</strong><p>Add players to the club before creating a club match.</p></div> :
              <div className="setup-player-list">{activeRoster.map((player) => <button type="button" key={player.id} className={selectedPlayers.includes(player.id) ? "selected" : ""} onClick={() => togglePlayer(player.id)}><span className="setup-check">{selectedPlayers.includes(player.id) ? "✓" : ""}</span><span><strong>{player.name}</strong><small>{player.role?.replace("-", " ") || "Player"}</small></span></button>)}</div>}
            {mode === "club-internal" && selectedPlayers.length > 0 && <div className="manual-team-list">{activeRoster.filter((player) => selectedPlayers.includes(player.id)).map((player) => <div key={player.id}><span>{player.name}</span><button type="button" className={manualAssignments[player.id] === "team-a" ? "selected" : ""} onClick={() => setManualAssignments((current) => ({ ...current, [player.id]: "team-a" }))}>A</button><button type="button" className={manualAssignments[player.id] === "team-b" ? "selected" : ""} onClick={() => setManualAssignments((current) => ({ ...current, [player.id]: "team-b" }))}>B</button></div>)}</div>}
            {mode === "club-internal" && <div className="team-name-row"><label><span>Team A name</span><input value={teamAName} onChange={(event) => setTeamAName(event.target.value)} /></label><label><span>Team B name</span><input value={teamBName} onChange={(event) => setTeamBName(event.target.value)} /></label></div>}
            {mode === "club-external" && <><div className="opponent-box external-opponent-box"><label><span>Opponent name</span><input value={opponentName} onChange={(event) => setOpponentName(event.target.value)} /></label><div className="opponent-stepper"><span>Opponent players</span><div><button type="button" onClick={() => changeOpponentCount(opponentCount - 1)} disabled={opponentCount <= 2}>−</button><strong>{opponentCount}</strong><button type="button" onClick={() => changeOpponentCount(opponentCount + 1)} disabled={opponentCount >= 20}>+</button></div></div></div>
              <div className="opponent-player-editor"><QuickPlayerEditor teamName={opponentName || "Opponent Team"} names={opponentPlayerNames} onChange={(index, value) => setOpponentPlayerNames((current) => current.map((name, playerIndex) => playerIndex === index ? value : name))} onReset={() => setOpponentPlayerNames(Array.from({ length: opponentCount }, (_, index) => `Opponent Player ${index + 1}`))} /></div></>}
          </>}
          {mode === "quick" && <div className="quick-player-editors">
            <QuickPlayerEditor teamName={teamAName || "Team A"} names={teamAPlayerNames} onChange={(index, value) => updateQuickPlayerName("a", index, value)} onReset={() => setTeamAPlayerNames(Array.from({ length: teamACount }, (_, index) => `A Player ${index + 1}`))} />
            <QuickPlayerEditor teamName={teamBName || "Team B"} names={teamBPlayerNames} onChange={(index, value) => updateQuickPlayerName("b", index, value)} onReset={() => setTeamBPlayerNames(Array.from({ length: teamBCount }, (_, index) => `B Player ${index + 1}`))} />
          </div>}
          <SetupError message={error} />
          <button type="button" className="setup-primary" onClick={buildTeams}>Continue to rules <span>→</span></button>
        </div>}

        {step === "rules" && <div className="setup-section">
          <span className="setup-kicker">MATCH RULES</span><h1>Set the playing rules</h1><p>These rules lock after the first delivery.</p>
          <div className="rules-grid"><NumberField label="Overs per innings" value={overs} onChange={setOvers} /><NumberField label="Balls per over" value={ballsPerOver} onChange={setBallsPerOver} /><NumberField label="Wide penalty" value={widePenalty} onChange={setWidePenalty} /><NumberField label="No-ball penalty" value={noBallPenalty} onChange={setNoBallPenalty} /></div>
          <ToggleRow title="Free hit after no-ball" caption="Enabled by default" checked={freeHit} onChange={setFreeHit} />
          <ToggleRow title="Last-man batting" caption="Remaining batter continues alone" checked={lastMan} onChange={changeLastMan} />
          <div className="rules-grid wicket-limit-grid"><NumberField label={`${teams?.[0].name || "Team A"} wicket limit`} value={wicketLimitA} onChange={setWicketLimitA} /><NumberField label={`${teams?.[1].name || "Team B"} wicket limit`} value={wicketLimitB} onChange={setWicketLimitB} /></div>
          <p className="rules-explanation">Innings end at the wicket limit, the over limit, a successful chase or a confirmed manual end.</p>
          <div className="team-name-row"><label><span>Venue</span><input value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Optional" /></label><label><span>Match date</span><input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} /></label></div>
          {mode !== "quick" && <label className="match-scorer-field"><span>Assigned scorer</span><select value={scorerId} onChange={(event) => setScorerId(event.target.value)}>{(club?.members || []).map((member) => <option key={member.userId} value={member.userId}>{member.name ? `${member.name}${member.email ? ` · ${member.email}` : ""}` : member.email || `${member.role} member`} · {member.role}</option>)}</select><small>Only this person can update the live score. Admins and organizers can change the scorer later.</small></label>}
          <SetupError message={error} />
          <div className="setup-footer-buttons"><button type="button" className="setup-secondary" onClick={() => setStep("teams")}>Back</button><button type="button" className="setup-primary" onClick={continueFromRules}>Continue to toss <span>→</span></button></div>
        </div>}

        {step === "toss" && teams && <div className="setup-section">
          <span className="setup-kicker">TOSS</span><h1>Decide who bats first</h1><p>Record a physical toss or let CricApp make the call.</p>
          <div className="toss-team-list">{teams.map((team, index) => <div key={team.id} className={tossWinner === team.id ? "winner" : ""}><span>TEAM {index === 0 ? "A" : "B"}</span><strong>{team.name}</strong><small>{team.players.length} players</small><p>{team.players.map((player) => player.name).join(", ")}</p>{tossWinner === team.id && <b>TOSS WINNER</b>}</div>)}</div>
          <div className="method-tabs"><button type="button" disabled={tossing} className={tossMethod === "physical" ? "active" : ""} onClick={() => { setTossMethod("physical"); setTossWinner(""); }}>Physical toss</button><button type="button" disabled={tossing} className={tossMethod === "in-app" ? "active" : ""} onClick={() => { setTossMethod("in-app"); setTossWinner(""); }}>In-app toss</button></div>
          {tossMethod === "in-app" && <button type="button" className={`toss-button ${tossing ? "tossing" : ""} ${tossWinner ? "has-result" : ""}`} onClick={runToss} disabled={tossing}><span className="toss-coin"><i>H</i><i>T</i></span><strong>{tossing ? "Tossing…" : tossWinner ? `Team ${teams.findIndex((team) => team.id === tossWinner) === 0 ? "A" : "B"} — ${teams.find((team) => team.id === tossWinner)?.name} won the toss` : "Run the toss"}</strong><small>{tossing ? `${teams[0].name} · ${teams[1].name}` : tossWinner ? "Tap to run the toss again" : "Let CricApp choose the winner"}</small></button>}
          {(tossMethod === "physical" || tossWinner) && <><div className="toss-choice"><span>Toss winner</span>{teams.map((team, index) => <button type="button" key={team.id} className={tossWinner === team.id ? "selected" : ""} onClick={() => setTossWinner(team.id)}>Team {index === 0 ? "A" : "B"} · {team.name}</button>)}</div>
          <div className="toss-choice"><span>Winner chose to</span><button type="button" className={decision === "bat" ? "selected" : ""} onClick={() => setDecision("bat")}>Bat</button><button type="button" className={decision === "bowl" ? "selected" : ""} onClick={() => setDecision("bowl")}>Bowl</button></div></>}
          <SetupError message={error} />
          <div className="setup-footer-buttons"><button type="button" className="setup-secondary" onClick={() => setStep("rules")}>Back</button><button type="button" className="setup-primary" onClick={continueFromToss}>Review match <span>→</span></button></div>
        </div>}

        {step === "review" && teams && sides && <div className="setup-section">
          <span className="setup-kicker">READY TO PLAY</span><h1>Review your match</h1><p>Lineups and rules lock when the first delivery is scored.</p>
          <div className="review-versus"><div><span>{teams[0].players.length} PLAYERS</span><strong>{teams[0].name}</strong></div><b>VS</b><div><span>{teams[1].players.length} PLAYERS</span><strong>{teams[1].name}</strong></div></div>
          <div className="review-details"><div><span>FORMAT</span><strong>{overs} overs · {ballsPerOver} balls</strong></div><div><span>TOSS</span><strong>{teams.find((team) => team.id === tossWinner)?.name} chose to {decision}</strong></div><div><span>VENUE</span><strong>{venue || "Not specified"}</strong></div><div><span>FIRST INNINGS</span><strong>{sides.batting.name} batting</strong></div>{mode !== "quick" && <div><span>SCORER</span><strong>{club?.members?.find((member) => member.userId === scorerId)?.email || "Club admin"}</strong></div>}</div>
          <div className="rules-badges"><span className={freeHit ? "on" : ""}>Free hit {freeHit ? "on" : "off"}</span><span className={lastMan ? "on" : ""}>Last man {lastMan ? "on" : "off"}</span></div>
          <SetupError message={error} />
          <div className="setup-footer-buttons"><button type="button" className="setup-secondary" onClick={() => setStep("toss")}>Back</button><button type="button" className="setup-primary create-match-final" onClick={continueToOpeners}>Choose opening players <span>→</span></button></div>
        </div>}

        {step === "openers" && teams && sides && <div className="setup-section">
          <span className="setup-kicker">OPENING PLAYERS</span><h1>Set the first delivery</h1><p>The first two players in the batting lineup are selected by default. You can change them before scoring starts.</p>
          <div className="innings-callout"><span>FIRST INNINGS</span><strong>{sides.batting.name} batting</strong><small>{sides.fielding.name} fielding</small></div>
          <div className="openers-box final-openers"><label><span>Opening striker</span><select value={striker} onChange={(event) => setStriker(event.target.value)}>{sides.batting.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><label><span>Non-striker</span><select value={nonStriker} onChange={(event) => setNonStriker(event.target.value)}>{sides.batting.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label><label><span>Opening bowler</span><select value={bowler} onChange={(event) => setBowler(event.target.value)}>{sides.fielding.players.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label></div>
          <SetupError message={error} />
          <div className="setup-footer-buttons"><button type="button" className="setup-secondary" onClick={() => setStep("review")}>Back</button><button type="button" className="setup-primary create-match-final" onClick={saveMatch} disabled={saving}>{saving ? "Creating match…" : "Create & start scoring"} {!saving && <span>→</span>}</button></div>
        </div>}
      </section>
    </main>
  );
}

function TeamCountCard({ label, name, count, onName, onCount }: { label: string; name: string; count: number; onName: (value: string) => void; onCount: (value: number) => void }) {
  return <div className="team-count-card"><span>{label}</span><input value={name} onChange={(event) => onName(event.target.value)} aria-label={`${label} name`} /><div><small>Players</small><button type="button" onClick={() => onCount(Math.max(2, count - 1))}>−</button><strong>{count}</strong><button type="button" onClick={() => onCount(Math.min(20, count + 1))}>+</button></div></div>;
}

function QuickPlayerEditor({ teamName, names, onChange, onReset }: { teamName: string; names: string[]; onChange: (index: number, value: string) => void; onReset: () => void }) {
  return <section className="quick-player-editor"><div className="quick-editor-head"><div><span>PLAYER NAMES</span><strong>{teamName}</strong></div><button type="button" onClick={onReset}>Reset names</button></div><div className="quick-name-list">{names.map((name, index) => <label key={index}><span>{String(index + 1).padStart(2, "0")}</span><input value={name} maxLength={80} onChange={(event) => onChange(index, event.target.value)} aria-label={`${teamName} player ${index + 1}`} /></label>)}</div></section>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="number-field"><span>{label}</span><input type="number" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function ToggleRow({ title, caption, checked, onChange }: { title: string; caption: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" className="toggle-row" onClick={() => onChange(!checked)}><span><strong>{title}</strong><small>{caption}</small></span><i className={checked ? "on" : ""}><b /></i></button>;
}

function SetupError({ message }: { message: string }) {
  return message ? <div className="setup-error" role="alert">{message}</div> : null;
}
