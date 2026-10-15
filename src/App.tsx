import { useEffect, useState } from "react";
import AuthProvider, { useAuth } from "./auth/AuthProvider";
import {
  addClubPlayer,
  createClub,
  deleteClub,
  getClub,
  inviteClubMember,
  listClubs,
  listInvitations,
  removeClubMember,
  respondToInvitation,
  updateClub,
  updateClubMemberRole,
  updateClubPlayer,
  type Club,
  type ClubInvitation,
  type ClubMember,
  type ClubPlayer,
} from "./lib/clubsApi";
import { deleteMatch, listMatches, type CricketMatch } from "./lib/matchesApi";
import MatchSetup from "./matches/MatchSetup";
import ScoringPage from "./matches/ScoringPage";
import useConfirmSheet from "./components/ConfirmSheet";
import PageHeader from "./components/PageHeader";

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
  | "edit"
  | "trash"
  | "settings";

const iconPaths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  clubs: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 4a4 4 0 0 1 0 8M17 15a6 6 0 0 1 4 6" />
    </>
  ),
  matches: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 2v3M16 2v3M4 9h16M8 13h3M8 17h6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M14 7l5 5-5 5" />
    </>
  ),
  play: <path d="m9 7 8 5-8 5Z" />,
  bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7Z" />,
  shield: (
    <>
      <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z" />
      <path d="m9 12 2 2 4-5" />
    </>
  ),
  sync: (
    <>
      <path d="M20 7h-5V2" />
      <path d="M20 7A8 8 0 0 0 5.1 5" />
      <path d="M4 17h5v5" />
      <path d="M4 17a8 8 0 0 0 14.9 2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  back: <path d="m15 18-6-6 6-6" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  undo: (
    <>
      <path d="M9 7 4 12l5 5" />
      <path d="M5 12h8a6 6 0 0 1 6 6" />
    </>
  ),
  wifi: (
    <>
      <path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16 16 5 5" />
    </>
  ),
  users: (
    <>
      <circle cx="8" cy="8" r="3" />
      <circle cx="17" cy="9" r="3" />
      <path d="M2 20a6 6 0 0 1 12 0M14 15a5 5 0 0 1 8 4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s6-5.1 6-11a6 6 0 1 0-12 0c0 5.9 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  settings: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

function Button({
  children,
  className = "",
  onClick,
  ariaLabel,
  disabled = false,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function Avatar({
  initials,
  tone = "dark",
}: {
  initials: string;
  tone?: "dark" | "green" | "cream";
}) {
  return <span className={`avatar avatar-${tone}`}>{initials}</span>;
}

type Tab = "Home" | "Clubs" | "Matches" | "Profile";

function isKeyboardInput(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) {
    return true;
  }
  if (target instanceof HTMLSelectElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;

  return ![
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(target.type);
}

const PHOTO =
  "https://images.unsplash.com/photo-1779488399581-19bcffd19520?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1200";

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

function AuthenticatedApp() {
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("Home");
  const [clubToOpen, setClubToOpen] = useState<Club | null>(null);
  const [profileDestination, setProfileDestination] = useState<
    "profile" | "invitations"
  >("profile");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [setupEntry, setSetupEntry] = useState<"quick" | "club" | null>(null);
  const [setupClub, setSetupClub] = useState<Club | undefined>();
  const [setupTemplate, setSetupTemplate] = useState<
    CricketMatch | undefined
  >();
  const [currentMatch, setCurrentMatch] = useState<CricketMatch | null>(null);

  useEffect(() => {
    let releaseTimer: number | undefined;
    let viewportTimer: number | undefined;
    const visualViewport = window.visualViewport;
    let fullViewportHeight = Math.max(
      window.innerHeight,
      visualViewport?.height ?? 0,
    );

    const keepNavigationHidden = () => {
      window.clearTimeout(releaseTimer);
      setKeyboardOpen(true);
    };
    const restoreNavigation = () => {
      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => {
        setKeyboardOpen(isKeyboardInput(document.activeElement));
      }, 350);
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (isKeyboardInput(event.target)) keepNavigationHidden();
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (isKeyboardInput(event.target)) restoreNavigation();
    };
    const handleViewportChange = () => {
      window.clearTimeout(viewportTimer);
      viewportTimer = window.setTimeout(() => {
        const viewportHeight = visualViewport?.height ?? window.innerHeight;
        if (!isKeyboardInput(document.activeElement)) {
          fullViewportHeight = Math.max(fullViewportHeight, viewportHeight);
          return;
        }

        const coveredHeight = fullViewportHeight - viewportHeight;
        if (coveredHeight > 120) setKeyboardOpen(true);
        if (coveredHeight < 80) setKeyboardOpen(false);
      }, 120);
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    visualViewport?.addEventListener("resize", handleViewportChange);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.clearTimeout(releaseTimer);
      window.clearTimeout(viewportTimer);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      visualViewport?.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, []);

  function startQuick() {
    setSetupClub(undefined);
    setSetupTemplate(undefined);
    setSetupEntry("quick");
  }

  async function startClubMatch(club: Club) {
    if (!["admin", "organizer"].includes(club.membership?.role || "")) return;
    try {
      setSetupClub(await getClub(club.id));
    } catch {
      setSetupClub(club);
    }
    setSetupTemplate(undefined);
    setSetupEntry("club");
  }

  function beginCreatedMatch(match: CricketMatch) {
    setCurrentMatch(match);
    setSetupEntry(null);
    setSetupTemplate(undefined);
    setScoring(true);
  }

  async function playAgain(match: CricketMatch) {
    setSetupTemplate(match);
    if (match.clubId) {
      try {
        setSetupClub(await getClub(match.clubId));
      } catch {
        setSetupClub(undefined);
      }
      setSetupEntry("club");
    } else {
      setSetupClub(undefined);
      setSetupEntry("quick");
    }
  }

  if (setupEntry) {
    return (
      <MatchSetup
        entry={setupEntry}
        club={setupClub}
        template={setupTemplate}
        onCancel={() => {
          setSetupEntry(null);
          setSetupTemplate(undefined);
        }}
        onCreated={beginCreatedMatch}
      />
    );
  }

  if (scoring && currentMatch) {
    return (
      <ScoringPage
        match={currentMatch}
        onExit={() => setScoring(false)}
        onComplete={() => {
          setScoring(false);
          setTab("Matches");
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      {tab === "Home" && (
        <Home
          onResume={(match) => {
            setCurrentMatch(match);
            setScoring(true);
          }}
          onQuick={startQuick}
          onStartClub={startClubMatch}
          onOpenClub={(club) => {
            setClubToOpen(club);
            setTab("Clubs");
          }}
          onClubs={() => {
            setClubToOpen(null);
            setTab("Clubs");
          }}
          onInvitations={() => {
            setProfileDestination("invitations");
            setTab("Profile");
          }}
          onMatches={() => setTab("Matches")}
        />
      )}
      {tab === "Clubs" && (
        <Clubs onStart={startClubMatch} initialClub={clubToOpen} />
      )}
      {tab === "Matches" && (
        <Matches
          onResume={(match) => {
            setCurrentMatch(match);
            setScoring(true);
          }}
          onPlayAgain={playAgain}
          onCreateQuick={startQuick}
          onCreateClub={startClubMatch}
        />
      )}
      {tab === "Profile" && (
        <Profile
          name={user.user_metadata.full_name || "CricApp Player"}
          email={user.email || ""}
          onSignOut={signOut}
          initialView={profileDestination}
        />
      )}

      {!keyboardOpen && (
        <nav
          className="bottom-nav"
          aria-label="Main navigation"
          data-active={tab}
        >
          {(["Home", "Clubs", "Matches", "Profile"] as Tab[]).map((item) => (
            <Button
              key={item}
              className={`nav-item ${tab === item ? "active" : ""}`}
              onClick={() => {
                setClubToOpen(null);
                if (item === "Profile") setProfileDestination("profile");
                setTab(item);
              }}
            >
              <span className="nav-icon">
                <Icon
                  name={
                    item === "Home"
                      ? "home"
                      : item === "Clubs"
                        ? "clubs"
                        : item === "Matches"
                          ? "matches"
                          : "user"
                  }
                />
              </span>
              <span>{item}</span>
            </Button>
          ))}
        </nav>
      )}
    </main>
  );
}

function getInitials(name?: string, email?: string) {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length > 1)
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email?.slice(0, 2).toUpperCase() || "CP";
}

function matchStatusLabel(status: CricketMatch["status"]) {
  if (status === "live" || status === "paused") return "Live";
  return status.replaceAll("-", " ");
}

function Home({
  onResume,
  onQuick,
  onStartClub,
  onOpenClub,
  onClubs,
  onInvitations,
  onMatches,
}: {
  onResume: (match: CricketMatch) => void;
  onQuick: () => void;
  onStartClub: (club: Club) => void;
  onOpenClub: (club: Club) => void;
  onClubs: () => void;
  onInvitations: () => void;
  onMatches: () => void;
}) {
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [clubsLoading, setClubsLoading] = useState(true);
  const [choosingClub, setChoosingClub] = useState(false);
  const authorizedClubs = clubs.filter((club) =>
    ["admin", "organizer"].includes(club.membership?.role || ""),
  );

  useEffect(() => {
    let active = true;
    listMatches()
      .then((matchData) => active && setMatches(matchData))
      .catch(() => undefined)
      .finally(() => active && setMatchesLoading(false));
    listClubs()
      .then((clubData) => active && setClubs(clubData.myClubs))
      .catch(() => undefined)
      .finally(() => active && setClubsLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const activeMatch = matches.find((match) =>
    ["live", "paused", "awaiting-second-innings", "ready"].includes(
      match.status,
    ),
  );
  const activeInnings =
    activeMatch?.score?.innings[activeMatch.score.activeInnings];
  const completed = matches
    .filter(
      (match) => match.status === "completed" || match.status === "abandoned",
    )
    .slice(0, 3);
  const today = new Date()
    .toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "short",
    })
    .toUpperCase();

  return (
    <>
      <PageHeader
        home
        action={
          <Button
            className="icon-button"
            ariaLabel="Open invitations"
            onClick={onInvitations}
          >
            <Icon name="bell" />
          </Button>
        }
      />
      <div className="page home-page">
        {/* <section className="welcome-row">
          <div>
            <span className="eyebrow">{today}</span>
            <h1>Ready for the crease?</h1>
            <p>Start a new game or pick up where you left off.</p>
          </div>
        </section> */}

        {matchesLoading ? (
          <section
            className="hero-card home-match-skeleton"
            aria-label="Loading current match"
            aria-busy="true"
          >
            <span className="home-skeleton-pill" />
            <div className="home-skeleton-score">
              <span>
                <i />
                <b />
                <i />
              </span>
              <span>
                <i />
                <b />
                <i />
              </span>
            </div>
            <div className="home-skeleton-footer">
              <span />
              <b />
            </div>
          </section>
        ) : activeMatch ? (
          <section className="hero-card">
            <img src={PHOTO} alt="Cricketers playing on a green field" />
            <div className="hero-shade" />
            <div className="hero-content">
              <div className="live-pill">
                <span />{" "}
                {activeMatch.status === "ready"
                  ? "READY TO START"
                  : matchStatusLabel(activeMatch.status).toUpperCase()}
              </div>
              <div className="hero-match">
                <div>
                  <span>{activeMatch.teams[0].name.toUpperCase()}</span>
                  <strong>
                    {activeInnings
                      ? `${activeInnings.runs}/${activeInnings.wickets}`
                      : "—"}
                  </strong>
                  <small>
                    {activeInnings
                      ? `${Math.floor(activeInnings.legalBalls / activeMatch.rules.ballsPerOver)}.${activeInnings.legalBalls % activeMatch.rules.ballsPerOver} overs`
                      : `${activeMatch.rules.overs} over match`}
                  </small>
                </div>
                <div className="versus">VS</div>
                <div className="opponent">
                  <span>{activeMatch.teams[1].name.toUpperCase()}</span>
                  <strong>—</strong>
                  <small>{activeMatch.mode.replaceAll("-", " ")}</small>
                </div>
              </div>
              <div className="hero-footer">
                <div>
                  <small>Last saved</small>
                  <strong>
                    {new Date(
                      activeMatch.updatedAt || activeMatch.createdAt,
                    ).toLocaleString()}
                  </strong>
                </div>
                <Button
                  className="primary-button light-button"
                  onClick={() => onResume(activeMatch)}
                >
                  {activeMatch.permissions?.canScore
                    ? "Resume scoring"
                    : "View live score"}{" "}
                  <Icon name="arrow" />
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <section className="home-empty-match">
            <span className="empty-illustration">
              <Icon name="matches" size={29} />
            </span>
            <div>
              <strong>No active match</strong>
              <p>Create a Quick Match or start from one of your clubs.</p>
            </div>
          </section>
        )}

        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">NEW MATCH</span>
              <h2>How are you playing?</h2>
            </div>
          </div>
          <div className="action-grid">
            <Button className="action-card green-card" onClick={onQuick}>
              <span className="action-icon">
                <Icon name="bolt" size={25} />
              </span>
              <span className="action-copy">
                <strong>Quick scoring</strong>
                <small>Start in under 2 minutes</small>
              </span>
              <span className="round-arrow">
                <Icon name="arrow" size={18} />
              </span>
            </Button>
            <Button
              className="action-card navy-card"
              onClick={() => setChoosingClub(true)}
            >
              <span className="action-icon">
                <Icon name="shield" size={25} />
              </span>
              <span className="action-copy">
                <strong>Club match</strong>
                <small>Use your roster & records</small>
              </span>
              <span className="round-arrow">
                <Icon name="arrow" size={18} />
              </span>
            </Button>
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">YOUR CLUBS</span>
              <h2>Pick up with your team</h2>
            </div>
            <Button className="text-button" onClick={onClubs}>
              View all <Icon name="arrow" size={16} />
            </Button>
          </div>
          <div
            className={`club-list ${
              clubsLoading ? "home-club-list-skeleton" : ""
            }`}
            aria-busy={clubsLoading}
            aria-label={clubsLoading ? "Loading your clubs" : undefined}
          >
            {clubsLoading
              ? Array.from({ length: 3 }, (_, index) => (
                  <div className="home-club-skeleton-row" key={index}>
                    <span className="home-club-skeleton-avatar" />
                    <span className="home-club-skeleton-copy">
                      <i />
                      <i />
                    </span>
                    <span className="home-club-skeleton-arrow" />
                  </div>
                ))
              : clubs.slice(0, 3).map((club, index) => (
                  <Button
                    className="club-row"
                    key={club.id}
                    onClick={() => onOpenClub(club)}
                  >
                    <Avatar
                      initials={club.initials}
                      tone={index % 2 ? "cream" : "dark"}
                    />
                    <span className="club-copy">
                      <strong>{club.name}</strong>
                      <small>
                        <Icon name="pin" size={14} />{" "}
                        {club.location || "Location not added"} ·{" "}
                        {club.players.length} players
                      </small>
                    </span>
                    <Icon name="chevron" />
                  </Button>
                ))}
            {!clubsLoading && !clubs.length && (
              <div className="empty-note">
                <span className="empty-ball" />
                <div>
                  <strong>No clubs yet</strong>
                  <p>Create or join a club to use a shared roster.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {choosingClub && (
        <div
          className="sheet-backdrop"
          onMouseDown={() => setChoosingClub(false)}
        >
          <div
            className="player-sheet home-club-sheet"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="sheet-title">
              <div>
                <span className="eyebrow">CLUB MATCH</span>
                <h2>Select a club</h2>
              </div>
              <Button
                className="sheet-close"
                onClick={() => setChoosingClub(false)}
                ariaLabel="Close club selection"
              >
                ×
              </Button>
            </div>
            {authorizedClubs.length ? (
              <div className="match-club-options">
                {authorizedClubs.map((club) => (
                  <button
                    type="button"
                    key={club.id}
                    className="match-launch-card"
                    onClick={() => {
                      setChoosingClub(false);
                      onStartClub(club);
                    }}
                  >
                    <Avatar initials={club.initials} tone="green" />
                    <span>
                      <strong>{club.name}</strong>
                      <small>
                        {club.players.length} players · Internal or external
                        match
                      </small>
                    </span>
                    <Icon name="arrow" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="setup-empty home-club-empty">
                <strong>No authorized clubs</strong>
                <p>Only club admins and organizers can create club matches.</p>
                <Button
                  className="club-submit"
                  onClick={() => {
                    setChoosingClub(false);
                    onClubs();
                  }}
                >
                  Go to clubs <span>→</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Clubs({
  onStart,
  initialClub,
}: {
  onStart: (club: Club) => void;
  initialClub?: Club | null;
}) {
  const { confirm, confirmationSheet } = useConfirmSheet();
  const [view, setView] = useState<"list" | "create" | "detail">(
    initialClub ? "detail" : "list",
  );
  const [myClubs, setMyClubs] = useState<Club[]>([]);
  const [selectedClub, setSelectedClub] = useState<Club | null>(
    initialClub ?? null,
  );
  const [detailTab, setDetailTab] = useState<
    "overview" | "roster" | "matches" | "stats" | "members"
  >("overview");
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
  const [playerRole, setPlayerRole] = useState("club-player");
  const [playerStatus, setPlayerStatus] = useState<"active" | "archived">(
    "active",
  );
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<ClubInvitation["role"]>("member");
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);
  const [memberRole, setMemberRole] = useState<ClubMember["role"]>("member");

  useEffect(() => {
    let active = true;
    listClubs()
      .then((result) => {
        if (!active) return;
        setMyClubs(result.myClubs);
      })
      .catch((reason) => active && setError(reason.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!initialClub) return;
    let active = true;
    setSelectedClub(initialClub);
    setView("detail");
    setDetailTab("overview");
    setError("");
    getClub(initialClub.id)
      .then((club) => active && setSelectedClub(club))
      .catch(
        (reason) =>
          active &&
          setError(
            reason instanceof Error ? reason.message : "Unable to load club",
          ),
      );
    return () => {
      active = false;
    };
  }, [initialClub?.id]);

  async function openClub(club: Club) {
    setSelectedClub(club);
    setView("detail");
    setDetailTab("overview");
    setError("");
    try {
      setSelectedClub(await getClub(club.id));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to load club",
      );
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
      setSelectedClub(club);
      setView("detail");
      setClubName("");
      setClubLocation("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to create club",
      );
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
        ? await updateClubPlayer(selectedClub.id, editingPlayer.id, {
            name: playerName,
            nickname: playerNickname,
            role: playerRole,
            status: playerStatus,
          })
        : await addClubPlayer(selectedClub.id, {
            name: playerName,
            nickname: playerNickname,
            role: playerRole,
          });
      setSelectedClub(club);
      setMyClubs((current) =>
        current.map((item) => (item.id === club.id ? club : item)),
      );
      setPlayerName("");
      setPlayerNickname("");
      setPlayerRole("club-player");
      setPlayerStatus("active");
      setEditingPlayer(null);
      setAddingPlayer(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to add player",
      );
    } finally {
      setSaving(false);
    }
  }

  function openAddPlayer() {
    setPlayerName("");
    setPlayerNickname("");
    setPlayerRole("club-player");
    setPlayerStatus("active");
    setEditingPlayer(null);
    setError("");
    setAddingPlayer(true);
  }

  function openEditPlayer(player: ClubPlayer) {
    setPlayerName(player.name);
    setPlayerNickname(player.nickname || "");
    setPlayerRole(player.role || "club-player");
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
      const club = await updateClub(selectedClub.id, {
        name: editName,
        location: editLocation,
      });
      setSelectedClub(club);
      setMyClubs((current) =>
        current.map((item) => (item.id === club.id ? club : item)),
      );
      setEditingClub(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to update club",
      );
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
      setMyClubs((current) =>
        current.filter((item) => item.id !== selectedClub.id),
      );
      setEditingClub(false);
      setSelectedClub(null);
      setView("list");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to delete club",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitInvitation(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedClub || !inviteEmail.trim()) return;
    setSaving(true);
    setError("");
    try {
      await inviteClubMember(selectedClub.id, inviteEmail.trim(), inviteRole);
      setSelectedClub(await getClub(selectedClub.id));
      setInviteEmail("");
      setInviteRole("member");
      setInviting(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to send invitation",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeMemberRole(
    member: ClubMember,
    role: ClubMember["role"],
  ) {
    if (!selectedClub) return false;
    if (member.role === role) return true;
    setSaving(true);
    setError("");
    try {
      await updateClubMemberRole(selectedClub.id, member.userId, role);
      setSelectedClub(await getClub(selectedClub.id));
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to update member",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  function openMemberEditor(member: ClubMember) {
    setEditingMember(member);
    setMemberRole(member.role);
    setError("");
  }

  async function submitMemberRole(event: React.FormEvent) {
    event.preventDefault();
    if (!editingMember) return;
    if (await changeMemberRole(editingMember, memberRole)) {
      setEditingMember(null);
    }
  }

  async function removeMember(member: ClubMember) {
    if (!selectedClub) return;
    const label = member.name || member.email || "this member";
    const confirmed = await confirm({
      title: "Remove club member?",
      message: `${label} will lose access to ${selectedClub.name}.`,
      confirmLabel: "Remove member",
      tone: "danger",
    });
    if (!confirmed) return;
    setSaving(true);
    setError("");
    try {
      await removeClubMember(selectedClub.id, member.userId);
      setSelectedClub(await getClub(selectedClub.id));
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to remove member",
      );
    } finally {
      setSaving(false);
    }
  }

  if (view === "create") {
    const previewInitials = clubName.trim()
      ? clubName
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((word) => word[0])
          .join("")
          .toUpperCase()
      : "CC";
    return (
      <>
        <PageHeader
          title="Create club"
          eyebrow="CLUBS"
          onBack={() => {
            setView("list");
            setError("");
          }}
          backLabel="Back to clubs"
        />
        <div className="page club-flow-page">
          <section className="club-flow-head">
            <h2>Build your club home</h2>
            <p>
              Create a shared place for your roster, matches and season records.
            </p>
          </section>
          <div className="create-club-preview">
            <Avatar initials={previewInitials} tone="green" />
            <div>
              <span>YOUR NEW CLUB</span>
              <strong>{clubName.trim() || "Club name"}</strong>
              <small>
                <Icon name="pin" size={13} />{" "}
                {clubLocation.trim() || "Add a home ground or location"}
              </small>
            </div>
          </div>
          <form className="club-form" onSubmit={submitClub}>
            <label>
              <span>
                Club name <i>Required</i>
              </span>
              <input
                value={clubName}
                maxLength={80}
                onChange={(event) => setClubName(event.target.value)}
                placeholder="e.g. Northside Cricket Club"
                autoFocus
              />
            </label>
            <label>
              <span>
                Location <i>Optional</i>
              </span>
              <input
                value={clubLocation}
                maxLength={120}
                onChange={(event) => setClubLocation(event.target.value)}
                placeholder="Home ground, town or city"
              />
            </label>
            <div className="form-note">
              <Icon name="shield" />
              <p>
                <strong>You’ll be the club admin.</strong>
                <span>
                  You can invite members, manage the roster and appoint
                  organizers later.
                </span>
              </p>
            </div>
            {error && <div className="club-error">{error}</div>}
            <button className="club-submit" type="submit" disabled={saving}>
              {saving ? "Creating club…" : "Create club"}{" "}
              {!saving && <span>→</span>}
            </button>
          </form>
        </div>
      </>
    );
  }

  if (view === "detail" && selectedClub) {
    const canEdit =
      selectedClub.membership?.role === "admin" ||
      selectedClub.membership?.role === "organizer";
    const isAdmin = selectedClub.membership?.role === "admin";
    const detailTabs = selectedClub.membership
      ? (["overview", "roster", "matches", "stats", "members"] as const)
      : (["overview", "roster", "matches", "stats"] as const);
    return (
      <>
        <PageHeader
          title={selectedClub.name}
          eyebrow="CLUB"
          onBack={() => {
            setView("list");
            setError("");
          }}
          backLabel="Back to all clubs"
          action={
            selectedClub.membership?.role === "admin" ? (
              <Button
                className="icon-button club-settings-button"
                onClick={openClubSettings}
                ariaLabel="Club settings"
              >
                <Icon name="settings" />
              </Button>
            ) : undefined
          }
        />
        <div className="page club-detail-page">
          <section className="club-detail-hero">
            <div className="club-detail-title">
              <Avatar initials={selectedClub.initials} tone="green" />
              <div>
                <span className="eyebrow light">
                  {selectedClub.membership?.role?.toUpperCase() ||
                    "PUBLIC CLUB"}
                </span>
                <h2>{selectedClub.name}</h2>
                <p>
                  <Icon name="pin" size={14} />{" "}
                  {selectedClub.location || "Location not added"}
                </p>
              </div>
            </div>
            <div className="club-metrics">
              <div>
                <strong>{selectedClub.players.length}</strong>
                <span>PLAYERS</span>
              </div>
              <div>
                <strong>{selectedClub.matchCount}</strong>
                <span>MATCHES</span>
              </div>
            </div>
            {canEdit && (
              <Button
                className="primary-button light-button wide"
                onClick={() => onStart(selectedClub)}
              >
                <Icon name="play" /> Start club match
              </Button>
            )}
          </section>
          <div
            className={`club-tabs ${
              detailTabs.length === 4 ? "four-tabs" : ""
            }`}
          >
            {detailTabs.map((tab) => (
              <Button
                key={tab}
                className={detailTab === tab ? "active" : ""}
                onClick={() => setDetailTab(tab)}
              >
                {tab === "roster" ? "Players" : tab}
              </Button>
            ))}
          </div>
          {error && <div className="club-error detail-error">{error}</div>}

          {detailTab === "overview" && (
            <div className="club-tab-content">
              <section className="detail-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">CLUB SNAPSHOT</span>
                    <h2>This season</h2>
                  </div>
                </div>
                <div className="snapshot-grid">
                  <div>
                    <span className="snapshot-icon green">
                      <Icon name="users" />
                    </span>
                    <strong>{selectedClub.players.length}</strong>
                    <small>Active players</small>
                  </div>
                  <div>
                    <span className="snapshot-icon cream">
                      <Icon name="matches" />
                    </span>
                    <strong>{selectedClub.matchCount}</strong>
                    <small>Matches played</small>
                  </div>
                </div>
              </section>
              <section className="detail-section">
                <span className="eyebrow">RECENT ACTIVITY</span>
                {selectedClub.recentMatches?.length ? (
                  <div className="club-history-list">
                    {selectedClub.recentMatches.slice(0, 3).map((match) => (
                      <div key={match.id}>
                        <strong>
                          {match.teams[0].name} vs {match.teams[1].name}
                        </strong>
                        <span>{match.score?.result || "Match abandoned"}</span>
                        <small>
                          {match.mode === "club-internal"
                            ? "Internal"
                            : "External"}
                        </small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="club-empty-inline">
                    <span className="empty-ball" />
                    <div>
                      <strong>Your club story starts here</strong>
                      <p>Add players and score your first club match.</p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {detailTab === "members" && (
            <div className="club-tab-content members-tab-content">
              {canEdit && (
                <button
                  type="button"
                  className="admin-card"
                  onClick={() => {
                    setError("");
                    setInviting(true);
                  }}
                >
                  <span className="setting-icon">
                    <Icon name="shield" />
                  </span>
                  <div>
                    <strong>Invite a club member</strong>
                    <p>Add members and organizers by email.</p>
                  </div>
                  <Icon name="chevron" />
                </button>
              )}
              <section className="detail-section club-members-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">CLUB MEMBERS</span>
                    <h2>{selectedClub.members?.length || 0} members</h2>
                  </div>
                </div>
                <div className="club-member-list">
                  {(selectedClub.members || []).map((member) => (
                    <div className="club-member-row" key={member.userId}>
                      <Avatar
                        initials={getInitials(
                          member.name || member.email || member.role,
                        )}
                        tone="cream"
                      />
                      <span>
                        <strong>{member.name || "Club member"}</strong>
                        <small>{member.email || "Email unavailable"}</small>
                        <small>
                          Joined{" "}
                          {new Date(member.joinedAt).toLocaleDateString()}
                          {member.isCreator ? " · Club creator" : ""}
                        </small>
                      </span>
                      <div className="member-row-side">
                        <b>{member.role}</b>
                        {isAdmin && (
                          <span className="member-row-actions">
                            <button
                              type="button"
                              className="member-icon-button"
                              onClick={() => openMemberEditor(member)}
                              disabled={saving}
                              aria-label={`Edit ${member.name || member.email || "club member"}`}
                            >
                              <Icon name="edit" size={16} />
                            </button>
                            {!member.isCreator && (
                              <button
                                type="button"
                                className="member-icon-button danger"
                                onClick={() => void removeMember(member)}
                                disabled={saving}
                                aria-label={`Remove ${member.name || member.email || "club member"}`}
                              >
                                <Icon name="trash" size={16} />
                              </button>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {!selectedClub.members?.length && (
                    <p className="member-empty">No invited members yet.</p>
                  )}
                </div>
                {!!selectedClub.pendingInvitations?.length && (
                  <div className="pending-member-list">
                    <span className="eyebrow">PENDING</span>
                    {selectedClub.pendingInvitations.map((invitation) => (
                      <div key={invitation.id}>
                        <span>
                          <strong>{invitation.email}</strong>
                          <small>Invited as {invitation.role}</small>
                        </span>
                        <b>Pending</b>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {detailTab === "roster" && (
            <div className="club-tab-content">
              <div className="section-heading">
                <div>
                  <h2>{selectedClub.players.length} players</h2>
                </div>
                {canEdit && (
                  <Button className="text-button" onClick={openAddPlayer}>
                    <Icon name="plus" /> Add player
                  </Button>
                )}
              </div>
              {selectedClub.players.length === 0 ? (
                <div className="full-empty">
                  <span className="empty-illustration">
                    <Icon name="users" size={29} />
                  </span>
                  <h3>No players yet</h3>
                  <p>
                    Add your regular players now. They don’t need CricApp
                    accounts.
                  </p>
                  {canEdit && (
                    <Button
                      className="primary-button light-button"
                      onClick={openAddPlayer}
                    >
                      <Icon name="plus" /> Add first player
                    </Button>
                  )}
                </div>
              ) : (
                <div className="detail-roster">
                  {selectedClub.players.map((player, index) => (
                    <div
                      className={`detail-player ${
                        player.status === "archived" ? "archived-player" : ""
                      }`}
                      key={player.id}
                    >
                      <span className="player-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <Avatar
                        initials={getInitials(player.name)}
                        tone="cream"
                      />
                      <div>
                        <strong>{player.name}</strong>
                        <small>
                          {player.nickname ? `${player.nickname} · ` : ""}
                          {player.role
                            ? player.role.replace("-", " ")
                            : "Player"}
                          {player.status === "archived" ? " · Archived" : ""}
                        </small>
                      </div>
                      {canEdit ? (
                        <Button
                          className="edit-player-button"
                          onClick={() => openEditPlayer(player)}
                          ariaLabel={`Edit ${player.name}`}
                        >
                          <Icon name="edit" size={18} />
                        </Button>
                      ) : (
                        <span className="available-dot" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {detailTab === "matches" && (
            <div className="club-tab-content">
              {selectedClub.recentMatches?.length ? (
                <>
                  <div className="club-record-summary">
                    <div>
                      <strong>{selectedClub.internalMatchCount || 0}</strong>
                      <span>INTERNAL</span>
                    </div>
                    <div>
                      <strong>{selectedClub.externalMatchCount || 0}</strong>
                      <span>EXTERNAL</span>
                    </div>
                    <div>
                      <strong>{selectedClub.abandonedCount || 0}</strong>
                      <span>ABANDONED</span>
                    </div>
                  </div>
                  <div className="club-history-list">
                    {selectedClub.recentMatches.map((match) => (
                      <div key={match.id}>
                        <strong>
                          {match.teams[0].name} vs {match.teams[1].name}
                        </strong>
                        <span>{match.score?.result || "Match abandoned"}</span>
                        <small>
                          {new Date(
                            match.completedAt ||
                              match.updatedAt ||
                              match.createdAt,
                          ).toLocaleDateString()}
                        </small>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="full-empty">
                  <span className="empty-illustration">
                    <Icon name="matches" size={29} />
                  </span>
                  <h3>No matches yet</h3>
                  <p>Club matches and completed scorecards will appear here.</p>
                  {canEdit && (
                    <Button
                      className="primary-button light-button"
                      onClick={() => onStart(selectedClub)}
                    >
                      <Icon name="play" /> Start first match
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
          {detailTab === "stats" && (
            <div className="club-tab-content">
              {selectedClub.playerStats?.some(
                (stats) => stats.appearances > 0,
              ) ? (
                <>
                  <p className="stats-policy">
                    Finalized club matches only. Quick and abandoned match
                    figures are excluded.
                  </p>
                  <div className="player-stats-list">
                    {selectedClub.playerStats
                      .filter((stats) => stats.appearances > 0)
                      .sort((a, b) => b.runs - a.runs)
                      .map((stats) => {
                        const player = selectedClub.players.find(
                          (item) => item.id === stats.playerId,
                        );
                        const strikeRate = stats.balls
                          ? ((stats.runs * 100) / stats.balls).toFixed(1)
                          : "—";
                        const economy = stats.oversEquivalent
                          ? (
                              stats.runsConceded / stats.oversEquivalent
                            ).toFixed(2)
                          : "—";
                        return (
                          <div key={stats.playerId}>
                            <strong>{player?.name || "Archived player"}</strong>
                            <span>
                              {stats.runs} runs · HS {stats.highest} · SR{" "}
                              {strikeRate}
                            </span>
                            <small>
                              {stats.wickets} wickets · Econ {economy} ·{" "}
                              {stats.appearances} matches
                            </small>
                          </div>
                        );
                      })}
                  </div>
                </>
              ) : (
                <div className="full-empty">
                  <span className="empty-illustration">
                    <Icon name="bolt" size={29} />
                  </span>
                  <h3>Stats are warming up</h3>
                  <p>
                    Complete a club match to unlock batting and bowling leaders.
                  </p>
                </div>
              )}
            </div>
          )}

          {editingMember && (
            <div
              className="sheet-backdrop"
              onMouseDown={() => !saving && setEditingMember(null)}
            >
              <form
                className="player-sheet member-editor-sheet"
                onSubmit={submitMemberRole}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="sheet-handle" />
                <div className="sheet-title">
                  <div>
                    <span className="eyebrow">CLUB MEMBER</span>
                    <h2>Edit member</h2>
                  </div>
                  <Button
                    className="sheet-close"
                    onClick={() => setEditingMember(null)}
                    disabled={saving}
                  >
                    ×
                  </Button>
                </div>
                <div className="member-sheet-profile">
                  <Avatar
                    initials={getInitials(
                      editingMember.name ||
                        editingMember.email ||
                        editingMember.role,
                    )}
                    tone="cream"
                  />
                  <span>
                    <strong>{editingMember.name || "Club member"}</strong>
                    <small>{editingMember.email || "Email unavailable"}</small>
                    <small>
                      Joined{" "}
                      {new Date(editingMember.joinedAt).toLocaleDateString()}
                      {editingMember.isCreator ? " · Club creator" : ""}
                    </small>
                  </span>
                </div>
                <label>
                  <span>Club role</span>
                  <select
                    value={memberRole}
                    onChange={(event) =>
                      setMemberRole(event.target.value as ClubMember["role"])
                    }
                  >
                    <option value="member">Member</option>
                    <option value="organizer">Organizer</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
                {error && <div className="club-error">{error}</div>}
                <button className="club-submit" type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save member role"}
                </button>
              </form>
            </div>
          )}

          {inviting && (
            <div
              className="sheet-backdrop"
              onMouseDown={() => setInviting(false)}
            >
              <form
                className="player-sheet"
                onSubmit={submitInvitation}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="sheet-handle" />
                <div className="sheet-title">
                  <div>
                    <span className="eyebrow">MEMBERS</span>
                    <h2>Invite to {selectedClub.name}</h2>
                  </div>
                  <Button
                    className="sheet-close"
                    onClick={() => setInviting(false)}
                  >
                    ×
                  </Button>
                </div>
                <label>
                  <span>Email address</span>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="player@example.com"
                    autoFocus
                  />
                </label>
                <label>
                  <span>Club role</span>
                  <select
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(
                        event.target.value as ClubInvitation["role"],
                      )
                    }
                  >
                    <option value="member">Member</option>
                    <option value="organizer">Organizer</option>
                    {selectedClub.membership?.role === "admin" && (
                      <option value="admin">Admin</option>
                    )}
                  </select>
                </label>
                {error && <div className="club-error">{error}</div>}
                <button
                  className="club-submit"
                  type="submit"
                  disabled={saving || !inviteEmail.trim()}
                >
                  {saving ? "Sending…" : "Send invitation"}
                </button>
              </form>
            </div>
          )}

          {addingPlayer && (
            <div
              className="sheet-backdrop"
              onMouseDown={() => setAddingPlayer(false)}
            >
              <form
                className="player-sheet"
                onSubmit={submitPlayer}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="sheet-handle" />
                <div className="sheet-title">
                  <div>
                    <span className="eyebrow">PLAYERS</span>
                    <h2>{editingPlayer ? "Update player" : "Add a player"}</h2>
                  </div>
                  <Button
                    className="sheet-close"
                    onClick={() => {
                      setAddingPlayer(false);
                      setEditingPlayer(null);
                    }}
                  >
                    ×
                  </Button>
                </div>
                <label>
                  <span>Player name</span>
                  <input
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    placeholder="Full name"
                    autoFocus
                  />
                </label>
                <label>
                  <span>
                    Nickname <i>Optional</i>
                  </span>
                  <input
                    value={playerNickname}
                    onChange={(event) => setPlayerNickname(event.target.value)}
                    placeholder="What the team calls them"
                  />
                </label>
                <label>
                  <span>Playing role</span>
                  <select
                    value={playerRole}
                    onChange={(event) => setPlayerRole(event.target.value)}
                  >
                    <option value="club-player">Club Player</option>
                    <option value="batter">Batter</option>
                    <option value="bowler">Bowler</option>
                    <option value="all-rounder">All-rounder</option>
                    <option value="wicketkeeper">Wicketkeeper</option>
                  </select>
                </label>
                {editingPlayer && (
                  <label>
                    <span>Player status</span>
                    <select
                      value={playerStatus}
                      onChange={(event) =>
                        setPlayerStatus(
                          event.target.value as "active" | "archived",
                        )
                      }
                    >
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                )}
                {error && <div className="club-error">{error}</div>}
                <button
                  className="club-submit"
                  type="submit"
                  disabled={saving || !playerName.trim()}
                >
                  {saving
                    ? "Saving player…"
                    : editingPlayer
                      ? "Save player changes"
                      : "Add player"}{" "}
                  {!saving && <span>→</span>}
                </button>
              </form>
            </div>
          )}
          {editingClub && (
            <div
              className="sheet-backdrop settings-backdrop"
              onMouseDown={() => setEditingClub(false)}
            >
              <div
                className="player-sheet club-settings-sheet"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="sheet-handle" />
                <div className="sheet-title">
                  <div>
                    <span className="eyebrow">CLUB ADMIN</span>
                    <h2>Club settings</h2>
                  </div>
                  <Button
                    className="sheet-close"
                    onClick={() => setEditingClub(false)}
                  >
                    ×
                  </Button>
                </div>
                <form className="settings-form" onSubmit={submitClubUpdate}>
                  <label>
                    <span>Club name</span>
                    <input
                      value={editName}
                      maxLength={80}
                      onChange={(event) => setEditName(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>
                      Location <i>Optional</i>
                    </span>
                    <input
                      value={editLocation}
                      maxLength={120}
                      onChange={(event) => setEditLocation(event.target.value)}
                      placeholder="Home ground, town or city"
                    />
                  </label>
                  {error && <div className="club-error">{error}</div>}
                  <button
                    className="club-submit"
                    type="submit"
                    disabled={saving || !editName.trim()}
                  >
                    {saving ? "Saving changes…" : "Save changes"}{" "}
                    {!saving && <span>→</span>}
                  </button>
                </form>
                <section className="danger-zone">
                  <span className="eyebrow">DANGER ZONE</span>
                  <h3>Delete this club</h3>
                  <p>
                    This permanently removes the club and its roster. Clubs with
                    match history are protected from deletion.
                  </p>
                  <label>
                    <span>
                      Type <strong>{selectedClub.name}</strong> to confirm
                    </span>
                    <input
                      value={deleteConfirm}
                      onChange={(event) => setDeleteConfirm(event.target.value)}
                      placeholder={selectedClub.name}
                    />
                  </label>
                  <Button
                    className="delete-club-button"
                    onClick={confirmClubDeletion}
                    disabled={saving || deleteConfirm !== selectedClub.name}
                  >
                    {saving ? "Deleting…" : "Delete club permanently"}
                  </Button>
                </section>
              </div>
            </div>
          )}
          {confirmationSheet}
        </div>
      </>
    );
  }

  const filtered = myClubs.filter((club) =>
    `${club.name} ${club.location || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Clubs"
        eyebrow={`${myClubs.length} MEMBERSHIP${
          myClubs.length === 1 ? "" : "S"
        }`}
        action={
          <Button
            className="create-club-button"
            onClick={() => {
              setView("create");
              setError("");
            }}
          >
            <Icon name="plus" /> Create
          </Button>
        }
      />
      <div className="page clubs-page">
        <p className="page-intro">Manage palyers, matches and club records.</p>
        <label className="club-search">
          <Icon name="search" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by club or location"
          />
        </label>
        {error && (
          <div className="club-error">
            {error}
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        )}
        {loading ? (
          <div className="club-skeletons">
            <span />
            <span />
            <span />
          </div>
        ) : filtered.length === 0 ? (
          <div className="full-empty list-empty">
            <span className="empty-illustration">
              <Icon name={search ? "search" : "shield"} size={29} />
            </span>
            <h3>{search ? "No clubs found" : "Create your first club"}</h3>
            <p>
              {search
                ? "Try another club name or location."
                : "Bring your team, roster and match records together."}
            </p>
            {!search && (
              <Button
                className="primary-button light-button"
                onClick={() => setView("create")}
              >
                <Icon name="plus" /> Create a club
              </Button>
            )}
          </div>
        ) : (
          <div className="clubs-database-list">
            {filtered.map((club, index) => (
              <Button
                className="database-club-card"
                key={club.id}
                onClick={() => openClub(club)}
              >
                <Avatar
                  initials={club.initials}
                  tone={index % 2 ? "cream" : "dark"}
                />
                <span className="database-club-copy">
                  <span className="club-card-label">
                    {club.membership?.role ||
                      (club.joined ? "member" : "community club")}
                  </span>
                  <strong>{club.name}</strong>
                  <small>
                    <Icon name="pin" size={13} />{" "}
                    {club.location || "Location not added"}
                  </small>
                  <span className="club-card-meta">
                    <b>
                      <Icon name="users" size={13} />{" "}
                      {club.players.length || club.memberCount} players
                    </b>
                    <b>{club.matchCount} matches</b>
                  </span>
                </span>
                <Icon name="chevron" />
              </Button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function Matches({
  onResume,
  onPlayAgain,
  onCreateQuick,
  onCreateClub,
}: {
  onResume: (match: CricketMatch) => void;
  onPlayAgain: (match: CricketMatch) => void;
  onCreateQuick: () => void;
  onCreateClub: (club: Club) => void;
}) {
  const { confirm, confirmationSheet } = useConfirmSheet();
  const [matches, setMatches] = useState<CricketMatch[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [filter, setFilter] = useState<
    "all" | "active" | "completed" | "abandoned"
  >("all");
  const [selectedMatch, setSelectedMatch] = useState<CricketMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const authorizedClubs = clubs.filter((club) =>
    ["admin", "organizer"].includes(club.membership?.role || ""),
  );

  useEffect(() => {
    let active = true;
    Promise.all([listMatches(), listClubs()])
      .then(([matchData, clubData]) => {
        if (!active) return;
        setMatches(matchData);
        setClubs(clubData.myClubs);
      })
      .catch(
        (reason) =>
          active &&
          setError(
            reason instanceof Error ? reason.message : "Unable to load matches",
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const filteredMatches = matches.filter((match) => {
    if (filter === "active")
      return ["ready", "live", "paused", "awaiting-second-innings"].includes(
        match.status,
      );
    if (filter === "completed") return match.status === "completed";
    if (filter === "abandoned") return match.status === "abandoned";
    return true;
  });

  function formatMatchType(mode: CricketMatch["mode"]) {
    if (mode === "club-internal") return "Internal club match";
    if (mode === "club-external") return "External club match";
    return "Quick match";
  }

  async function removeMatch(match: CricketMatch) {
    const name = `${match.teams[0].name} vs ${match.teams[1].name}`;
    const confirmed = await confirm({
      title: "Remove match?",
      message: `${name} and its scorecard and statistics will be permanently removed.`,
      confirmLabel: "Remove match",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await deleteMatch(match.id);
      localStorage.removeItem(`cricapp-match-score:${match.id}`);
      setMatches((current) => current.filter((item) => item.id !== match.id));
      setSelectedMatch(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to remove this match",
      );
    }
  }

  if (selectedMatch)
    return (
      <>
        <MatchScorecard
          match={selectedMatch}
          onBack={() => setSelectedMatch(null)}
          onPlayAgain={() => onPlayAgain(selectedMatch)}
          onRemove={() => removeMatch(selectedMatch)}
        />
        {confirmationSheet}
      </>
    );

  return (
    <>
      <PageHeader
        title="Matches"
        eyebrow="MATCH CENTRE"
        action={
          <Button
            className="create-club-button new-match-button"
            onClick={() => setCreating(true)}
          >
            <Icon name="plus" /> New match
          </Button>
        }
      />
      <div className="page matches-page">
        <p className="page-intro">
          Set up games, resume scoring and revisit scorecards.
        </p>
        <div className="match-summary-strip">
          <div>
            <strong>{matches.length}</strong>
            <span>TOTAL</span>
          </div>
          <div>
            <strong>
              {
                matches.filter((match) =>
                  [
                    "ready",
                    "live",
                    "paused",
                    "awaiting-second-innings",
                  ].includes(match.status),
                ).length
              }
            </strong>
            <span>ACTIVE</span>
          </div>
          <div>
            <strong>
              {matches.filter((match) => match.status === "completed").length}
            </strong>
            <span>COMPLETE</span>
          </div>
        </div>
        <div className="filter-pills match-filters">
          {(["all", "active", "completed", "abandoned"] as const).map(
            (item) => (
              <Button
                key={item}
                className={filter === item ? "active" : ""}
                onClick={() => setFilter(item)}
              >
                {item}
              </Button>
            ),
          )}
        </div>
        {error && (
          <div className="club-error">
            {error}
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        )}
        {loading ? (
          <div className="match-skeletons">
            <span />
            <span />
            <span />
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="full-empty matches-empty">
            <span className="empty-illustration">
              <Icon name="matches" size={29} />
            </span>
            <h3>
              {matches.length
                ? "No matches in this view"
                : "Create your first match"}
            </h3>
            <p>
              {matches.length
                ? "Choose another filter to see more matches."
                : "Set up a Quick Match or use an authorized club roster."}
            </p>
            {!matches.length && (
              <Button
                className="primary-button light-button"
                onClick={() => setCreating(true)}
              >
                <Icon name="plus" /> Create a match
              </Button>
            )}
          </div>
        ) : (
          <div className="matches-database-list">
            {filteredMatches.map((match) => {
              const created = new Date(match.createdAt);
              const canResume = !["completed", "abandoned"].includes(
                match.status,
              );
              return (
                <div className="database-match-item" key={match.id}>
                  <Button
                    className="database-match-card"
                    onClick={() =>
                      canResume ? onResume(match) : setSelectedMatch(match)
                    }
                  >
                    <div className="database-match-top">
                      <span className={`match-status-badge ${match.status}`}>
                        {matchStatusLabel(match.status)}
                      </span>
                      <small>
                        {created.toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </small>
                    </div>
                    <div className="database-versus">
                      <div>
                        <Avatar
                          initials={getInitials(match.teams[0].name)}
                          tone="dark"
                        />
                        <strong>{match.teams[0].name}</strong>
                      </div>
                      <span>VS</span>
                      <div>
                        <Avatar
                          initials={getInitials(match.teams[1].name)}
                          tone="cream"
                        />
                        <strong>{match.teams[1].name}</strong>
                      </div>
                    </div>
                    <div className="database-match-footer">
                      <span>
                        {formatMatchType(match.mode)} · {match.rules.overs}{" "}
                        overs
                      </span>
                      <strong>
                        {canResume
                          ? match.permissions?.canScore
                            ? match.status === "ready"
                              ? "Start scoring"
                              : "Resume scoring"
                            : "View live score"
                          : "View scorecard"}{" "}
                        <Icon name="arrow" size={15} />
                      </strong>
                    </div>
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {creating && (
          <div
            className="sheet-backdrop"
            onMouseDown={() => setCreating(false)}
          >
            <div
              className="player-sheet match-create-sheet"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="sheet-handle" />
              <div className="sheet-title">
                <div>
                  <span className="eyebrow">NEW MATCH</span>
                  <h2>How are you playing?</h2>
                </div>
                <Button
                  className="sheet-close"
                  onClick={() => setCreating(false)}
                >
                  ×
                </Button>
              </div>
              <button
                type="button"
                className="match-launch-card quick-launch"
                onClick={onCreateQuick}
              >
                <span className="launch-icon">
                  <Icon name="bolt" />
                </span>
                <span>
                  <strong>Quick scoring</strong>
                  <small>Create two independent teams</small>
                </span>
                <Icon name="arrow" />
              </button>
              <div className="launch-divider">
                <span>OR USE A CLUB</span>
              </div>
              {authorizedClubs.length === 0 ? (
                <div className="setup-empty">
                  <strong>No authorized clubs</strong>
                  <p>Create a club or ask an admin for organizer access.</p>
                </div>
              ) : (
                <div className="match-club-options">
                  {authorizedClubs.map((club) => (
                    <button
                      type="button"
                      key={club.id}
                      className="match-launch-card"
                      onClick={() => onCreateClub(club)}
                    >
                      <Avatar initials={club.initials} tone="green" />
                      <span>
                        <strong>{club.name}</strong>
                        <small>Internal or external club match</small>
                      </span>
                      <Icon name="arrow" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        {confirmationSheet}
      </div>
    </>
  );
}

function MatchScorecard({
  match,
  onBack,
  onPlayAgain,
  onRemove,
}: {
  match: CricketMatch;
  onBack: () => void;
  onPlayAgain: () => void;
  onRemove: () => void;
}) {
  const score = match.score;
  const type =
    match.mode === "club-internal"
      ? "Internal club match"
      : match.mode === "club-external"
        ? "External club match"
        : "Quick match";
  return (
    <>
      <PageHeader
        title="Scorecard"
        eyebrow={matchStatusLabel(match.status).toUpperCase()}
        onBack={onBack}
        backLabel="Back to all matches"
      />
      <div className="page scorecard-page">
        <section className="scorecard-hero">
          <span className="eyebrow light">
            {matchStatusLabel(match.status).toUpperCase()}
          </span>
          <h2>
            {score?.result ||
              (match.status === "abandoned"
                ? "Match abandoned"
                : "Match scorecard")}
          </h2>
          <p>
            {match.teams[0].name} vs {match.teams[1].name}
          </p>
          <small>
            {type} ·{" "}
            {match.mode === "quick"
              ? "Separate quick statistics"
              : "Counts toward club records"}
          </small>
        </section>
        <section className="scorecard-meta">
          <div>
            <span>Toss</span>
            <strong>
              {
                match.teams.find((team) => team.id === match.toss.winnerId)
                  ?.name
              }{" "}
              chose to {match.toss.decision}
            </strong>
          </div>
          <div>
            <span>Rules</span>
            <strong>
              {match.rules.overs} overs · {match.rules.ballsPerOver} balls ·
              Free hit {match.rules.freeHit ? "on" : "off"}
            </strong>
          </div>
          {match.rules.venue && (
            <div>
              <span>Venue</span>
              <strong>{match.rules.venue}</strong>
            </div>
          )}
        </section>
        {score?.innings.map((innings, inningsIndex) => {
          const team = match.teams.find(
            (entry) => entry.id === innings.battingTeamId,
          )!;
          const batting = new Map<
            string,
            {
              runs: number;
              balls: number;
              fours: number;
              sixes: number;
            }
          >();
          const bowling = new Map<
            string,
            {
              runs: number;
              balls: number;
              wickets: number;
            }
          >();
          innings.deliveries.forEach((delivery) => {
            const bat = batting.get(delivery.strikerId) || {
              runs: 0,
              balls: 0,
              fours: 0,
              sixes: 0,
            };
            bat.runs += delivery.batRuns;
            if (delivery.legal) bat.balls += 1;
            if (delivery.boundary === 4) bat.fours += 1;
            if (delivery.boundary === 6) bat.sixes += 1;
            batting.set(delivery.strikerId, bat);
            const bowl = bowling.get(delivery.bowlerId) || {
              runs: 0,
              balls: 0,
              wickets: 0,
            };
            bowl.balls += delivery.legal ? 1 : 0;
            bowl.runs +=
              delivery.batRuns +
              (delivery.extraType === "bye" || delivery.extraType === "leg-bye"
                ? 0
                : delivery.extraType === "no-ball" && delivery.runningExtraType
                  ? match.rules.noBallPenalty
                  : delivery.extraRuns);
            if (delivery.wicket && delivery.wicket.type !== "run-out")
              bowl.wickets += 1;
            bowling.set(delivery.bowlerId, bowl);
          });
          const fielding = match.teams.find(
            (entry) => entry.id !== innings.battingTeamId,
          )!;
          const extras = innings.deliveries.reduce(
            (sum, delivery) => sum + delivery.extraRuns,
            0,
          );
          return (
            <section
              className="scorecard-innings"
              key={`${innings.battingTeamId}-${inningsIndex}`}
            >
              <header>
                <div>
                  <span>{inningsIndex + 1} innings</span>
                  <strong>{team.name}</strong>
                </div>
                <b>
                  {innings.runs}/{innings.wickets}
                  <small>
                    {Math.floor(innings.legalBalls / match.rules.ballsPerOver)}.
                    {innings.legalBalls % match.rules.ballsPerOver} ov
                  </small>
                </b>
              </header>
              <h3>Batting</h3>
              {team.players
                .filter((player) => batting.has(player.id))
                .map((player) => {
                  const item = batting.get(player.id)!;
                  return (
                    <div className="scorecard-row" key={player.id}>
                      <span>{player.name}</span>
                      <strong>{item.runs}</strong>
                      <small>
                        {item.balls} balls · {item.fours}×4 · {item.sixes}×6
                      </small>
                    </div>
                  );
                })}
              <div className="scorecard-row extras">
                <span>Extras</span>
                <strong>{extras}</strong>
              </div>
              <h3>Bowling</h3>
              {fielding.players
                .filter((player) => bowling.has(player.id))
                .map((player) => {
                  const item = bowling.get(player.id)!;
                  return (
                    <div className="scorecard-row" key={player.id}>
                      <span>{player.name}</span>
                      <strong>
                        {item.wickets}/{item.runs}
                      </strong>
                      <small>
                        {Math.floor(item.balls / match.rules.ballsPerOver)}.
                        {item.balls % match.rules.ballsPerOver} overs
                      </small>
                    </div>
                  );
                })}
              <h3>Deliveries</h3>
              <div className="scorecard-timeline">
                {innings.deliveries.map((delivery, deliveryIndex) => (
                  <span
                    key={delivery.id}
                    className={delivery.wicket ? "wicket" : ""}
                  >
                    <b>
                      {Math.floor(deliveryIndex / match.rules.ballsPerOver)}.
                      {(deliveryIndex % match.rules.ballsPerOver) + 1}
                    </b>
                    {delivery.label}
                  </span>
                ))}
              </div>
            </section>
          );
        }) || (
          <div className="full-empty">
            <h3>No deliveries recorded</h3>
            <p>This match has no saved scoring events.</p>
          </div>
        )}
        <Button
          className="score-primary-action scorecard-rematch"
          onClick={onPlayAgain}
        >
          Play again with these teams
        </Button>
        <button
          type="button"
          className="remove-match-button"
          onClick={onRemove}
        >
          Remove match
        </button>
      </div>
    </>
  );
}

function Profile({
  name,
  email,
  onSignOut,
  initialView = "profile",
}: {
  name: string;
  email: string;
  onSignOut: () => Promise<void>;
  initialView?: "profile" | "invitations";
}) {
  const [summary, setSummary] = useState({
    matches: 0,
    completed: 0,
    clubs: 0,
  });
  const [invitations, setInvitations] = useState<ClubInvitation[]>([]);
  const [showInvitations, setShowInvitations] = useState(
    initialView === "invitations",
  );
  const [respondingInvitation, setRespondingInvitation] = useState("");
  const [invitationError, setInvitationError] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [installReady, setInstallReady] = useState(
    Boolean(window.cricAppInstallPrompt),
  );

  useEffect(() => {
    Promise.all([listMatches(), listClubs(), listInvitations()])
      .then(([matches, clubs, pending]) => {
        setSummary({
          matches: matches.length,
          completed: matches.filter((match) => match.status === "completed")
            .length,
          clubs: clubs.myClubs.length,
        });
        setInvitations(pending);
      })
      .catch(() => undefined);
    const handleOnline = () => setOnline(navigator.onLine);
    const handleInstall = () => setInstallReady(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOnline);
    window.addEventListener("cricapp-install-ready", handleInstall);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOnline);
      window.removeEventListener("cricapp-install-ready", handleInstall);
    };
  }, []);

  async function installApp() {
    const prompt = window.cricAppInstallPrompt;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    window.cricAppInstallPrompt = undefined;
    setInstallReady(false);
  }

  async function answerInvitation(
    invitationId: string,
    decision: "accept" | "decline",
  ) {
    setRespondingInvitation(invitationId);
    setInvitationError("");
    try {
      await respondToInvitation(invitationId, decision);
      setInvitations((current) =>
        current.filter((invitation) => invitation.id !== invitationId),
      );
      if (decision === "accept")
        setSummary((current) => ({ ...current, clubs: current.clubs + 1 }));
    } catch (reason) {
      setInvitationError(
        reason instanceof Error
          ? reason.message
          : "Unable to update this invitation.",
      );
    } finally {
      setRespondingInvitation("");
    }
  }

  if (showInvitations) {
    return (
      <>
        <PageHeader
          title="Invitations"
          eyebrow="CLUBS"
          onBack={() => setShowInvitations(false)}
          backLabel="Back to profile"
        />
        <div className="page invitations-page">
          <section className="invitations-intro">
            <span className="setting-icon">
              <Icon name="bell" size={22} />
            </span>
            <div>
              <span className="eyebrow">PENDING INVITATIONS</span>
              <h2>
                {invitations.length
                  ? `${invitations.length} club invitation${
                      invitations.length === 1 ? "" : "s"
                    }`
                  : "You’re all caught up"}
              </h2>
              <p>Review invitations from clubs and choose whether to join.</p>
            </div>
          </section>
          {invitationError && (
            <div className="club-error">{invitationError}</div>
          )}
          {invitations.length ? (
            <section className="invitation-list">
              {invitations.map((invitation) => {
                const responding = respondingInvitation === invitation.id;
                return (
                  <article key={invitation.id} className="invitation-card">
                    <Avatar
                      initials={getInitials(invitation.clubName)}
                      tone="dark"
                    />
                    <div className="invitation-copy">
                      <span className="eyebrow">JOIN AS {invitation.role}</span>
                      <h3>{invitation.clubName}</h3>
                      <p>
                        Invited{" "}
                        {new Date(invitation.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="invitation-actions">
                      <button
                        type="button"
                        onClick={() =>
                          answerInvitation(invitation.id, "decline")
                        }
                        disabled={responding}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className="accept"
                        onClick={() =>
                          answerInvitation(invitation.id, "accept")
                        }
                        disabled={responding}
                      >
                        {responding ? "Updating…" : "Accept"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : (
            <div className="full-empty invitations-empty">
              <span className="empty-illustration">
                <Icon name="bell" size={29} />
              </span>
              <h3>No new invitations</h3>
              <p>New club invitations will appear on this page.</p>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Profile" eyebrow="ACCOUNT" />
      <div className="page">
        <section className="profile-hero">
          <Avatar initials={getInitials(name, email)} tone="green" />
          <div>
            <h2>{name}</h2>
            <p>{email}</p>
            <span>PLAYER · ORGANIZER</span>
          </div>
        </section>
        <section className="stats-banner">
          <div>
            <strong>{summary.matches}</strong>
            <span>MATCHES</span>
          </div>
          <div>
            <strong>{summary.completed}</strong>
            <span>COMPLETED</span>
          </div>
          <div>
            <strong>{summary.clubs}</strong>
            <span>CLUBS</span>
          </div>
        </section>
        <section className="section-block">
          <span className="eyebrow">ACCOUNT</span>
          <div className="settings-list">
            <button
              type="button"
              className="settings-item"
              onClick={() => setShowInvitations(true)}
            >
              <span className="setting-icon">
                <Icon name="bell" />
              </span>
              <span>
                <strong>Invitations</strong>
                <small>{invitations.length} pending</small>
              </span>
              <Icon name="chevron" />
            </button>
            <div>
              <span className="setting-icon">
                <Icon name="sync" />
              </span>
              <span>
                <strong>Offline & sync</strong>
                <small>
                  {online
                    ? "Connected"
                    : "Offline — local scoring remains available"}
                </small>
              </span>
              <span className="available-dot" />
            </div>
            <div>
              <span className="setting-icon">
                <Icon name="settings" />
              </span>
              <span>
                <strong>App settings</strong>
                <small>Scoring and appearance</small>
              </span>
              <Icon name="chevron" />
            </div>
          </div>
        </section>
        <section className="install-card">
          <span className="install-icon">
            <Icon name="bolt" />
          </span>
          <div>
            <strong>Keep CricApp on your home screen</strong>
            <p>
              {installReady
                ? "Install for faster access and reliable offline scoring."
                : "Use your browser’s Add to Home Screen option when available."}
            </p>
          </div>
          <Button
            className="small-button"
            onClick={installApp}
            disabled={!installReady}
          >
            Install
          </Button>
        </section>
        <Button className="sign-out-button" onClick={onSignOut}>
          Sign out
        </Button>
      </div>
    </>
  );
}
