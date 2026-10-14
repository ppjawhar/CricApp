import { useEffect, useMemo, useRef, useState } from "react";
import {
  changeMatchScorer,
  deleteMatch,
  getMatch,
  saveMatchScore,
  updateMatchPlayers,
  updateMatchRules,
  updateMatchStatus,
  type CricketMatch,
  type DismissalType,
  type ExtraType,
  type MatchPlayer,
  type MatchRules,
  type MatchScoreState,
  type MatchTeam,
  type ScoreDelivery,
} from "../lib/matchesApi";
import {
  allowedDismissals,
  bowlerConcededRuns,
  canChangeBowlerBeforeDelivery,
  completedRunsForDelivery,
  isLegalDelivery,
  nextFreeHit,
  wicketLimitAfterLastManToggle,
} from "../lib/cricketRules";
import { createId } from "../lib/id";
import PageHeader from "../components/PageHeader";

type Phase =
  | "live"
  | "new-batter"
  | "new-bowler"
  | "innings-break"
  | "completed";

type ScoreState = MatchScoreState & { phase: Phase };

type DraftDelivery = {
  batRuns: number;
  extraType?: ExtraType;
  runningExtraType?: "bye" | "leg-bye";
  extraRuns: number;
  boundary?: 4 | 6;
  wicket?: {
    playerId: string;
    type: DismissalType;
    fielderId?: string;
    survivingEnd?: "striker" | "non-striker";
  };
  runsSelected?: boolean;
};

const emptyDraft = (): DraftDelivery => ({ batRuns: 0, extraRuns: 0 });

function firstBattingTeam(match: CricketMatch) {
  const battingId =
    match.toss.decision === "bat"
      ? match.toss.winnerId
      : match.toss.winnerId === "team-a"
        ? "team-b"
        : "team-a";
  return match.teams.find((team) => team.id === battingId)!;
}

function initialState(match: CricketMatch): ScoreState {
  const batting = firstBattingTeam(match);
  return {
    innings: [
      {
        battingTeamId: batting.id,
        runs: 0,
        wickets: 0,
        legalBalls: 0,
        deliveries: [],
        dismissed: [],
      },
    ],
    activeInnings: 0,
    strikerId: match.toss.strikerId,
    nonStrikerId: match.toss.nonStrikerId,
    bowlerId: match.toss.bowlerId,
    batterDisplayOrder: [match.toss.strikerId, match.toss.nonStrikerId],
    freeHit: false,
    phase: "live",
  };
}

function normalizeState(value: ScoreState, match: CricketMatch): ScoreState {
  let sequence = 0;
  return {
    ...value,
    batterDisplayOrder: value.batterDisplayOrder || [
      value.strikerId,
      value.nonStrikerId,
    ],
    innings: value.innings.map((innings, inningsIndex) => ({
      ...innings,
      deliveries: innings.deliveries.map((delivery) => {
        sequence += 1;
        const legacy = delivery as ScoreDelivery & { batterId?: string };
        const strikerId =
          delivery.strikerId || legacy.batterId || value.strikerId;
        const completedRuns = Number.isInteger(delivery.completedRuns)
          ? delivery.completedRuns
          : delivery.extraType === "wide"
            ? Math.max(0, delivery.extraRuns - match.rules.widePenalty)
            : delivery.batRuns || delivery.extraRuns;
        return {
          ...delivery,
          sequence,
          innings: inningsIndex,
          strikerId,
          nonStrikerId: delivery.nonStrikerId || value.nonStrikerId,
          completedRuns,
          createdAt: delivery.createdAt || new Date().toISOString(),
        };
      }),
    })),
  };
}

function playerName(team: MatchTeam, id: string) {
  return (
    team.players.find((player) => player.id === id)?.name || "Select player"
  );
}

export default function ScoringPage({
  match: initialMatch,
  onExit,
  onComplete,
}: {
  match: CricketMatch;
  onExit: () => void;
  onComplete: () => void;
}) {
  const [match, setMatch] = useState(initialMatch);
  const initialCanScore = match.permissions?.canScore ?? !match.clubId;
  const storageKey = `cricapp-match-score:${match.id}`;
  const localRecord = useMemo(() => {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!value) return null;
      return value.state
        ? value
        : {
            state: value,
            history: [],
            version: match.version || 0,
            pending: true,
          };
    } catch {
      return null;
    }
  }, [storageKey, match.version]);
  const [state, setState] = useState<ScoreState>(() => {
    if (localRecord?.state) {
      const restored = localRecord.state;
      return normalizeState(restored, match);
    }
    return match.score
      ? normalizeState(match.score as ScoreState, match)
      : initialState(match);
  });
  const [history, setHistory] = useState<ScoreState[]>(
    () => localRecord?.history || [],
  );
  const [sheet, setSheet] = useState<"wicket" | "scorer" | null>(null);
  const [dismissalType, setDismissalType] = useState<DismissalType>("bowled");
  const [dismissedPlayer, setDismissedPlayer] = useState(state.strikerId);
  const [fielderId, setFielderId] = useState("");
  const [survivingEnd, setSurvivingEnd] = useState<"striker" | "non-striker">(
    "striker",
  );
  const [draft, setDraft] = useState<DraftDelivery>(emptyDraft);
  const [committing, setCommitting] = useState(false);
  const [toast, setToast] = useState("");
  const [syncStatus, setSyncStatus] = useState<
    "restoring" | "local" | "pending" | "synced" | "conflict"
  >("restoring");
  const [cloudReady, setCloudReady] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"live" | "scorecard" | "history">(
    "live",
  );
  const [access, setAccess] = useState({
    canScore: initialCanScore,
    canManageScorer: match.permissions?.canManageScorer ?? false,
  });
  const [scorerId, setScorerId] = useState(
    match.scoringOwnerId || match.scorer?.userId || "",
  );
  const [scorerOptions, setScorerOptions] = useState(match.scorerOptions || []);
  const [changingScorer, setChangingScorer] = useState(false);
  const [editingTeams, setEditingTeams] = useState(false);
  const [savingTeams, setSavingTeams] = useState(false);
  const [editingRules, setEditingRules] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [changingBowler, setChangingBowler] = useState(false);
  const versionRef = useRef(localRecord?.version ?? match.version ?? 0);
  const syncChain = useRef(Promise.resolve());
  const syncTimerRef = useRef<number | undefined>(undefined);
  const exitingRef = useRef(false);

  useEffect(() => {
    if (!access.canScore) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        state,
        history,
        version: versionRef.current,
        pending: syncStatus !== "synced",
      }),
    );
  }, [state, history, storageKey, syncStatus, access.canScore]);

  useEffect(() => {
    let active = true;
    getMatch(match.id)
      .then((remote) => {
        if (!active) return;
        setMatch(remote);
        setAccess({
          canScore: remote.permissions?.canScore ?? !remote.clubId,
          canManageScorer: remote.permissions?.canManageScorer ?? false,
        });
        setScorerId(remote.scoringOwnerId || remote.scorer?.userId || "");
        setScorerOptions(remote.scorerOptions || []);
        const remoteVersion = remote.version || 0;
        if (
          remote.score &&
          (!initialCanScore ||
            !localRecord?.pending ||
            remoteVersion > versionRef.current)
        ) {
          setState(normalizeState(remote.score as ScoreState, match));
          setHistory([]);
          versionRef.current = remoteVersion;
          setSyncStatus("synced");
        } else {
          versionRef.current = Math.max(versionRef.current, remoteVersion);
          setSyncStatus(localRecord?.pending ? "pending" : "synced");
        }
      })
      .catch(() => active && setSyncStatus("local"))
      .finally(() => active && setCloudReady(true));
    return () => {
      active = false;
    };
  }, [match.id]);

  useEffect(() => {
    if (!cloudReady || !access.canScore) return;
    setSyncStatus((current) => (current === "conflict" ? current : "pending"));
    const snapshot = structuredClone(state);
    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = undefined;
      syncChain.current = syncChain.current.then(async () => {
        try {
          const saved = await saveMatchScore(
            match.id,
            snapshot,
            versionRef.current,
          );
          versionRef.current = saved.version || versionRef.current + 1;
          setSyncStatus("synced");
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              state: snapshot,
              history,
              version: versionRef.current,
              pending: false,
            }),
          );
        } catch (error) {
          setSyncStatus(
            error instanceof Error && error.message.includes("another session")
              ? "conflict"
              : "local",
          );
        }
      });
    }, 350);
    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = undefined;
    };
  }, [state, cloudReady, match.id, access.canScore]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      getMatch(match.id)
        .then((remote) => {
          if (!active) return;
          setMatch(remote);
          const remoteCanScore = remote.permissions?.canScore ?? !remote.clubId;
          setAccess({
            canScore: remoteCanScore,
            canManageScorer: remote.permissions?.canManageScorer ?? false,
          });
          setScorerId(remote.scoringOwnerId || remote.scorer?.userId || "");
          setScorerOptions(remote.scorerOptions || []);
          const remoteVersion = remote.version || 0;
          if (
            !remoteCanScore &&
            remote.score &&
            remoteVersion >= versionRef.current
          ) {
            setState(normalizeState(remote.score as ScoreState, match));
            setHistory([]);
            versionRef.current = remoteVersion;
            setSyncStatus("synced");
          }
        })
        .catch(() => undefined);
    };
    const timer = window.setInterval(refresh, 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [match.id]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!access.canScore) {
      setEditingTeams(false);
      setEditingRules(false);
      setChangingBowler(false);
    }
  }, [access.canScore]);

  const innings = state.innings[state.activeInnings];
  const battingTeam = match.teams.find(
    (team) => team.id === innings.battingTeamId,
  )!;
  const fieldingTeam = match.teams.find(
    (team) => team.id !== innings.battingTeamId,
  )!;
  const target =
    state.activeInnings === 1 ? state.innings[0].runs + 1 : undefined;
  const wicketLimit =
    battingTeam.id === "team-a"
      ? match.rules.wicketLimits.teamA
      : match.rules.wicketLimits.teamB;
  const ballsRemaining =
    match.rules.overs * match.rules.ballsPerOver - innings.legalBalls;

  const batterFigures = useMemo(() => {
    const figures = new Map<string, { runs: number; balls: number }>();
    for (const delivery of innings.deliveries) {
      const current = figures.get(delivery.strikerId) || { runs: 0, balls: 0 };
      current.runs += delivery.batRuns;
      if (delivery.legal) current.balls += 1;
      figures.set(delivery.strikerId, current);
    }
    return figures;
  }, [innings.deliveries]);

  const bowlerFigures = useMemo(() => {
    const deliveries = innings.deliveries.filter(
      (delivery) => delivery.bowlerId === state.bowlerId,
    );
    return {
      balls: deliveries.filter((delivery) => delivery.legal).length,
      runs: deliveries.reduce(
        (sum, delivery) =>
          sum + bowlerConcededRuns(delivery, match.rules.noBallPenalty),
        0,
      ),
      wickets: deliveries.filter(
        (delivery) => delivery.wicket && delivery.wicket.type !== "run-out",
      ).length,
    };
  }, [innings.deliveries, state.bowlerId]);

  const thisOver = useMemo(() => {
    const result: ScoreDelivery[] = [];
    for (let index = innings.deliveries.length - 1; index >= 0; index -= 1) {
      if (
        result.filter((delivery) => delivery.legal).length >=
          innings.legalBalls % match.rules.ballsPerOver &&
        innings.legalBalls % match.rules.ballsPerOver !== 0
      )
        break;
      result.unshift(innings.deliveries[index]);
      if (
        innings.legalBalls % match.rules.ballsPerOver === 0 &&
        result.some((delivery) => delivery.legal)
      ) {
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
    const firstTeam = match.teams.find(
      (team) => team.id === next.innings[0].battingTeamId,
    )!;
    const secondTeam = match.teams.find(
      (team) => team.id === next.innings[1].battingTeamId,
    )!;
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

  function addDelivery(input: DraftDelivery) {
    if (state.phase !== "live") return;
    pushHistory();
    setState((current) => {
      const next = structuredClone(current);
      const active = next.innings[next.activeInnings];
      const batRuns = input.batRuns || 0;
      const extras = input.extraRuns || 0;
      const legal = isLegalDelivery(input.extraType);
      const total = batRuns + extras;
      const noBallCompleted =
        input.extraType === "no-ball"
          ? Math.max(0, extras - match.rules.noBallPenalty)
          : 0;
      const baseLabel =
        input.extraType === "wide"
          ? `${extras}Wd`
          : input.extraType === "no-ball"
            ? `Nb${batRuns ? `+${batRuns}` : noBallCompleted ? `+${noBallCompleted}${input.runningExtraType === "leg-bye" ? "Lb" : "B"}` : ""}`
            : input.extraType === "bye"
              ? `${extras}B`
              : input.extraType === "leg-bye"
                ? `${extras}Lb`
                : batRuns === 0
                  ? "•"
                  : String(batRuns);
      const label = input.wicket
        ? `${baseLabel === "•" ? "" : `${baseLabel}+`}W`
        : baseLabel;
      active.runs += total;
      if (legal) active.legalBalls += 1;
      if (input.wicket) {
        active.wickets += 1;
        active.dismissed.push(input.wicket.playerId);
        next.pendingDismissedEnd =
          input.wicket.playerId === next.nonStrikerId
            ? "non-striker"
            : "striker";
        next.pendingDismissedPlayerId = input.wicket.playerId;
        next.pendingOverEnd =
          legal && active.legalBalls % match.rules.ballsPerOver === 0;
      }
      const completedRuns = completedRunsForDelivery(
        {
          batRuns,
          extraType: input.extraType,
          runningExtraType: input.runningExtraType,
          extraRuns: extras,
        },
        match.rules.widePenalty,
        match.rules.noBallPenalty,
      );
      active.deliveries.push({
        id: createId(),
        sequence:
          next.innings.reduce(
            (count, item) => count + item.deliveries.length,
            0,
          ) + 1,
        innings: next.activeInnings,
        strikerId: next.strikerId,
        nonStrikerId: next.nonStrikerId,
        bowlerId: next.bowlerId,
        batRuns,
        completedRuns,
        extraType: input.extraType,
        runningExtraType: input.runningExtraType,
        extraRuns: extras,
        legal,
        boundary: input.boundary,
        wicket: input.wicket,
        label,
        createdAt: new Date().toISOString(),
      });

      if (completedRuns % 2 === 1)
        [next.strikerId, next.nonStrikerId] = [
          next.nonStrikerId,
          next.strikerId,
        ];
      if (input.wicket?.type === "run-out" && input.wicket.survivingEnd) {
        const survivorId =
          input.wicket.playerId === current.strikerId
            ? current.nonStrikerId
            : current.strikerId;
        const dismissedId = input.wicket.playerId;
        if (input.wicket.survivingEnd === "striker") {
          next.strikerId = survivorId;
          next.nonStrikerId = dismissedId;
          next.pendingDismissedEnd = "non-striker";
        } else {
          next.strikerId = dismissedId;
          next.nonStrikerId = survivorId;
          next.pendingDismissedEnd = "striker";
        }
      }
      next.freeHit = nextFreeHit(
        next.freeHit,
        input.extraType,
        match.rules.freeHit,
      );

      const chaseWon =
        next.activeInnings === 1 &&
        target !== undefined &&
        active.runs >= target;
      const inningsEnded =
        active.wickets >= wicketLimit ||
        active.legalBalls >= match.rules.overs * match.rules.ballsPerOver;
      if (chaseWon) {
        finishSecondInnings(next, true);
      } else if (inningsEnded) {
        if (next.activeInnings === 0) next.phase = "innings-break";
        else finishSecondInnings(next, false);
      } else if (input.wicket) {
        const activeBattingTeam = match.teams.find(
          (team) => team.id === active.battingTeamId,
        )!;
        const remaining = activeBattingTeam.players.filter(
          (player) => !active.dismissed.includes(player.id),
        );
        if (match.rules.lastMan && remaining.length === 1) {
          next.strikerId = remaining[0].id;
          next.nonStrikerId = remaining[0].id;
          next.batterDisplayOrder = [remaining[0].id, remaining[0].id];
          next.pendingDismissedEnd = undefined;
          next.pendingDismissedPlayerId = undefined;
          next.pendingOverEnd = false;
          next.phase =
            legal && active.legalBalls % match.rules.ballsPerOver === 0
              ? "new-bowler"
              : "live";
        } else {
          next.phase = "new-batter";
        }
      } else if (legal && active.legalBalls % match.rules.ballsPerOver === 0) {
        [next.strikerId, next.nonStrikerId] = [
          next.nonStrikerId,
          next.strikerId,
        ];
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
        return {
          ...current,
          batRuns: 0,
          extraRuns: match.rules.widePenalty + runs,
          boundary: undefined,
          runsSelected: true,
        };
      }
      if (current.extraType === "no-ball" && current.runningExtraType) {
        return {
          ...current,
          batRuns: 0,
          extraRuns: match.rules.noBallPenalty + runs,
          boundary: undefined,
          runsSelected: true,
        };
      }
      if (current.extraType === "bye" || current.extraType === "leg-bye") {
        return {
          ...current,
          batRuns: 0,
          extraRuns: runs,
          boundary: undefined,
          runsSelected: true,
        };
      }
      return {
        ...current,
        batRuns: runs,
        boundary: runs === 4 || runs === 6 ? runs : undefined,
        runsSelected: true,
      };
    });
  }

  function selectDirectExtra(type: ExtraType) {
    setDraft((current) => {
      if (
        (type === "bye" || type === "leg-bye") &&
        current.extraType === "no-ball"
      ) {
        if (current.runningExtraType === type) {
          const completed = Math.max(
            0,
            current.extraRuns - match.rules.noBallPenalty,
          );
          return {
            ...current,
            batRuns: completed,
            runningExtraType: undefined,
            extraRuns: match.rules.noBallPenalty,
          };
        }
        const completed = current.runningExtraType
          ? Math.max(0, current.extraRuns - match.rules.noBallPenalty)
          : current.batRuns;
        return {
          ...current,
          batRuns: 0,
          runningExtraType: type,
          extraRuns: match.rules.noBallPenalty + completed,
        };
      }
      if (
        type === "no-ball" &&
        (current.extraType === "bye" || current.extraType === "leg-bye")
      ) {
        return {
          ...current,
          batRuns: 0,
          extraType: "no-ball",
          runningExtraType: current.extraType,
          extraRuns: match.rules.noBallPenalty + current.extraRuns,
        };
      }
      if (current.extraType === type) {
        const selectedRuns =
          type === "wide"
            ? Math.max(0, current.extraRuns - match.rules.widePenalty)
            : type === "bye" || type === "leg-bye"
              ? current.extraRuns
              : current.batRuns;
        return {
          ...current,
          batRuns: selectedRuns,
          extraType: undefined,
          runningExtraType: undefined,
          extraRuns: 0,
        };
      }
      const selectedRuns =
        current.extraType === "wide"
          ? Math.max(0, current.extraRuns - match.rules.widePenalty)
          : current.extraType === "bye" || current.extraType === "leg-bye"
            ? current.extraRuns
            : current.batRuns;
      return {
        ...current,
        batRuns:
          type === "wide" || type === "bye" || type === "leg-bye"
            ? 0
            : selectedRuns,
        extraType: type,
        runningExtraType: undefined,
        extraRuns:
          type === "wide"
            ? match.rules.widePenalty + selectedRuns
            : type === "no-ball"
              ? match.rules.noBallPenalty
              : selectedRuns,
      };
    });
  }

  function commitDraft() {
    if (
      committing ||
      (!draft.runsSelected && !draft.extraType && !draft.wicket)
    )
      return;
    setCommitting(true);
    addDelivery(draft);
    setDraft(emptyDraft());
    window.setTimeout(() => setCommitting(false), 180);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    if (
      (state.phase === "innings-break" || state.phase === "completed") &&
      !window.confirm("Undo the delivery that ended this innings or match?")
    )
      return;
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
      if (next.pendingDismissedEnd === "non-striker")
        next.nonStrikerId = playerId;
      else next.strikerId = playerId;
      const dismissedId = next.pendingDismissedPlayerId;
      next.batterDisplayOrder = (
        next.batterDisplayOrder || [next.strikerId, next.nonStrikerId]
      ).map((id) => (id === dismissedId ? playerId : id)) as [string, string];
      next.pendingDismissedEnd = undefined;
      next.pendingDismissedPlayerId = undefined;
      if (next.pendingOverEnd) {
        [next.strikerId, next.nonStrikerId] = [
          next.nonStrikerId,
          next.strikerId,
        ];
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
    setChangingBowler(false);
  }

  function reselectBowler() {
    setChangingBowler(true);
  }

  function startSecondInnings(
    strikerId: string,
    nonStrikerId: string,
    bowlerId: string,
  ) {
    const secondBatting = fieldingTeam;
    setHistory([]);
    setState((current) => ({
      ...current,
      innings: [
        ...current.innings,
        {
          battingTeamId: secondBatting.id,
          runs: 0,
          wickets: 0,
          legalBalls: 0,
          deliveries: [],
          dismissed: [],
        },
      ],
      activeInnings: 1,
      strikerId,
      nonStrikerId,
      bowlerId,
      batterDisplayOrder: [strikerId, nonStrikerId],
      freeHit: false,
      phase: "live",
    }));
  }

  async function pauseAndExit() {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExiting(true);
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        state,
        history,
        version: versionRef.current,
        pending: true,
      }),
    );
    try {
      await syncChain.current;
      const saved = await saveMatchScore(match.id, state, versionRef.current);
      versionRef.current = saved.version || versionRef.current + 1;
      await updateMatchStatus(match.id, "paused");
    } catch {
      // The durable local copy remains available for the next session.
    }
    onExit();
  }

  async function completeAndExit() {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExiting(true);
    try {
      await syncChain.current;
      const saved = await saveMatchScore(match.id, state, versionRef.current);
      versionRef.current = saved.version || versionRef.current + 1;
      localStorage.removeItem(storageKey);
    } catch {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state,
          history,
          version: versionRef.current,
          pending: true,
        }),
      );
    }
    onComplete();
  }

  function correctStrike() {
    pushHistory();
    setState((current) => ({
      ...current,
      strikerId: current.nonStrikerId,
      nonStrikerId: current.strikerId,
    }));
    setToast("Strike corrected");
  }

  function endInnings() {
    if (
      !window.confirm(
        state.activeInnings === 0
          ? "End the first innings now?"
          : "End the match with the current score?",
      )
    )
      return;
    pushHistory();
    setState((current) => {
      const next = structuredClone(current);
      if (next.activeInnings === 0) next.phase = "innings-break";
      else finishSecondInnings(next, false);
      return next;
    });
  }

  async function abandonMatch() {
    if (
      !window.confirm(
        "Abandon this match? The score will be kept and no winner will be recorded.",
      )
    )
      return;
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExiting(true);
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        state,
        history,
        version: versionRef.current,
        pending: true,
      }),
    );
    try {
      await syncChain.current;
      await saveMatchScore(match.id, state, versionRef.current);
      await updateMatchStatus(match.id, "abandoned");
      localStorage.removeItem(storageKey);
    } catch {
      // Keep the local recovery copy when the device is offline.
    }
    onComplete();
  }

  async function removeCurrentMatch() {
    if (
      !window.confirm(
        `Remove ${match.teams[0].name} vs ${match.teams[1].name}? This permanently deletes the match and its score.`,
      )
    )
      return;
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExiting(true);
    try {
      await deleteMatch(match.id);
      localStorage.removeItem(storageKey);
      onComplete();
    } catch (reason) {
      exitingRef.current = false;
      setExiting(false);
      setToast(
        reason instanceof Error
          ? reason.message
          : "Unable to remove this match",
      );
    }
  }

  async function assignScorer() {
    if (!scorerId || changingScorer) return;
    setChangingScorer(true);
    try {
      if (access.canScore) await syncChain.current;
      const updated = await changeMatchScorer(match.id, scorerId);
      versionRef.current = updated.version || versionRef.current;
      setAccess({
        canScore: updated.permissions?.canScore ?? false,
        canManageScorer: updated.permissions?.canManageScorer ?? false,
      });
      setScorerId(updated.scoringOwnerId || updated.scorer?.userId || scorerId);
      setScorerOptions(updated.scorerOptions || scorerOptions);
      setSheet(null);
      setToast("Match scorer updated");
    } catch (reason) {
      setToast(
        reason instanceof Error ? reason.message : "Unable to change scorer",
      );
    } finally {
      setChangingScorer(false);
    }
  }

  async function saveTeamChanges(
    additions: Array<{
      teamId: MatchTeam["id"];
      name?: string;
      playerId?: string;
    }>,
    renames: Array<{ playerId: string; name: string }>,
    teamNames: Array<{ teamId: MatchTeam["id"]; name: string }>,
  ) {
    if (savingTeams || !access.canScore) return;
    setSavingTeams(true);
    try {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = undefined;
      }
      await syncChain.current;
      const saved = await saveMatchScore(match.id, state, versionRef.current);
      versionRef.current = saved.version || versionRef.current + 1;
      const updated = await updateMatchPlayers(
        match.id,
        additions,
        renames,
        teamNames,
        versionRef.current,
      );
      versionRef.current = updated.version || versionRef.current + 1;
      setMatch(updated);
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state,
          history,
          version: versionRef.current,
          pending: false,
        }),
      );
      setEditingTeams(false);
      setSyncStatus("synced");
      setToast("Team information updated");
    } catch (reason) {
      setToast(
        reason instanceof Error ? reason.message : "Unable to update teams",
      );
    } finally {
      setSavingTeams(false);
    }
  }

  async function saveRuleChanges(
    rules: Pick<MatchRules, "overs" | "lastMan" | "wicketLimits" | "venue">,
  ) {
    if (savingRules || !access.canScore) return;
    setSavingRules(true);
    try {
      if (syncTimerRef.current) {
        window.clearTimeout(syncTimerRef.current);
        syncTimerRef.current = undefined;
      }
      await syncChain.current;
      const saved = await saveMatchScore(match.id, state, versionRef.current);
      versionRef.current = saved.version || versionRef.current + 1;
      const updated = await updateMatchRules(
        match.id,
        rules,
        versionRef.current,
      );
      versionRef.current = updated.version || versionRef.current + 1;
      setMatch(updated);
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state,
          history,
          version: versionRef.current,
          pending: false,
        }),
      );
      setEditingRules(false);
      setSyncStatus("synced");
      setToast("Playing rules updated");
    } catch (reason) {
      setToast(
        reason instanceof Error
          ? reason.message
          : "Unable to update playing rules",
      );
    } finally {
      setSavingRules(false);
    }
  }

  function repairFromDelivery(deliveryId: string, remove: boolean) {
    const deliveryIndex = innings.deliveries.findIndex(
      (delivery) => delivery.id === deliveryId,
    );
    if (deliveryIndex < 0) return;
    const original = innings.deliveries[deliveryIndex];
    const laterCount = innings.deliveries.length - deliveryIndex - 1;
    if (
      laterCount > 0 &&
      !window.confirm(
        `This correction changes earlier play. ${laterCount} later ${laterCount === 1 ? "delivery" : "deliveries"} must be removed and re-entered. Continue?`,
      )
    )
      return;
    let replacement: ScoreDelivery | null = original;
    if (remove) {
      if (
        !window.confirm(
          `Remove delivery ${original.sequence} and resume scoring from there?`,
        )
      )
        return;
      replacement = null;
    } else {
      const currentRuns =
        original.extraType === "wide"
          ? Math.max(0, original.extraRuns - match.rules.widePenalty)
          : original.extraType === "no-ball" && original.runningExtraType
            ? Math.max(0, original.extraRuns - match.rules.noBallPenalty)
            : original.extraType === "bye" || original.extraType === "leg-bye"
              ? original.extraRuns
              : original.batRuns;
      const answer = window.prompt(
        "Correct completed or bat runs for this delivery",
        String(currentRuns),
      );
      if (answer === null) return;
      const runs = Number(answer);
      if (!Number.isInteger(runs) || runs < 0 || runs > 99)
        return setToast("Enter a whole number from 0 to 99");
      replacement = { ...original };
      if (original.extraType === "wide")
        replacement.extraRuns = match.rules.widePenalty + runs;
      else if (original.extraType === "no-ball" && original.runningExtraType)
        replacement.extraRuns = match.rules.noBallPenalty + runs;
      else if (original.extraType === "bye" || original.extraType === "leg-bye")
        replacement.extraRuns = runs;
      else replacement.batRuns = runs;
      replacement.completedRuns = completedRunsForDelivery(
        replacement,
        match.rules.widePenalty,
        match.rules.noBallPenalty,
      );
      replacement.boundary =
        !replacement.extraType && (runs === 4 || runs === 6) ? runs : undefined;
      replacement.label = replacement.wicket
        ? `${runs || ""}W`
        : replacement.extraType === "wide"
          ? `${replacement.extraRuns}Wd`
          : replacement.extraType === "no-ball"
            ? `Nb${runs ? `+${runs}` : ""}`
            : replacement.extraType === "bye"
              ? `${runs}B`
              : replacement.extraType === "leg-bye"
                ? `${runs}Lb`
                : runs
                  ? String(runs)
                  : "•";
    }
    pushHistory();
    setState((current) => {
      const next = structuredClone(current);
      const repaired = next.innings[next.activeInnings];
      repaired.deliveries = [
        ...repaired.deliveries.slice(0, deliveryIndex),
        ...(replacement ? [replacement] : []),
      ];
      repaired.runs = repaired.deliveries.reduce(
        (sum, delivery) => sum + delivery.batRuns + delivery.extraRuns,
        0,
      );
      repaired.wickets = repaired.deliveries.filter(
        (delivery) => delivery.wicket,
      ).length;
      repaired.legalBalls = repaired.deliveries.filter(
        (delivery) => delivery.legal,
      ).length;
      repaired.dismissed = repaired.deliveries.flatMap((delivery) =>
        delivery.wicket ? [delivery.wicket.playerId] : [],
      );
      let sequence = 0;
      next.innings.forEach((item) =>
        item.deliveries.forEach((delivery) => {
          sequence += 1;
          delivery.sequence = sequence;
        }),
      );
      const last = repaired.deliveries[repaired.deliveries.length - 1];
      if (last) {
        next.strikerId = last.strikerId;
        next.nonStrikerId = last.nonStrikerId;
        if (last.completedRuns % 2 === 1)
          [next.strikerId, next.nonStrikerId] = [
            next.nonStrikerId,
            next.strikerId,
          ];
        next.bowlerId = last.bowlerId;
        next.freeHit = nextFreeHit(false, last.extraType, match.rules.freeHit);
        next.phase = last.wicket
          ? "new-batter"
          : last.legal && repaired.legalBalls % match.rules.ballsPerOver === 0
            ? "new-bowler"
            : "live";
        next.pendingDismissedPlayerId = last.wicket?.playerId;
        next.pendingDismissedEnd = last.wicket
          ? last.wicket.playerId === next.nonStrikerId
            ? "non-striker"
            : "striker"
          : undefined;
        next.pendingOverEnd = Boolean(
          last.wicket &&
          last.legal &&
          repaired.legalBalls % match.rules.ballsPerOver === 0,
        );
      } else {
        next.phase = "live";
        next.freeHit = false;
        next.pendingDismissedPlayerId = undefined;
        next.pendingDismissedEnd = undefined;
        next.pendingOverEnd = false;
        if (next.activeInnings === 0) {
          next.strikerId = match.toss.strikerId;
          next.nonStrikerId = match.toss.nonStrikerId;
          next.bowlerId = match.toss.bowlerId;
        }
      }
      next.result = undefined;
      return next;
    });
    setSheet(null);
    setToast("Correction saved; resume from the revised delivery");
  }

  if (editingTeams) {
    return (
      <>
        <MatchTeamEditorPage
          match={match}
          saving={savingTeams}
          onBack={() => {
            if (!savingTeams) setEditingTeams(false);
          }}
          onSave={saveTeamChanges}
        />
        {toast && <div className="score-toast">{toast}</div>}
      </>
    );
  }

  if (editingRules) {
    return (
      <>
        <MatchRulesEditorPage
          match={match}
          score={state}
          saving={savingRules}
          onBack={() => {
            if (!savingRules) setEditingRules(false);
          }}
          onSave={saveRuleChanges}
        />
        {toast && <div className="score-toast">{toast}</div>}
      </>
    );
  }

  if (state.phase === "completed") {
    const leaveCompleted = access.canScore ? completeAndExit : onExit;
    return (
      <main className="full-score-shell score-complete-page">
        <PageHeader
          title="Match complete"
          eyebrow="RESULT"
          onBack={leaveCompleted}
          backLabel="Back to match list"
          backLoading={exiting}
        />
        <div className="score-scroll">
          <section className="score-complete-hero">
            <span>MATCH COMPLETE</span>
            <h2>{state.result}</h2>
            <p>
              {match.teams[0].name} vs {match.teams[1].name}
            </p>
          </section>
          <div className="final-innings-list">
            {state.innings.map((item, index) => {
              const team = match.teams.find(
                (entry) => entry.id === item.battingTeamId,
              )!;
              return (
                <div key={team.id}>
                  <span>{index + 1}</span>
                  <strong>{team.name}</strong>
                  <b>
                    {item.runs}/{item.wickets}
                  </b>
                  <small>
                    {Math.floor(item.legalBalls / match.rules.ballsPerOver)}.
                    {item.legalBalls % match.rules.ballsPerOver} ov
                  </small>
                </div>
              );
            })}
          </div>
          {access.canScore && history.length > 0 && (
            <button
              type="button"
              className="score-secondary-action"
              onClick={undo}
              disabled={exiting}
            >
              Undo last delivery
            </button>
          )}
          <button
            type="button"
            className="score-primary-action"
            onClick={leaveCompleted}
            disabled={exiting}
          >
            {access.canScore && exiting ? "Saving match…" : "View match list"}
          </button>
        </div>
      </main>
    );
  }

  if (state.phase === "innings-break") {
    const secondBatting = fieldingTeam;
    const secondFielding = battingTeam;
    if (!access.canScore)
      return (
        <main className="full-score-shell innings-break-page">
          <PageHeader
            title="Innings break"
            eyebrow="VIEW ONLY"
            onBack={onExit}
            backLabel="Back to match list"
          />
          <div className="score-scroll">
            <section className="break-target">
              <span>TARGET</span>
              <strong>{innings.runs + 1}</strong>
              <p>
                {secondBatting.name} need {innings.runs + 1} runs to win
              </p>
            </section>
            <section className="score-view-only innings-view-only">
              <strong>Waiting for the assigned scorer</strong>
              <p>The second innings lineup will appear when scoring resumes.</p>
            </section>
          </div>
        </main>
      );
    return (
      <SecondInningsSetup
        batting={secondBatting}
        fielding={secondFielding}
        target={innings.runs + 1}
        exiting={exiting}
        onBack={pauseAndExit}
        onUndo={undo}
        onEditTeams={() => setEditingTeams(true)}
        onEditRules={() => setEditingRules(true)}
        onStart={startSecondInnings}
      />
    );
  }

  const displayedBatters = state.batterDisplayOrder || [
    state.strikerId,
    state.nonStrikerId,
  ];
  const availableBatters = battingTeam.players.filter(
    (player) =>
      !innings.dismissed.includes(player.id) &&
      player.id !== state.strikerId &&
      player.id !== state.nonStrikerId,
  );
  const draftIsLegal = isLegalDelivery(draft.extraType);
  const nextCompletesOver =
    draftIsLegal && (innings.legalBalls + 1) % match.rules.ballsPerOver === 0;
  const draftRuns = draft.batRuns + draft.extraRuns;
  const hasDraftSelection = Boolean(
    draft.runsSelected || draft.extraType || draft.wicket,
  );
  const canChangeBowler =
    access.canScore &&
    state.phase === "live" &&
    canChangeBowlerBeforeDelivery(
      innings.deliveries,
      innings.legalBalls,
      match.rules.ballsPerOver,
    );
  const previousOverBowlerId =
    innings.deliveries.length &&
    innings.legalBalls % match.rules.ballsPerOver === 0
      ? innings.deliveries[innings.deliveries.length - 1].bowlerId
      : undefined;
  const eligibleNextBowlers = fieldingTeam.players.filter(
    (player) => player.id !== previousOverBowlerId,
  );
  const pendingDeliveryNumber = `${Math.floor(innings.legalBalls / match.rules.ballsPerOver)}.${(innings.legalBalls % match.rules.ballsPerOver) + 1}`;
  const selectedRunValue = !draft.runsSelected
    ? null
    : draft.extraType === "wide"
      ? Math.max(0, draft.extraRuns - match.rules.widePenalty)
      : draft.extraType === "no-ball" && draft.runningExtraType
        ? Math.max(0, draft.extraRuns - match.rules.noBallPenalty)
        : draft.extraType === "bye" || draft.extraType === "leg-bye"
          ? draft.extraRuns
          : draft.batRuns;
  const draftDescription = [
    draft.extraType
      ? draft.extraType.replace("-", " ")
      : draft.runsSelected
        ? draft.batRuns
          ? `${draft.batRuns} bat run${draft.batRuns === 1 ? "" : "s"}`
          : "dot ball"
        : "",
    draft.wicket ? `${draft.wicket.type.replace("-", " ")} wicket` : "",
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <main className="full-score-shell">
      <PageHeader
        title="Live scoring"
        eyebrow={`${access.canScore ? "LIVE" : "VIEW ONLY"} · ${state.activeInnings === 0 ? "1ST" : "2ND"} INNINGS`}
        onBack={access.canScore ? pauseAndExit : onExit}
        backLabel="Back to match list"
        backLoading={exiting}
        action={
          <div className="score-header-actions">
            {(access.canScore || access.canManageScorer) && (
              <div className="score-header-menu-wrap">
                <button
                  type="button"
                  className="score-more-button"
                  aria-label="Match actions"
                  aria-haspopup="dialog"
                  aria-expanded={headerMenuOpen}
                  onClick={() => setHeaderMenuOpen((open) => !open)}
                  disabled={exiting}
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <circle cx="5" cy="12" r="1.7" />
                    <circle cx="12" cy="12" r="1.7" />
                    <circle cx="19" cy="12" r="1.7" />
                  </svg>
                </button>
                {headerMenuOpen && (
                  <div
                    className="score-menu-backdrop"
                    onMouseDown={() => setHeaderMenuOpen(false)}
                  >
                    <div
                      className="score-header-menu"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Match actions"
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <div className="sheet-handle" />
                      <div className="score-action-sheet-title">
                        <span>MATCH ACTIONS</span>
                        <button
                          type="button"
                          onClick={() => setHeaderMenuOpen(false)}
                          aria-label="Close match actions"
                        >
                          ×
                        </button>
                      </div>
                      <div className="score-action-list" role="menu">
                        {access.canManageScorer && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setHeaderMenuOpen(false);
                              setSheet("scorer");
                            }}
                          >
                            <span
                              className="score-action-icon"
                              aria-hidden="true"
                            >
                              ⇄
                            </span>
                            <span className="score-action-copy">
                              <strong>Change scorer</strong>
                              <small>
                                Assign exclusive scoring access to a club member
                              </small>
                            </span>
                            <span
                              className="score-action-chevron"
                              aria-hidden="true"
                            >
                              ›
                            </span>
                          </button>
                        )}
                        {access.canScore && (
                          <>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setHeaderMenuOpen(false);
                                setEditingTeams(true);
                              }}
                            >
                              <span
                                className="score-action-icon"
                                aria-hidden="true"
                              >
                                +
                              </span>
                              <span className="score-action-copy">
                                <strong>Edit teams</strong>
                                <small>
                                  View lineups, add players and correct
                                  temporary names
                                </small>
                              </span>
                              <span
                                className="score-action-chevron"
                                aria-hidden="true"
                              >
                                ›
                              </span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setHeaderMenuOpen(false);
                                setEditingRules(true);
                              }}
                            >
                              <span
                                className="score-action-icon"
                                aria-hidden="true"
                              >
                                ⚙
                              </span>
                              <span className="score-action-copy">
                                <strong>Edit playing rules</strong>
                                <small>
                                  Update overs, last-man batting, wicket limits
                                  and venue
                                </small>
                              </span>
                              <span
                                className="score-action-chevron"
                                aria-hidden="true"
                              >
                                ›
                              </span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setHeaderMenuOpen(false);
                                endInnings();
                              }}
                            >
                              <span
                                className="score-action-icon"
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                              <span className="score-action-copy">
                                <strong>End innings</strong>
                                <small>
                                  {state.activeInnings === 0
                                    ? "Move to the innings break"
                                    : "Finish with the current score"}
                                </small>
                              </span>
                              <span
                                className="score-action-chevron"
                                aria-hidden="true"
                              >
                                ›
                              </span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="warning"
                              onClick={() => {
                                setHeaderMenuOpen(false);
                                void abandonMatch();
                              }}
                            >
                              <span
                                className="score-action-icon"
                                aria-hidden="true"
                              >
                                !
                              </span>
                              <span className="score-action-copy">
                                <strong>Abandon match</strong>
                                <small>Keep the score without a result</small>
                              </span>
                              <span
                                className="score-action-chevron"
                                aria-hidden="true"
                              >
                                ›
                              </span>
                            </button>
                          </>
                        )}
                        {access.canManageScorer && (
                          <button
                            type="button"
                            role="menuitem"
                            className="danger"
                            onClick={() => {
                              setHeaderMenuOpen(false);
                              void removeCurrentMatch();
                            }}
                          >
                            <span
                              className="score-action-icon"
                              aria-hidden="true"
                            >
                              ×
                            </span>
                            <span className="score-action-copy">
                              <strong>Remove match</strong>
                              <small>Permanently delete this match</small>
                            </span>
                            <span
                              className="score-action-chevron"
                              aria-hidden="true"
                            >
                              ›
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <button
              type="button"
              className="page-header-text-action"
              onClick={access.canScore ? pauseAndExit : onExit}
              disabled={exiting}
            >
              {access.canScore ? (
                exiting ? (
                  <>
                    <span
                      className="page-header-spinner small"
                      aria-hidden="true"
                    />{" "}
                    Saving
                  </>
                ) : (
                  "Pause"
                )
              ) : (
                "Viewing"
              )}
            </button>
          </div>
        }
      />
      <div className="score-scroll">
        <section className="live-scoreboard">
          <div className="live-score-meta">
            <span className="live-batting-team">
              {battingTeam.name.toUpperCase()}
            </span>
            <div className="score-status">
              <span className="live-dot" />{" "}
              {syncStatus === "synced"
                ? "Synced"
                : syncStatus === "pending"
                  ? "Sync pending"
                  : syncStatus === "conflict"
                    ? "Conflict — reload required"
                    : syncStatus === "restoring"
                      ? "Restoring"
                      : "Saved on this device"}{" "}
              {state.freeHit && <b>FREE HIT</b>}
            </div>
          </div>
          <div className="live-score-main">
            <div>
              <strong>
                {innings.runs}
                <small>/{innings.wickets}</small>
              </strong>
            </div>
            <div>
              <b>
                {Math.floor(innings.legalBalls / match.rules.ballsPerOver)}.
                {innings.legalBalls % match.rules.ballsPerOver}
              </b>
              <span>OVERS</span>
            </div>
          </div>
          <div className="score-context">
            {target ? (
              <>
                <span>
                  Target <strong>{target}</strong>
                </span>
                <span>
                  Need <strong>{Math.max(0, target - innings.runs)}</strong>{" "}
                  from <strong>{ballsRemaining}</strong>
                </span>
              </>
            ) : (
              <>
                <span>
                  Run rate{" "}
                  <strong>
                    {innings.legalBalls
                      ? (
                          (innings.runs * match.rules.ballsPerOver) /
                          innings.legalBalls
                        ).toFixed(2)
                      : "0.00"}
                  </strong>
                </span>
                <span>{match.rules.overs} over match</span>
              </>
            )}
          </div>
        </section>
        <nav className="scoring-tabs" aria-label="Scoring views">
          {(
            [
              ["live", "Live score"],
              ["scorecard", "Scorecard"],
              ["history", "History"],
            ] as const
          ).map(([tab, label]) => (
            <button
              type="button"
              key={tab}
              className={activeTab === tab ? "active" : ""}
              aria-current={activeTab === tab ? "page" : undefined}
              onClick={() => setActiveTab(tab)}
            >
              {label}
            </button>
          ))}
        </nav>
        {activeTab === "live" && (
          <>
            <section className="live-player-panel">
              {displayedBatters
                .filter(
                  (id, index) => index === 0 || id !== displayedBatters[0],
                )
                .map((batterId) => {
                  const figures = batterFigures.get(batterId) || {
                    runs: 0,
                    balls: 0,
                  };
                  const onStrike = batterId === state.strikerId;
                  return (
                    <div key={batterId}>
                      <span className={onStrike ? "on-strike" : ""}>
                        {onStrike ? "*" : ""}
                      </span>
                      <p>
                        <strong>{playerName(battingTeam, batterId)}</strong>
                        <small>{onStrike ? "STRIKER" : "NON-STRIKER"}</small>
                      </p>
                      <b>
                        {figures.runs}
                        <small>{figures.balls} balls</small>
                      </b>
                    </div>
                  );
                })}
              <footer>
                <span>Bowler</span>
                <strong>
                  {playerName(fieldingTeam, state.bowlerId)}
                  {canChangeBowler && (
                    <button
                      type="button"
                      className="change-bowler-button"
                      onClick={reselectBowler}
                    >
                      Change
                    </button>
                  )}
                </strong>
                <span>
                  {Math.floor(bowlerFigures.balls / match.rules.ballsPerOver)}.
                  {bowlerFigures.balls % match.rules.ballsPerOver}–
                  {bowlerFigures.runs}–{bowlerFigures.wickets}
                </span>
              </footer>
            </section>
            <section className="live-over-strip">
              <span>THIS OVER</span>
              <div>
                {thisOver.length ? (
                  thisOver.map((delivery) => (
                    <i
                      key={delivery.id}
                      className={delivery.wicket ? "wicket" : ""}
                    >
                      {delivery.label}
                    </i>
                  ))
                ) : (
                  <small>First ball of the over</small>
                )}
              </div>
            </section>
            {access.canScore ? (
              <section className="live-controls">
                <div className="live-control-head">
                  <div>
                    <span>ADD DELIVERY</span>
                    <strong>
                      {draft.extraType === "wide"
                        ? "Additional wide runs"
                        : draft.runningExtraType === "bye" ||
                            draft.extraType === "bye"
                          ? "Completed bye runs"
                          : draft.runningExtraType === "leg-bye" ||
                              draft.extraType === "leg-bye"
                            ? "Completed leg-bye runs"
                            : "Runs off the bat"}
                    </strong>
                  </div>
                  <div className="live-control-actions">
                    <button type="button" onClick={correctStrike}>
                      ⇄ Swap strike
                    </button>
                    <button
                      type="button"
                      onClick={handleUndo}
                      disabled={!history.length && !hasDraftSelection}
                    >
                      ↶ Undo
                    </button>
                  </div>
                </div>
                <div className="live-run-grid">
                  {[0, 1, 2, 3, 4, 6].map((run) => (
                    <button
                      type="button"
                      key={run}
                      className={selectedRunValue === run ? "selected" : ""}
                      onClick={() => selectRuns(run)}
                    >
                      {run}
                    </button>
                  ))}
                </div>
                {(draft.batRuns === 4 || draft.batRuns === 6) &&
                  !draft.extraType && (
                    <button
                      type="button"
                      className="boundary-toggle"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          boundary: current.boundary
                            ? undefined
                            : (current.batRuns as 4 | 6),
                        }))
                      }
                    >
                      {draft.boundary
                        ? `Boundary ${draft.boundary}`
                        : `${draft.batRuns} completed by running`}
                    </button>
                  )}
                <div className="delivery-option-grid">
                  <button
                    type="button"
                    className={draft.extraType === "wide" ? "selected" : ""}
                    onClick={() => selectDirectExtra("wide")}
                  >
                    <span>WD</span>
                    <strong>Wide</strong>
                  </button>
                  <button
                    type="button"
                    className={draft.extraType === "no-ball" ? "selected" : ""}
                    onClick={() => selectDirectExtra("no-ball")}
                  >
                    <span>NB</span>
                    <strong>No ball</strong>
                  </button>
                  <button
                    type="button"
                    className={
                      draft.extraType === "bye" ||
                      draft.runningExtraType === "bye"
                        ? "selected"
                        : ""
                    }
                    onClick={() => selectDirectExtra("bye")}
                  >
                    <span>B</span>
                    <strong>Bye</strong>
                  </button>
                  <button
                    type="button"
                    className={
                      draft.extraType === "leg-bye" ||
                      draft.runningExtraType === "leg-bye"
                        ? "selected"
                        : ""
                    }
                    onClick={() => selectDirectExtra("leg-bye")}
                  >
                    <span>LB</span>
                    <strong>Leg bye</strong>
                  </button>
                  <button
                    type="button"
                    className={`wicket ${draft.wicket ? "selected" : ""}`}
                    onClick={() => {
                      const restricted =
                        state.freeHit || draft.extraType === "no-ball";
                      setDismissedPlayer(state.strikerId);
                      setDismissalType(
                        restricted ? "run-out" : draft.wicket?.type || "bowled",
                      );
                      setFielderId("");
                      setSurvivingEnd("striker");
                      setSheet("wicket");
                    }}
                  >
                    <span>W</span>
                    <strong>Wicket</strong>
                  </button>
                </div>
                <div className="delivery-draft">
                  <div>
                    <span>DELIVERY: {pendingDeliveryNumber}</span>
                    <strong>
                      {hasDraftSelection ? draftDescription : "–"}
                    </strong>
                    <small>
                      {hasDraftSelection
                        ? `${draftRuns} run${draftRuns === 1 ? "" : "s"} · ${draftIsLegal ? "legal ball" : "does not count in over"}`
                        : "–"}
                    </small>
                  </div>
                </div>
                <button
                  type="button"
                  className="next-delivery-button"
                  onClick={commitDraft}
                  disabled={committing || !hasDraftSelection}
                >
                  <span>
                    {nextCompletesOver
                      ? "Save & Next over"
                      : "Save & Next ball"}
                  </span>
                  <b>→</b>
                </button>
              </section>
            ) : (
              <section className="score-view-only">
                <strong>Viewing live score</strong>
                <p>
                  Only the assigned scorer can add deliveries. This page
                  refreshes automatically.
                </p>
              </section>
            )}
          </>
        )}
        {activeTab === "scorecard" && (
          <LiveMatchScorecard match={match} state={state} />
        )}
        {activeTab === "history" && (
          <BallByBallHistory
            match={match}
            state={state}
            onRemove={
              access.canScore
                ? (deliveryId) => repairFromDelivery(deliveryId, true)
                : undefined
            }
          />
        )}
      </div>

      {sheet === "wicket" && (
        <div
          className="score-sheet-backdrop"
          onMouseDown={() => setSheet(null)}
        >
          <div
            className="score-sheet"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <h2>Record wicket</h2>
            <p>
              Run-out keeps the selected runs. Other dismissals record a
              zero-run wicket.
            </p>
            <label>
              <span>Dismissed player</span>
              <select
                value={dismissedPlayer}
                onChange={(event) => setDismissedPlayer(event.target.value)}
              >
                <option value={state.strikerId}>
                  {playerName(battingTeam, state.strikerId)}
                </option>
                <option value={state.nonStrikerId}>
                  {playerName(battingTeam, state.nonStrikerId)}
                </option>
              </select>
            </label>
            <label>
              <span>Dismissal</span>
              <select
                value={dismissalType}
                onChange={(event) =>
                  setDismissalType(event.target.value as DismissalType)
                }
              >
                {allowedDismissals(state.freeHit, draft.extraType).map(
                  (type) => (
                    <option key={type} value={type}>
                      {type.replace("-", " ")}
                    </option>
                  ),
                )}
              </select>
            </label>
            {["caught", "stumped", "run-out"].includes(dismissalType) && (
              <label>
                <span>
                  Fielder <i>Optional</i>
                </span>
                <select
                  value={fielderId}
                  onChange={(event) => setFielderId(event.target.value)}
                >
                  <option value="">Not recorded</option>
                  {fieldingTeam.players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {dismissalType === "run-out" && (
              <label>
                <span>Surviving batter's end</span>
                <select
                  value={survivingEnd}
                  onChange={(event) =>
                    setSurvivingEnd(
                      event.target.value as "striker" | "non-striker",
                    )
                  }
                >
                  <option value="striker">On strike</option>
                  <option value="non-striker">Non-striker's end</option>
                </select>
              </label>
            )}
            <button
              type="button"
              className="score-primary-action danger"
              onClick={() => {
                const wicket = {
                  playerId: dismissedPlayer,
                  type: dismissalType,
                  fielderId: fielderId || undefined,
                  survivingEnd:
                    dismissalType === "run-out" ? survivingEnd : undefined,
                };
                setDraft((current) =>
                  dismissalType === "run-out"
                    ? { ...current, wicket }
                    : {
                        batRuns: 0,
                        extraRuns:
                          current.extraType === "no-ball"
                            ? current.extraRuns
                            : 0,
                        extraType:
                          current.extraType === "no-ball"
                            ? "no-ball"
                            : undefined,
                        wicket,
                      },
                );
                setSheet(null);
              }}
            >
              Add wicket to delivery
            </button>
          </div>
        </div>
      )}
      {sheet === "scorer" && (
        <div
          className="score-sheet-backdrop"
          onMouseDown={() => setSheet(null)}
        >
          <div
            className="score-sheet"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <span className="score-sheet-kicker">MATCH ACCESS</span>
            <h2>Change scorer</h2>
            <p>
              Only the selected club member can update this match. Everyone else
              keeps view-only access.
            </p>
            <label>
              <span>Assigned scorer</span>
              <select
                value={scorerId}
                onChange={(event) => setScorerId(event.target.value)}
              >
                {scorerOptions.map((member) => (
                  <option value={member.userId} key={member.userId}>
                    {member.email || `${member.role} member`} · {member.role}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="score-primary-action"
              disabled={!scorerId || changingScorer}
              onClick={() => void assignScorer()}
            >
              {changingScorer ? "Updating scorer…" : "Assign scorer"}
            </button>
          </div>
        </div>
      )}
      {access.canScore && changingBowler && (
        <SelectionSheet
          title="Change bowler"
          subtitle="NO DELIVERY RECORDED"
          players={eligibleNextBowlers}
          onSelect={chooseBowler}
          onEditTeams={() => setEditingTeams(true)}
          onDismiss={() => setChangingBowler(false)}
        />
      )}
      {access.canScore && state.phase === "new-batter" && (
        <SelectionSheet
          title="Choose the next batter"
          subtitle={`${innings.wickets} wicket${innings.wickets === 1 ? "" : "s"} down`}
          players={availableBatters}
          onSelect={chooseNewBatter}
          onEditTeams={() => setEditingTeams(true)}
        />
      )}
      {access.canScore && state.phase === "new-bowler" && (
        <SelectionSheet
          title="Choose the next bowler"
          subtitle={`Over ${Math.floor(innings.legalBalls / match.rules.ballsPerOver) + 1}`}
          players={eligibleNextBowlers}
          onSelect={chooseBowler}
          onEditTeams={() => setEditingTeams(true)}
        />
      )}
      {toast && <div className="score-toast">{toast}</div>}
    </main>
  );
}

function LiveMatchScorecard({
  match,
  state,
}: {
  match: CricketMatch;
  state: ScoreState;
}) {
  const [selectedInningsIndex, setSelectedInningsIndex] = useState(
    state.activeInnings,
  );
  const firstBatting = firstBattingTeam(match);
  const inningsTeams: [MatchTeam, MatchTeam] = [
    firstBatting,
    match.teams.find((team) => team.id !== firstBatting.id)!,
  ];
  const battingTeam = inningsTeams[selectedInningsIndex] || inningsTeams[0];
  const recordedInnings = state.innings.find(
    (innings) => innings.battingTeamId === battingTeam.id,
  );
  const selectedInnings = recordedInnings || {
    battingTeamId: battingTeam.id,
    runs: 0,
    wickets: 0,
    legalBalls: 0,
    deliveries: [],
    dismissed: [],
  };
  const bowlingTeam = match.teams.find(
    (team) => team.id !== selectedInnings.battingTeamId,
  )!;
  const battingFigures = new Map<
    string,
    { runs: number; balls: number; fours: number; sixes: number }
  >();
  const bowlingFigures = new Map<
    string,
    { runs: number; balls: number; wickets: number }
  >();
  const dismissals = new Map<string, string>();

  selectedInnings.deliveries.forEach((delivery) => {
    const batter = battingFigures.get(delivery.strikerId) || {
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
    };
    batter.runs += delivery.batRuns;
    if (delivery.legal) batter.balls += 1;
    if (delivery.boundary === 4) batter.fours += 1;
    if (delivery.boundary === 6) batter.sixes += 1;
    battingFigures.set(delivery.strikerId, batter);
    battingFigures.set(
      delivery.nonStrikerId,
      battingFigures.get(delivery.nonStrikerId) || {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
      },
    );
    if (delivery.wicket) {
      battingFigures.set(
        delivery.wicket.playerId,
        battingFigures.get(delivery.wicket.playerId) || {
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
        },
      );
      const fielder = delivery.wicket.fielderId
        ? bowlingTeam.players.find(
            (player) => player.id === delivery.wicket?.fielderId,
          )?.name
        : undefined;
      const dismissal = delivery.wicket.type.replace("-", " ");
      dismissals.set(
        delivery.wicket.playerId,
        fielder ? `${dismissal}, ${fielder}` : dismissal,
      );
    }
  });

  selectedInnings.deliveries.forEach((delivery) => {
    const bowler = bowlingFigures.get(delivery.bowlerId) || {
      runs: 0,
      balls: 0,
      wickets: 0,
    };
    bowler.runs += bowlerConcededRuns(delivery, match.rules.noBallPenalty);
    if (delivery.legal) bowler.balls += 1;
    if (delivery.wicket && delivery.wicket.type !== "run-out")
      bowler.wickets += 1;
    bowlingFigures.set(delivery.bowlerId, bowler);
  });

  const isActiveInnings = Boolean(
    recordedInnings && recordedInnings === state.innings[state.activeInnings],
  );
  if (isActiveInnings) {
    battingFigures.set(
      state.strikerId,
      battingFigures.get(state.strikerId) || {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
      },
    );
    battingFigures.set(
      state.nonStrikerId,
      battingFigures.get(state.nonStrikerId) || {
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
      },
    );
  }
  const extrasByType = { wide: 0, noBall: 0, bye: 0, legBye: 0 };
  selectedInnings.deliveries.forEach((delivery) => {
    if (delivery.extraType === "wide") extrasByType.wide += delivery.extraRuns;
    if (delivery.extraType === "no-ball")
      extrasByType.noBall += delivery.extraRuns;
    if (delivery.extraType === "bye") extrasByType.bye += delivery.extraRuns;
    if (delivery.extraType === "leg-bye")
      extrasByType.legBye += delivery.extraRuns;
  });
  const extras = Object.values(extrasByType).reduce(
    (total, value) => total + value,
    0,
  );
  const score = `${selectedInnings.runs}/${selectedInnings.wickets}`;
  const overs = `${Math.floor(selectedInnings.legalBalls / match.rules.ballsPerOver)}.${selectedInnings.legalBalls % match.rules.ballsPerOver}`;
  const battedPlayers = battingTeam.players.filter((player) =>
    battingFigures.has(player.id),
  );
  const yetToBat = battingTeam.players.filter(
    (player) => !battingFigures.has(player.id),
  );
  const bowlers = bowlingTeam.players.filter((player) =>
    bowlingFigures.has(player.id),
  );

  return (
    <section className="live-scorecard-view">
      <div className="live-scorecard-heading">
        <div>
          <span>MATCH SCORECARD</span>
          <h2>
            {match.teams[0].name} vs {match.teams[1].name}
          </h2>
        </div>
      </div>
      <div
        className="scorecard-team-tabs scorecard-innings-tabs"
        role="tablist"
        aria-label="Scorecard innings"
      >
        {inningsTeams.map((team, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={selectedInningsIndex === index}
            className={selectedInningsIndex === index ? "active" : ""}
            key={team.id}
            onClick={() => setSelectedInningsIndex(index)}
          >
            {" "}
            {team.name}
          </button>
        ))}
      </div>
      <article className="detailed-scorecard">
        <header className="pb-3">
          <span>
            <small>
              {selectedInningsIndex + 1}
              {selectedInningsIndex === 0 ? "ST" : "ND"} INNINGS
            </small>
            <strong>{battingTeam.name}</strong>
          </span>
          {recordedInnings ? (
            <b>
              {score} <small>({overs})</small>
            </b>
          ) : (
            <b className="innings-not-started">Yet to bat</b>
          )}
        </header>
        <h3>Batting</h3>
        <div className="batting-table scorecard-table">
          <div className="scorecard-table-head">
            <span>BATTER</span>
            <span>R</span>
            <span>B</span>
            <span>4</span>
            <span>6</span>
            <span>SR</span>
          </div>
          {battedPlayers.map((player) => {
            const figures = battingFigures.get(player.id)!;
            const status = dismissals.get(player.id) || "Not out";
            const strikeRate = figures.balls
              ? ((figures.runs * 100) / figures.balls).toFixed(1)
              : "—";
            return (
              <div className="scorecard-table-row batting-row" key={player.id}>
                <span className="scorecard-player">
                  <strong>
                    {player.name}
                    {isActiveInnings && player.id === state.strikerId
                      ? " *"
                      : ""}
                  </strong>
                  <small>{status}</small>
                </span>
                <span>{figures.runs}</span>
                <span>{figures.balls}</span>
                <span>{figures.fours}</span>
                <span>{figures.sixes}</span>
                <span>{strikeRate}</span>
              </div>
            );
          })}
        </div>
        {yetToBat.length > 0 && (
          <div className="yet-to-bat">
            <strong>Yet to bat</strong>
            <div>
              {yetToBat.map((player) => (
                <span key={player.id}>{player.name}</span>
              ))}
            </div>
          </div>
        )}
        <div className="scorecard-extras">
          <span>
            <strong>Extras</strong>
            <small>
              Wd {extrasByType.wide} · Nb {extrasByType.noBall} · B{" "}
              {extrasByType.bye} · Lb {extrasByType.legBye}
            </small>
          </span>
          <b>{extras}</b>
        </div>
        <h3>{bowlingTeam.name} bowling</h3>
        <div className="bowling-table scorecard-table">
          <div className="scorecard-table-head">
            <span>BOWLER</span>
            <span>O</span>
            <span>R</span>
            <span>W</span>
            <span>ECON</span>
          </div>
          {bowlers.map((player) => {
            const figures = bowlingFigures.get(player.id)!;
            const oversBowled = `${Math.floor(figures.balls / match.rules.ballsPerOver)}.${figures.balls % match.rules.ballsPerOver}`;
            const economy = figures.balls
              ? (
                  (figures.runs * match.rules.ballsPerOver) /
                  figures.balls
                ).toFixed(2)
              : "—";
            return (
              <div className="scorecard-table-row bowling-row" key={player.id}>
                <span className="scorecard-player">
                  <strong>{player.name}</strong>
                </span>
                <span>{oversBowled}</span>
                <span>{figures.runs}</span>
                <span>{figures.wickets}</span>
                <span>{economy}</span>
              </div>
            );
          })}
        </div>
        {!bowlers.length && (
          <p className="scorecard-no-bowling">No bowling figures yet.</p>
        )}
      </article>
    </section>
  );
}

function BallByBallHistory({
  match,
  state,
  onRemove,
}: {
  match: CricketMatch;
  state: ScoreState;
  onRemove?: (deliveryId: string) => void;
}) {
  const hasDeliveries = state.innings.some(
    (item) => item.deliveries.length > 0,
  );
  return (
    <section className="ball-history-view">
      {!hasDeliveries && (
        <div className="score-tab-empty">
          <strong>No deliveries yet</strong>
          <p>Saved balls will appear here as the match progresses.</p>
        </div>
      )}
      {state.innings
        .map((item, inningsIndex) => ({ item, inningsIndex }))
        .reverse()
        .map(({ item, inningsIndex }) => {
        if (!item.deliveries.length) return null;
        const batting = match.teams.find(
          (team) => team.id === item.battingTeamId,
        )!;
        const fielding = match.teams.find(
          (team) => team.id !== item.battingTeamId,
        )!;
        let legalBalls = 0;
        const newestFirst = item.deliveries
          .map((delivery) => {
            const ball = `${Math.floor(legalBalls / match.rules.ballsPerOver)}.${(legalBalls % match.rules.ballsPerOver) + 1}`;
            if (delivery.legal) legalBalls += 1;
            return { delivery, ball };
          })
          .reverse();
        return (
          <article
            className="ball-history-innings"
            key={`${item.battingTeamId}-${inningsIndex}`}
          >
            <header>
              <div>
                <span>{inningsIndex + 1} INNINGS</span>
                <strong>{batting.name}</strong>
              </div>
              <b>
                {item.runs}/{item.wickets}
              </b>
            </header>
            <div className="ball-history-list">
              {newestFirst.map(({ delivery, ball }) => {
                const detail = delivery.wicket
                  ? `${delivery.wicket.type.replace("-", " ")} · ${delivery.label}`
                  : delivery.extraType
                    ? `${delivery.extraType.replace("-", " ")} · ${delivery.label}`
                    : delivery.batRuns
                      ? `${delivery.batRuns} run${delivery.batRuns === 1 ? "" : "s"}`
                      : "Dot ball";
                const removable =
                  inningsIndex === state.activeInnings && onRemove;
                return (
                  <div
                    className={delivery.wicket ? "wicket" : ""}
                    key={delivery.id}
                  >
                    <span className="ball-number">{ball}</span>
                    <span className="ball-event">
                      <strong>
                        {playerName(fielding, delivery.bowlerId)} <i>to</i>{" "}
                        {playerName(batting, delivery.strikerId)}
                      </strong>
                      <small>{detail}</small>
                    </span>
                    <b>{delivery.label}</b>
                    {removable && (
                      <span className="ball-actions">
                        <button
                          type="button"
                          className="danger"
                          onClick={() => onRemove(delivery.id)}
                        >
                          Remove
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function SelectionSheet({
  title,
  subtitle,
  players,
  onSelect,
  onEditTeams,
  onDismiss,
}: {
  title: string;
  subtitle: string;
  players: MatchPlayer[];
  onSelect: (id: string) => void;
  onEditTeams: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      className={`score-sheet-backdrop${onDismiss ? "" : " locked"}`}
      onMouseDown={onDismiss}
    >
      <div
        className="score-sheet"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <span className="score-sheet-kicker">{subtitle}</span>
        <div className="selection-sheet-heading">
          <h2>{title}</h2>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Close bowler selection"
            >
              ×
            </button>
          )}
        </div>
        <div className="score-player-choices">
          {players.map((player) => (
            <button
              type="button"
              key={player.id}
              onClick={() => onSelect(player.id)}
            >
              <span>{player.name.slice(0, 2).toUpperCase()}</span>
              <strong>{player.name}</strong>
              <b>›</b>
            </button>
          ))}
        </div>
        {!players.length && (
          <p className="selection-empty-copy">
            No eligible players remain in this team.
          </p>
        )}
        <button
          type="button"
          className="score-secondary-action selection-add-player"
          onClick={onEditTeams}
        >
          Add player to teams
        </button>
        {onDismiss && (
          <button
            type="button"
            className="selection-keep-current"
            onClick={onDismiss}
          >
            Keep current bowler
          </button>
        )}
      </div>
    </div>
  );
}

function MatchTeamEditorPage({
  match,
  saving,
  onBack,
  onSave,
}: {
  match: CricketMatch;
  saving: boolean;
  onBack: () => void;
  onSave: (
    additions: Array<{
      teamId: MatchTeam["id"];
      name?: string;
      playerId?: string;
    }>,
    renames: Array<{ playerId: string; name: string }>,
    teamNames: Array<{ teamId: MatchTeam["id"]; name: string }>,
  ) => Promise<void>;
}) {
  const [playerNames, setPlayerNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      match.teams.flatMap((team) =>
        team.players.map((player) => [player.id, player.name]),
      ),
    ),
  );
  const [teamNames, setTeamNames] = useState<Record<MatchTeam["id"], string>>({
    "team-a": match.teams[0].name,
    "team-b": match.teams[1].name,
  });
  const [temporaryAdditions, setTemporaryAdditions] = useState<
    Record<MatchTeam["id"], string[]>
  >({
    "team-a": [""],
    "team-b": [""],
  });
  const [rosterAdditions, setRosterAdditions] = useState<
    Record<MatchTeam["id"], string[]>
  >({
    "team-a": [],
    "team-b": [],
  });

  const selectedRosterIds = new Set([
    ...rosterAdditions["team-a"],
    ...rosterAdditions["team-b"],
  ]);
  const additions: Array<{
    teamId: MatchTeam["id"];
    name?: string;
    playerId?: string;
  }> = [];
  match.teams.forEach((team) => {
    const options = match.playerAdditionOptions?.[team.id];
    const kind =
      options?.kind ||
      (match.mode === "quick" ||
      (match.mode === "club-external" && team.id === "team-b")
        ? "temporary"
        : "roster");
    if (kind === "roster") {
      rosterAdditions[team.id].forEach((playerId) =>
        additions.push({ teamId: team.id, playerId }),
      );
    } else {
      temporaryAdditions[team.id].forEach((name) => {
        if (name.trim()) additions.push({ teamId: team.id, name: name.trim() });
      });
    }
  });
  const renames = match.teams.flatMap((team) =>
    team.players.flatMap((player) => {
      const name = playerNames[player.id]?.trim() || "";
      return player.source === "temporary" && name && name !== player.name
        ? [{ playerId: player.id, name }]
        : [];
    }),
  );
  const changedTeamNames = match.teams.flatMap((team) => {
    const name = teamNames[team.id].trim();
    const canRename =
      match.mode === "quick" ||
      (match.mode === "club-external" && team.id === "team-b");
    return canRename && name && name !== team.name
      ? [{ teamId: team.id, name }]
      : [];
  });
  const hasBlankExistingName = match.teams.some((team) =>
    team.players.some(
      (player) =>
        player.source === "temporary" && !playerNames[player.id]?.trim(),
    ),
  );
  const hasBlankTeamName = match.teams.some((team) => {
    const canRename =
      match.mode === "quick" ||
      (match.mode === "club-external" && team.id === "team-b");
    return canRename && !teamNames[team.id].trim();
  });
  const hasChanges =
    additions.length > 0 || renames.length > 0 || changedTeamNames.length > 0;

  function toggleRosterPlayer(teamId: MatchTeam["id"], playerId: string) {
    setRosterAdditions((current) => ({
      ...current,
      [teamId]: current[teamId].includes(playerId)
        ? current[teamId].filter((id) => id !== playerId)
        : [...current[teamId], playerId],
    }));
  }

  function updatePendingName(
    teamId: MatchTeam["id"],
    index: number,
    value: string,
  ) {
    setTemporaryAdditions((current) => ({
      ...current,
      [teamId]: current[teamId].map((name, itemIndex) =>
        itemIndex === index ? value : name,
      ),
    }));
  }

  return (
    <main className="full-score-shell match-team-editor-page">
      <PageHeader
        title="Edit teams"
        eyebrow="MATCH SETTINGS"
        onBack={onBack}
        backLabel="Back to scoring"
        action={
          <button
            type="button"
            className="page-header-text-action"
            disabled={
              saving || !hasChanges || hasBlankExistingName || hasBlankTeamName
            }
            onClick={() => void onSave(additions, renames, changedTeamNames)}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        }
      />
      <div className="score-scroll match-team-editor-scroll">
        <section className="team-editor-intro">
          <span className="eyebrow">LIVE MATCH</span>
          <h2>Manage team players</h2>
          <p>
            Add players who join after the match starts. Temporary player and
            team names can be corrected here without changing recorded
            deliveries.
          </p>
        </section>
        {match.teams.map((team, teamIndex) => {
          const options = match.playerAdditionOptions?.[team.id];
          const kind =
            options?.kind ||
            (match.mode === "quick" ||
            (match.mode === "club-external" && team.id === "team-b")
              ? "temporary"
              : "roster");
          const canRenameTeam =
            match.mode === "quick" ||
            (match.mode === "club-external" && team.id === "team-b");
          return (
            <section className="team-editor-card" key={team.id}>
              <header>
                <span>TEAM {teamIndex === 0 ? "A" : "B"}</span>
                {canRenameTeam ? (
                  <input
                    aria-label={`Name for team ${teamIndex === 0 ? "A" : "B"}`}
                    value={teamNames[team.id]}
                    maxLength={80}
                    onChange={(event) =>
                      setTeamNames((current) => ({
                        ...current,
                        [team.id]: event.target.value,
                      }))
                    }
                  />
                ) : (
                  <h3>{team.name}</h3>
                )}
                <small>
                  {team.players.length +
                    additions.filter((addition) => addition.teamId === team.id)
                      .length}{" "}
                  players after saving
                </small>
              </header>
              <div className="team-editor-section-title">
                <strong>Current players</strong>
                <span>{team.players.length}</span>
              </div>
              <div className="team-current-player-list">
                {team.players.map((player, index) => (
                  <label key={player.id}>
                    <span>{index + 1}</span>
                    {player.source === "temporary" ? (
                      <input
                        value={playerNames[player.id] || ""}
                        maxLength={80}
                        aria-label={`Name for player ${index + 1} in ${team.name}`}
                        onChange={(event) =>
                          setPlayerNames((current) => ({
                            ...current,
                            [player.id]: event.target.value,
                          }))
                        }
                      />
                    ) : (
                      <strong>{player.name}</strong>
                    )}
                    <small>
                      {player.source === "temporary"
                        ? "Editable"
                        : "Club roster"}
                    </small>
                  </label>
                ))}
              </div>
              <div className="team-editor-section-title available">
                <strong>
                  {kind === "roster"
                    ? "Available club players"
                    : "Players joining"}
                </strong>
              </div>
              {kind === "roster" ? (
                options?.players.length ? (
                  <div className="available-roster-list">
                    {options.players.map((player) => {
                      const selectedHere = rosterAdditions[team.id].includes(
                        player.id,
                      );
                      const selectedElsewhere =
                        selectedRosterIds.has(player.id) && !selectedHere;
                      return (
                        <button
                          type="button"
                          key={player.id}
                          className={selectedHere ? "selected" : ""}
                          disabled={selectedElsewhere}
                          onClick={() => toggleRosterPlayer(team.id, player.id)}
                        >
                          <span>{selectedHere ? "✓" : "+"}</span>
                          <strong>{player.name}</strong>
                          <small>
                            {selectedElsewhere
                              ? "Selected for other team"
                              : selectedHere
                                ? "Will be added"
                                : "Add to team"}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="team-editor-empty">
                    Every active club player is already in this match.
                  </p>
                )
              ) : (
                <div className="joining-player-list">
                  {temporaryAdditions[team.id].map((name, index) => (
                    <div key={index}>
                      <span>{team.players.length + index + 1}</span>
                      <input
                        value={name}
                        maxLength={80}
                        placeholder="New player name"
                        aria-label={`New player ${index + 1} for ${team.name}`}
                        onChange={(event) =>
                          updatePendingName(team.id, index, event.target.value)
                        }
                      />
                      {temporaryAdditions[team.id].length > 1 && (
                        <button
                          type="button"
                          aria-label="Remove unsaved player"
                          onClick={() =>
                            setTemporaryAdditions((current) => ({
                              ...current,
                              [team.id]: current[team.id].filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            }))
                          }
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="add-another-player"
                    onClick={() =>
                      setTemporaryAdditions((current) => ({
                        ...current,
                        [team.id]: [...current[team.id], ""],
                      }))
                    }
                  >
                    + Add another player
                  </button>
                </div>
              )}
            </section>
          );
        })}
        <button
          type="button"
          className="score-primary-action team-editor-save"
          disabled={
            saving || !hasChanges || hasBlankExistingName || hasBlankTeamName
          }
          onClick={() => void onSave(additions, renames, changedTeamNames)}
        >
          {saving ? "Saving team changes…" : "Save team changes"}
        </button>
        <p className="team-editor-note">
          Existing players cannot be removed during a match yet.
        </p>
      </div>
    </main>
  );
}

function MatchRulesEditorPage({
  match,
  score,
  saving,
  onBack,
  onSave,
}: {
  match: CricketMatch;
  score: MatchScoreState;
  saving: boolean;
  onBack: () => void;
  onSave: (
    rules: Pick<MatchRules, "overs" | "lastMan" | "wicketLimits" | "venue">,
  ) => Promise<void>;
}) {
  const minimumOvers = Math.max(
    1,
    ...score.innings.map((innings) =>
      Math.ceil(innings.legalBalls / match.rules.ballsPerOver),
    ),
  );
  const wicketsByTeam = Object.fromEntries(
    match.teams.map((team) => [
      team.id,
      score.innings.find((innings) => innings.battingTeamId === team.id)
        ?.wickets || 0,
    ]),
  ) as Record<MatchTeam["id"], number>;
  const [overs, setOvers] = useState(match.rules.overs);
  const [lastMan, setLastMan] = useState(match.rules.lastMan);
  const [venue, setVenue] = useState(match.rules.venue || "");
  const [wicketLimits, setWicketLimits] = useState(match.rules.wicketLimits);
  const maximumWickets = (team: MatchTeam) =>
    Math.max(1, team.players.length - (lastMan ? 0 : 1));
  const invalidWicketLimit = match.teams.some((team) => {
    const value =
      team.id === "team-a" ? wicketLimits.teamA : wicketLimits.teamB;
    return (
      !Number.isInteger(value) ||
      value < Math.max(1, wicketsByTeam[team.id]) ||
      value > maximumWickets(team)
    );
  });
  const hasChanges =
    overs !== match.rules.overs ||
    lastMan !== match.rules.lastMan ||
    venue.trim() !== (match.rules.venue || "") ||
    wicketLimits.teamA !== match.rules.wicketLimits.teamA ||
    wicketLimits.teamB !== match.rules.wicketLimits.teamB;
  const canSave =
    hasChanges &&
    Number.isInteger(overs) &&
    overs >= minimumOvers &&
    overs <= 100 &&
    !invalidWicketLimit;

  function toggleLastMan() {
    const next = !lastMan;
    setLastMan(next);
    setWicketLimits((current) => ({
      teamA: wicketLimitAfterLastManToggle(
        current.teamA,
        next,
        match.teams[0].players.length,
        wicketsByTeam["team-a"],
      ),
      teamB: wicketLimitAfterLastManToggle(
        current.teamB,
        next,
        match.teams[1].players.length,
        wicketsByTeam["team-b"],
      ),
    }));
  }

  return (
    <main className="full-score-shell match-rules-editor-page">
      <PageHeader
        title="Playing rules"
        eyebrow="MATCH SETTINGS"
        onBack={onBack}
        backLabel="Back to scoring"
        action={
          <button
            type="button"
            className="page-header-text-action"
            disabled={saving || !canSave}
            onClick={() =>
              void onSave({ overs, lastMan, wicketLimits, venue: venue.trim() })
            }
          >
            {saving ? "Saving…" : "Save"}
          </button>
        }
      />
      <div className="score-scroll match-rules-editor-scroll">
        <section className="team-editor-intro">
          <span className="eyebrow">LIVE MATCH</span>
          <h2>Update playing rules</h2>
          <p>
            Changes apply to the current match. Recorded deliveries and scores
            stay unchanged.
          </p>
        </section>
        <section className="rules-editor-card">
          <label className="rules-editor-field">
            <span>Total overs</span>
            <input
              type="number"
              inputMode="numeric"
              min={minimumOvers}
              max={100}
              value={overs}
              onChange={(event) => setOvers(Number(event.target.value))}
            />
            <small>
              {minimumOvers > 1
                ? `Cannot be fewer than ${minimumOvers}; a team has already reached that over.`
                : "Choose between 1 and 100 overs."}
            </small>
          </label>
          <button
            type="button"
            className="toggle-row"
            aria-pressed={lastMan}
            onClick={toggleLastMan}
          >
            <span>
              <strong>Last-man batting</strong>
              <small>Allow the final batter to continue alone</small>
            </span>
            <i className={lastMan ? "on" : ""}>
              <b />
            </i>
          </button>
        </section>
        <section className="rules-editor-card">
          <div className="rules-editor-heading">
            <span className="eyebrow">WICKET LIMITS</span>
            <p>
              A limit cannot be lower than wickets already taken or higher than
              the available lineup allows.
            </p>
          </div>
          <div className="rules-editor-wickets">
            {match.teams.map((team) => {
              const key = team.id === "team-a" ? "teamA" : "teamB";
              const minimum = Math.max(1, wicketsByTeam[team.id]);
              const maximum = maximumWickets(team);
              return (
                <label className="rules-editor-field" key={team.id}>
                  <span>{team.name}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={minimum}
                    max={maximum}
                    value={wicketLimits[key]}
                    onChange={(event) =>
                      setWicketLimits((current) => ({
                        ...current,
                        [key]: Number(event.target.value),
                      }))
                    }
                  />
                  <small>
                    {minimum}–{maximum} wickets
                  </small>
                </label>
              );
            })}
          </div>
        </section>
        <section className="rules-editor-card">
          <label className="rules-editor-field">
            <span>Venue</span>
            <input
              type="text"
              value={venue}
              maxLength={120}
              placeholder="Add match venue"
              onChange={(event) => setVenue(event.target.value)}
            />
            <small>
              Optional. You can update this at any time during play.
            </small>
          </label>
        </section>
        <button
          type="button"
          className="score-primary-action rules-editor-save"
          disabled={saving || !canSave}
          onClick={() =>
            void onSave({ overs, lastMan, wicketLimits, venue: venue.trim() })
          }
        >
          {saving ? "Saving rules…" : "Save playing rules"}
        </button>
      </div>
    </main>
  );
}

function SecondInningsSetup({
  batting,
  fielding,
  target,
  exiting,
  onBack,
  onUndo,
  onEditTeams,
  onEditRules,
  onStart,
}: {
  batting: MatchTeam;
  fielding: MatchTeam;
  target: number;
  exiting: boolean;
  onBack: () => void;
  onUndo: () => void;
  onEditTeams: () => void;
  onEditRules: () => void;
  onStart: (striker: string, nonStriker: string, bowler: string) => void;
}) {
  const [striker, setStriker] = useState(batting.players[0]?.id || "");
  const [nonStriker, setNonStriker] = useState(batting.players[1]?.id || "");
  const [bowler, setBowler] = useState(fielding.players[0]?.id || "");
  const valid = striker && nonStriker && striker !== nonStriker && bowler;
  return (
    <main className="full-score-shell innings-break-page">
      <PageHeader
        title="Innings break"
        eyebrow="MATCH PAUSED"
        onBack={onBack}
        backLabel="Back to match list"
        backLoading={exiting}
        action={
          <div className="innings-break-actions">
            <button
              type="button"
              className="page-header-text-action"
              onClick={onEditRules}
            >
              Rules
            </button>
            <button
              type="button"
              className="page-header-text-action"
              onClick={onEditTeams}
            >
              Teams
            </button>
          </div>
        }
      />
      <div className="score-scroll">
        <section className="break-target">
          <span>TARGET</span>
          <strong>{target}</strong>
          <p>
            {batting.name} need {target} runs to win
          </p>
        </section>
        <section className="break-summary">
          <div>
            <strong>Second innings</strong>
            <p>Choose the opening players before play resumes.</p>
          </div>
          <label>
            <span>Striker</span>
            <select
              value={striker}
              onChange={(event) => setStriker(event.target.value)}
            >
              {batting.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Non-striker</span>
            <select
              value={nonStriker}
              onChange={(event) => setNonStriker(event.target.value)}
            >
              {batting.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Opening bowler</span>
            <select
              value={bowler}
              onChange={(event) => setBowler(event.target.value)}
            >
              {fielding.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="score-secondary-action"
            onClick={onUndo}
            disabled={exiting}
          >
            Undo innings-ending delivery
          </button>
          <button
            type="button"
            className="score-primary-action"
            disabled={!valid || exiting}
            onClick={() => onStart(striker, nonStriker, bowler)}
          >
            Start second innings
          </button>
        </section>
      </div>
    </main>
  );
}
