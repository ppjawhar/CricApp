import { createClient } from "jsr:@supabase/supabase-js@2.49.8"
import { Hono } from "npm:hono"
import { cors } from "npm:hono/cors"
import { logger } from "npm:hono/logger"
import * as kv from "./kv_store.tsx"

const API_PREFIX = "/cricapp-api"
const app = new Hono<{ Variables: { userId: string; userEmail: string } }>()

type ClubRole = "admin" | "organizer" | "scorer" | "member"
type StoredPlayer = {
  id: string
  name: string
  nickname?: string
  role?: string
  status: "active" | "archived"
  createdAt: string
}
type StoredClub = {
  id: string
  name: string
  location?: string
  initials: string
  createdAt: string
  createdBy: string
  players: StoredPlayer[]
  memberships?: Record<string, ClubRole>
  memberCount?: number
  matchCount?: number
  record?: {
    wins: number
    losses: number
    ties: number
  }
}
type ClubMembership = {
  role: ClubRole
  clubId: string
  userId: string
  joinedAt: string
  email?: string
}
type ClubInvitation = {
  id: string
  clubId: string
  clubName: string
  email: string
  role: Exclude<ClubRole, "scorer">
  status: "pending" | "accepted" | "declined"
  invitedBy: string
  createdAt: string
  respondedAt?: string
  acceptedUserId?: string
}
type StoredMatch = {
  id: string
  mode: "club-internal" | "club-external" | "quick"
  clubId?: string
  status:
    | "draft"
    | "ready"
    | "live"
    | "paused"
    | "awaiting-second-innings"
    | "completed"
    | "abandoned"
  teams: Array<{
    id: "team-a" | "team-b"
    name: string
    players: Array<{
      id: string
      name: string
      source: "roster" | "temporary"
    }>
  }>
  rules: Record<string, unknown>
  toss: Record<string, unknown>
  createdAt: string
  createdBy: string
  updatedAt?: string
  completedAt?: string
  version?: number
  score?: Record<string, unknown>
  scoringOwnerId?: string
  corrections?: Array<{
    id: string
    deliveryId: string
    original: unknown
    replacement: unknown
    actorId: string
    createdAt: string
  }>
}

app.use("*", logger(console.log))
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
)

app.onError((error, c) => {
  console.error(error)
  return c.json({ error: "The server could not complete this request." }, 500)
})

app.get(`${API_PREFIX}/health`, (c) => c.json({ status: "ok" }))

app.use(`${API_PREFIX}/*`, async (c, next) => {
  const authorization = c.req.header("Authorization") || ""
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : ""
  if (!token) return c.json({ error: "Authentication is required." }, 401)

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase server environment variables.")
    return c.json({ error: "The server is not configured correctly." }, 500)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user)
    return c.json({ error: "Your session is invalid or has expired." }, 401)
  c.set("userId", data.user.id)
  c.set("userEmail", (data.user.email || "").toLowerCase())
  await next()
})

function cleanRequiredString(value: unknown, field: string, maxLength = 100) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${field} is required.`)
  return value.trim().slice(0, maxLength)
}

function cleanOptionalString(value: unknown, maxLength = 100) {
  if (value == null || value === "") return undefined
  if (typeof value !== "string") throw new Error("Invalid text value.")
  return value.trim().slice(0, maxLength) || undefined
}

async function readJson(c: any) {
  try {
    return await c.req.json()
  } catch {
    throw new Error("A valid JSON request body is required.")
  }
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

const clubKey = (id: string) => `club:${id}`
const membershipKey = (userId: string, clubId: string) =>
  `user-club:${userId}:${clubId}`
const matchKey = (id: string) => `match:${id}`
const userMatchKey = (userId: string, matchId: string) =>
  `user-match:${userId}:${matchId}`
const clubMatchKey = (clubId: string, matchId: string) =>
  `club-match:${clubId}:${matchId}`
const activeMatchKey = (userId: string, deviceId: string) =>
  `active-match:${userId}:${deviceId}`
const invitationKey = (id: string) => `invitation:${id}`
const userInvitationKey = (email: string, id: string) =>
  `user-invitation:${email.toLowerCase()}:${id}`

function publicClub(
  club: StoredClub,
  role: ClubRole | undefined,
  matches: StoredMatch[] = [],
  members: Array<{
    userId: string
    email?: string
    role: Exclude<ClubRole, "scorer">
    joinedAt: string
    isCreator: boolean
  }> = [],
  pendingInvitations: ClubInvitation[] = [],
) {
  const players = Array.isArray(club.players) ? club.players : []
  const clubMatches = matches.filter((match) => match.clubId === club.id)
  const completed = clubMatches.filter((match) => match.status === "completed" && match.score)
  const external = completed.filter((match) => match.mode === "club-external")
  const record = external.reduce((totals, match) => {
    const result = String((match.score as any)?.result || "")
    if (result === "Match tied") totals.ties += 1
    else if (result.startsWith(`${match.teams[0].name} won`)) totals.wins += 1
    else if (result.includes(" won")) totals.losses += 1
    return totals
  }, { wins: 0, losses: 0, ties: 0 })
  const playerStats = new Map<string, {
    playerId: string
    appearances: number
    innings: number
    runs: number
    balls: number
    highest: number
    fours: number
    sixes: number
    wickets: number
    ballsBowled: number
    oversEquivalent: number
    runsConceded: number
  }>()
  for (const player of players) playerStats.set(player.id, {
    playerId: player.id, appearances: 0, innings: 0, runs: 0, balls: 0,
    highest: 0, fours: 0, sixes: 0, wickets: 0, ballsBowled: 0, oversEquivalent: 0,
    runsConceded: 0,
  })
  for (const match of completed) {
    const appeared = new Set<string>(match.teams.flatMap((team) => team.players.filter((player) => player.source === "roster" && playerStats.has(player.id)).map((player) => player.id)))
    for (const innings of ((match.score as any).innings || [])) {
      const inningsRuns = new Map<string, number>()
      const batted = new Set<string>()
      for (const delivery of innings.deliveries || []) {
        const batter = playerStats.get(delivery.strikerId)
        if (batter) {
          appeared.add(delivery.strikerId)
          batted.add(delivery.strikerId)
          batter.runs += delivery.batRuns || 0
          batter.balls += delivery.legal ? 1 : 0
          batter.fours += delivery.boundary === 4 ? 1 : 0
          batter.sixes += delivery.boundary === 6 ? 1 : 0
          inningsRuns.set(delivery.strikerId, (inningsRuns.get(delivery.strikerId) || 0) + (delivery.batRuns || 0))
        }
        const bowler = playerStats.get(delivery.bowlerId)
        if (bowler) {
          appeared.add(delivery.bowlerId)
          bowler.ballsBowled += delivery.legal ? 1 : 0
          bowler.oversEquivalent += delivery.legal ? 1 / Number((match.rules as any).ballsPerOver || 6) : 0
          const nonBowlerExtras = delivery.extraType === "bye" || delivery.extraType === "leg-bye"
            ? delivery.extraRuns || 0
            : delivery.extraType === "no-ball" && delivery.runningExtraType
              ? Math.max(0, (delivery.extraRuns || 0) - Number((match.rules as any).noBallPenalty || 1))
              : 0
          bowler.runsConceded += (delivery.batRuns || 0) + (delivery.extraRuns || 0) - nonBowlerExtras
          if (delivery.wicket && delivery.wicket.type !== "run-out") bowler.wickets += 1
        }
      }
      for (const playerId of batted) {
        const stats = playerStats.get(playerId)!
        stats.innings += 1
        stats.highest = Math.max(stats.highest, inningsRuns.get(playerId) || 0)
      }
    }
    for (const playerId of appeared) playerStats.get(playerId)!.appearances += 1
  }
  return {
    id: club.id,
    name: club.name,
    location: club.location,
    initials: club.initials,
    createdAt: club.createdAt,
    createdBy: club.createdBy,
    memberCount:
      players.filter((player) => player.status === "active").length ||
      club.memberCount ||
      0,
    matchCount: clubMatches.length,
    internalMatchCount: completed.filter((match) => match.mode === "club-internal").length,
    externalMatchCount: external.length,
    abandonedCount: clubMatches.filter((match) => match.status === "abandoned").length,
    record,
    playerStats: [...playerStats.values()],
    recentMatches: clubMatches
      .filter((match) => match.status === "completed" || match.status === "abandoned")
      .sort((a, b) => (b.completedAt || b.updatedAt || b.createdAt).localeCompare(a.completedAt || a.updatedAt || a.createdAt))
      .slice(0, 10),
    players,
    members,
    pendingInvitations,
    membership: role ? { role } : undefined,
    joined: Boolean(role),
  }
}

async function getClubOrResponse(
  c: any,
  id: string,
): Promise<StoredClub | Response> {
  const club = await kv.get(clubKey(id))
  return club ? club as StoredClub : c.json({ error: "Club not found." }, 404)
}

const isResponse = (value: unknown): value is Response =>
  value instanceof Response
const canManageClub = (role: ClubRole | undefined) =>
  role === "admin" || role === "organizer"

async function getClubRole(club: StoredClub, userId: string) {
  const embeddedRole = club.memberships?.[userId]
  if (embeddedRole) return embeddedRole
  const membership = (await kv.get(
    membershipKey(userId, club.id),
  )) as ClubMembership | undefined
  return membership?.role
}

async function canReadMatch(match: StoredMatch, userId: string) {
  if (match.createdBy === userId) return true
  if (!match.clubId) return false
  const club = (await kv.get(clubKey(match.clubId))) as StoredClub | undefined
  return Boolean(club && await getClubRole(club, userId))
}

async function canScoreMatch(match: StoredMatch, userId: string) {
  return (match.scoringOwnerId || match.createdBy) === userId
}

async function getClubMembers(club: StoredClub) {
  const stored = (await kv.getByPrefix("user-club:")) as ClubMembership[]
  const byUser = new Map(
    stored
      .filter((membership) => membership.clubId === club.id)
      .map((membership) => [membership.userId, membership]),
  )
  return Object.entries(club.memberships || {}).map(([userId, embeddedRole]) => {
    const membership = byUser.get(userId)
    return {
      userId,
      email: membership?.email,
      role: embeddedRole === "scorer" ? "member" as const : embeddedRole,
      joinedAt: membership?.joinedAt || club.createdAt,
      isCreator: userId === club.createdBy,
    }
  })
}

async function publicMatch(match: StoredMatch, userId: string) {
  if (!match.clubId) {
    return {
      ...match,
      permissions: {
        canScore: (match.scoringOwnerId || match.createdBy) === userId,
        canManageScorer: match.createdBy === userId,
      },
      scorer: {
        userId: match.scoringOwnerId || match.createdBy,
        role: "admin",
      },
      scorerOptions: [],
    }
  }
  const club = (await kv.get(clubKey(match.clubId))) as StoredClub | undefined
  if (!club) return match
  const [role, members] = await Promise.all([
    getClubRole(club, userId),
    getClubMembers(club),
  ])
  const scorerId = match.scoringOwnerId || match.createdBy
  return {
    ...match,
    permissions: {
      canScore: scorerId === userId,
      canManageScorer: canManageClub(role),
    },
    scorer: members.find((member) => member.userId === scorerId) || {
      userId: scorerId,
      role: "member",
    },
    scorerOptions: canManageClub(role) ? members : [],
  }
}

async function persistMatch(match: StoredMatch) {
  const keys = [matchKey(match.id), userMatchKey(match.createdBy, match.id)]
  const values: StoredMatch[] = [match, match]
  if (match.clubId) {
    keys.push(clubMatchKey(match.clubId, match.id))
    values.push(match)
  }
  await kv.mset(keys, values)
}

app.get(`${API_PREFIX}/clubs`, async (c) => {
  const userId = c.get("userId") as string
  const [clubs, matches, memberships] = await Promise.all([
    kv.getByPrefix("club:") as Promise<StoredClub[]>,
    kv.getByPrefix("match:") as Promise<StoredMatch[]>,
    kv.getByPrefix(`user-club:${userId}:`) as Promise<ClubMembership[]>,
  ])
  const roles = new Map(
    memberships.map((membership) => [membership.clubId, membership.role]),
  )
  const serialized = clubs
    .map((club) =>
      publicClub(
        club,
        club.memberships?.[userId] || roles.get(club.id),
        matches,
      ),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
  return c.json({
    myClubs: serialized.filter((club) => club.joined),
    browseClubs: serialized.filter((club) => !club.joined),
  })
})

app.post(`${API_PREFIX}/clubs`, async (c) => {
  const userId = c.get("userId") as string
  try {
    const body = await readJson(c)
    const name = cleanRequiredString(body.name, "Club name")
    const club: StoredClub = {
      id: crypto.randomUUID(),
      name,
      location: cleanOptionalString(body.location),
      initials: initials(name),
      createdAt: new Date().toISOString(),
      createdBy: userId,
      players: [],
      memberships: { [userId]: "admin" },
    }
    const membership: ClubMembership = {
      role: "admin",
      clubId: club.id,
      userId,
      joinedAt: club.createdAt,
      email: c.get("userEmail") as string,
    }
    await kv.mset([clubKey(club.id), membershipKey(userId, club.id)], [
      club,
      membership,
    ])
    return c.json({
      club: publicClub(club, "admin", [], [{
        userId,
        email: membership.email,
        role: "admin",
        joinedAt: membership.joinedAt,
        isCreator: true,
      }]),
    }, 201)
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Invalid club details.",
      },
      400,
    )
  }
})

app.get(`${API_PREFIX}/clubs/:clubId`, async (c) => {
  const club = await getClubOrResponse(c, c.req.param("clubId"))
  if (isResponse(club)) return club
  const userId = c.get("userId") as string
  const [matches, role, members, invitations] = await Promise.all([
    kv.getByPrefix("match:") as Promise<StoredMatch[]>,
    getClubRole(club, userId),
    getClubMembers(club),
    kv.getByPrefix("invitation:") as Promise<ClubInvitation[]>,
  ])
  let visibleMembers = role
    ? members.map((member) =>
      member.userId === userId && !member.email
        ? { ...member, email: c.get("userEmail") as string }
        : member
    )
    : []
  const membersWithoutEmail = visibleMembers.filter((member) => !member.email)
  if (membersWithoutEmail.length) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const recoveredEmails = new Map(
      (await Promise.all(membersWithoutEmail.map(async (member) => {
        const { data } = await supabase.auth.admin.getUserById(member.userId)
        return [member.userId, data.user?.email?.toLowerCase()] as const
      }))).filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
    )
    visibleMembers = visibleMembers.map((member) => ({
      ...member,
      email: member.email || recoveredEmails.get(member.userId),
    }))
  }
  const pendingInvitations = canManageClub(role)
    ? invitations.filter(
        (invitation) =>
          invitation.clubId === club.id && invitation.status === "pending",
      )
    : []
  return c.json({
    club: publicClub(club, role, matches, visibleMembers, pendingInvitations),
  })
})

app.put(`${API_PREFIX}/clubs/:clubId`, async (c) => {
  const userId = c.get("userId") as string
  const club = await getClubOrResponse(c, c.req.param("clubId"))
  if (isResponse(club)) return club
  const role = await getClubRole(club, userId)
  if (role !== "admin")
    return c.json({ error: "Only a club admin can edit club details." }, 403)
  try {
    const body = await readJson(c)
    club.name = cleanRequiredString(body.name, "Club name")
    club.location = cleanOptionalString(body.location)
    club.initials = initials(club.name)
    await kv.set(clubKey(club.id), club)
    const matches = (await kv.getByPrefix("match:")) as StoredMatch[]
    return c.json({ club: publicClub(club, role, matches) })
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Invalid club details.",
      },
      400,
    )
  }
})

app.delete(`${API_PREFIX}/clubs/:clubId`, async (c) => {
  const userId = c.get("userId") as string
  const club = await getClubOrResponse(c, c.req.param("clubId"))
  if (isResponse(club)) return club
  const role = await getClubRole(club, userId)
  if (role !== "admin")
    return c.json({ error: "Only a club admin can delete this club." }, 403)
  const clubMatches = (await kv.getByPrefix(
    `club-match:${club.id}:`,
  )) as StoredMatch[]
  if (clubMatches.length)
    return c.json(
      { error: "Clubs with match history cannot be deleted." },
      409,
    )
  const memberships = (await kv.getByPrefix("user-club:")) as ClubMembership[]
  const membershipKeys = memberships
    .filter((membership) => membership.clubId === club.id)
    .map((membership) => membershipKey(membership.userId, club.id))
  await Promise.all([
    kv.del(clubKey(club.id)),
    membershipKeys.length ? kv.mdel(membershipKeys) : Promise.resolve(),
  ])
  return c.body(null, 204)
})

app.post(`${API_PREFIX}/clubs/:clubId/players`, async (c) => {
  const userId = c.get("userId") as string
  const club = await getClubOrResponse(c, c.req.param("clubId"))
  if (isResponse(club)) return club
  const role = await getClubRole(club, userId)
  if (!canManageClub(role))
    return c.json(
      { error: "You do not have permission to manage this roster." },
      403,
    )
  try {
    const body = await readJson(c)
    club.players.push({
      id: crypto.randomUUID(),
      name: cleanRequiredString(body.name, "Player name"),
      nickname: cleanOptionalString(body.nickname, 50),
      role: cleanOptionalString(body.role, 30),
      status: "active",
      createdAt: new Date().toISOString(),
    })
    await kv.set(clubKey(club.id), club)
    const matches = (await kv.getByPrefix("match:")) as StoredMatch[]
    return c.json({ club: publicClub(club, role, matches) }, 201)
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid player details.",
      },
      400,
    )
  }
})

app.put(`${API_PREFIX}/clubs/:clubId/players/:playerId`, async (c) => {
  const userId = c.get("userId") as string
  const club = await getClubOrResponse(c, c.req.param("clubId"))
  if (isResponse(club)) return club
  const role = await getClubRole(club, userId)
  if (!canManageClub(role))
    return c.json(
      { error: "You do not have permission to manage this roster." },
      403,
    )
  const index = club.players.findIndex(
    (player) => player.id === c.req.param("playerId"),
  )
  if (index < 0) return c.json({ error: "Player not found." }, 404)
  try {
    const body = await readJson(c)
    const status =
      body.status === "archived"
        ? "archived"
        : body.status === "active"
          ? "active"
          : null
    if (!status) throw new Error("Player status must be active or archived.")
    club.players[index] = {
      ...club.players[index],
      name: cleanRequiredString(body.name, "Player name"),
      nickname: cleanOptionalString(body.nickname, 50),
      role: cleanOptionalString(body.role, 30),
      status,
    }
    await kv.set(clubKey(club.id), club)
    const matches = (await kv.getByPrefix("match:")) as StoredMatch[]
    return c.json({ club: publicClub(club, role, matches) })
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid player details.",
      },
      400,
    )
  }
})

app.post(`${API_PREFIX}/clubs/:clubId/invitations`, async (c) => {
  const userId = c.get("userId") as string
  const club = await getClubOrResponse(c, c.req.param("clubId"))
  if (isResponse(club)) return club
  const requesterRole = await getClubRole(club, userId)
  if (!canManageClub(requesterRole))
    return c.json({ error: "You do not have permission to invite members." }, 403)
  try {
    const body = await readJson(c)
    const email = cleanRequiredString(body.email, "Email", 254).toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid email address.")
    const allowedRoles = requesterRole === "admin"
      ? ["admin", "organizer", "member"]
      : ["organizer", "member"]
    const role = allowedRoles.includes(body.role)
      ? body.role as Exclude<ClubRole, "scorer">
      : "member"
    const existing = (await kv.getByPrefix(`user-invitation:${email}:`)) as ClubInvitation[]
    if (existing.some((invite) => invite.clubId === club.id && invite.status === "pending"))
      return c.json({ error: "This person already has a pending invitation." }, 409)
    const invitation: ClubInvitation = {
      id: crypto.randomUUID(), clubId: club.id, clubName: club.name, email,
      role, status: "pending", invitedBy: userId,
      createdAt: new Date().toISOString(),
    }
    await kv.mset(
      [invitationKey(invitation.id), userInvitationKey(email, invitation.id)],
      [invitation, invitation],
    )
    return c.json({ invitation }, 201)
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid invitation." }, 400)
  }
})

app.get(`${API_PREFIX}/invitations`, async (c) => {
  const email = c.get("userEmail") as string
  if (!email) return c.json({ invitations: [] })
  const invitations = (await kv.getByPrefix(`user-invitation:${email}:`)) as ClubInvitation[]
  return c.json({ invitations: invitations.filter((invite) => invite.status === "pending").sort((a, b) => b.createdAt.localeCompare(a.createdAt)) })
})

app.post(`${API_PREFIX}/invitations/:invitationId/respond`, async (c) => {
  const userId = c.get("userId") as string
  const email = c.get("userEmail") as string
  const invitation = (await kv.get(invitationKey(c.req.param("invitationId")))) as ClubInvitation | undefined
  if (!invitation) return c.json({ error: "Invitation not found." }, 404)
  if (invitation.email !== email) return c.json({ error: "This invitation belongs to another account." }, 403)
  if (invitation.status !== "pending") return c.json({ error: "This invitation has already been answered." }, 409)
  try {
    const body = await readJson(c)
    if (!["accept", "decline"].includes(body.decision)) throw new Error("Choose accept or decline.")
    invitation.status = body.decision === "accept" ? "accepted" : "declined"
    invitation.respondedAt = new Date().toISOString()
    const keys = [invitationKey(invitation.id), userInvitationKey(email, invitation.id)]
    const values: Array<ClubInvitation | ClubMembership | StoredClub> = [invitation, invitation]
    if (body.decision === "accept") {
      const club = (await kv.get(clubKey(invitation.clubId))) as StoredClub | undefined
      if (!club) return c.json({ error: "This club no longer exists." }, 410)
      club.memberships = { ...(club.memberships || {}), [userId]: invitation.role }
      invitation.acceptedUserId = userId
      const membership: ClubMembership = { role: invitation.role, clubId: club.id, userId, joinedAt: invitation.respondedAt!, email }
      keys.push(clubKey(club.id), membershipKey(userId, club.id))
      values.push(club, membership)
    }
    await kv.mset(keys, values)
    return c.json({ invitation })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid invitation response." }, 400)
  }
})

app.put(`${API_PREFIX}/clubs/:clubId/members/:memberId`, async (c) => {
  const userId = c.get("userId") as string
  const club = await getClubOrResponse(c, c.req.param("clubId"))
  if (isResponse(club)) return club
  const requesterRole = await getClubRole(club, userId)
  if (requesterRole !== "admin") return c.json({ error: "Only an admin can change member roles." }, 403)
  try {
    const body = await readJson(c)
    if (!["admin", "organizer", "member"].includes(body.role)) throw new Error("Invalid member role.")
    const memberId = c.req.param("memberId")
    const membership = (await kv.get(membershipKey(memberId, club.id))) as ClubMembership | undefined
    if (!membership) return c.json({ error: "Member not found." }, 404)
    const currentRole = club.memberships?.[memberId] || membership.role
    if (currentRole === "admin" && body.role !== "admin") {
      const adminCount = Object.values(club.memberships || {}).filter(
        (role) => role === "admin",
      ).length
      if (adminCount <= 1)
        return c.json({ error: "Assign another admin before changing the last admin." }, 409)
    }
    membership.role = body.role
    club.memberships = { ...(club.memberships || {}), [memberId]: body.role }
    await kv.mset([clubKey(club.id), membershipKey(memberId, club.id)], [club, membership])
    return c.json({ membership })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid member role." }, 400)
  }
})

app.delete(`${API_PREFIX}/clubs/:clubId/members/:memberId`, async (c) => {
  const userId = c.get("userId") as string
  const club = await getClubOrResponse(c, c.req.param("clubId"))
  if (isResponse(club)) return club
  const requesterRole = await getClubRole(club, userId)
  if (requesterRole !== "admin")
    return c.json({ error: "Only an admin can remove club members." }, 403)
  const memberId = c.req.param("memberId")
  if (memberId === club.createdBy)
    return c.json({ error: "The club creator cannot be removed." }, 409)
  const membership = (await kv.get(
    membershipKey(memberId, club.id),
  )) as ClubMembership | undefined
  if (!membership) return c.json({ error: "Member not found." }, 404)
  const nextMemberships = { ...(club.memberships || {}) }
  delete nextMemberships[memberId]
  club.memberships = nextMemberships
  const matches = (await kv.getByPrefix(
    `club-match:${club.id}:`,
  )) as StoredMatch[]
  const changedMatches = matches.filter(
    (match) =>
      match.scoringOwnerId === memberId &&
      !["completed", "abandoned"].includes(match.status),
  )
  changedMatches.forEach((match) => {
    match.scoringOwnerId = userId
    match.updatedAt = new Date().toISOString()
    match.version = (match.version || 0) + 1
  })
  await Promise.all([
    kv.set(clubKey(club.id), club),
    kv.del(membershipKey(memberId, club.id)),
    ...changedMatches.map((match) => persistMatch(match)),
  ])
  return c.body(null, 204)
})

function validateMatchInput(body: any) {
  if (!["club-internal", "club-external", "quick"].includes(body.mode))
    throw new Error("Invalid match type.")
  if (!Array.isArray(body.teams) || body.teams.length !== 2)
    throw new Error("A match needs exactly two teams.")
  if (
    !body.rules ||
    typeof body.rules !== "object" ||
    !body.toss ||
    typeof body.toss !== "object"
  )
    throw new Error("Rules and toss details are required.")
  const seenPlayers = new Set<string>()
  body.teams.forEach((team: any, index: number) => {
    if (team.id !== (index === 0 ? "team-a" : "team-b"))
      throw new Error("Invalid team identifiers.")
    cleanRequiredString(team.name, "Team name")
    if (!Array.isArray(team.players) || team.players.length < 2)
      throw new Error("Each team needs at least two players.")
    team.players.forEach((player: any) => {
      cleanRequiredString(player.id, "Player ID")
      cleanRequiredString(player.name, "Player name")
      if (!["roster", "temporary"].includes(player.source))
        throw new Error("Invalid player source.")
      if (seenPlayers.has(player.id))
        throw new Error("A player can appear on only one side.")
      seenPlayers.add(player.id)
    })
  })
  const rules = body.rules
  if (![rules.overs, rules.ballsPerOver].every((value) => Number.isInteger(value) && value > 0))
    throw new Error("Overs and balls per over must be positive whole numbers.")
  if (![rules.widePenalty, rules.noBallPenalty].every((value) => Number.isInteger(value) && value >= 0))
    throw new Error("Extra penalties must be non-negative whole numbers.")
  if (typeof rules.freeHit !== "boolean" || typeof rules.lastMan !== "boolean")
    throw new Error("Free-hit and last-man rules are required.")
  const limits = [rules.wicketLimits?.teamA, rules.wicketLimits?.teamB]
  limits.forEach((limit, index) => {
    const maximum = body.teams[index].players.length - (rules.lastMan ? 0 : 1)
    if (!Number.isInteger(limit) || limit < 1 || limit > maximum)
      throw new Error(`Invalid wicket limit for ${body.teams[index].name}.`)
  })
  const toss = body.toss
  if (!["physical", "in-app"].includes(toss.method) || !["team-a", "team-b"].includes(toss.winnerId) || !["bat", "bowl"].includes(toss.decision))
    throw new Error("Invalid toss result.")
  const battingId = toss.decision === "bat" ? toss.winnerId : toss.winnerId === "team-a" ? "team-b" : "team-a"
  const batting = body.teams.find((team: any) => team.id === battingId)
  const fielding = body.teams.find((team: any) => team.id !== battingId)
  const battingIds = new Set(batting.players.map((player: any) => player.id))
  const fieldingIds = new Set(fielding.players.map((player: any) => player.id))
  if (!battingIds.has(toss.strikerId) || !battingIds.has(toss.nonStrikerId) || toss.strikerId === toss.nonStrikerId || !fieldingIds.has(toss.bowlerId))
    throw new Error("Opening players do not match the toss and lineups.")
}

app.post(`${API_PREFIX}/matches`, async (c) => {
  const userId = c.get("userId") as string
  try {
    const body = await readJson(c)
    validateMatchInput(body)
    let scoringOwnerId = userId
    if (body.mode !== "quick") {
      if (typeof body.clubId !== "string")
        return c.json({ error: "A club is required for a club match." }, 400)
      const club = (await kv.get(
        clubKey(body.clubId),
      )) as StoredClub | undefined
      if (!club) return c.json({ error: "Club not found." }, 404)
      const role = await getClubRole(club, userId)
      if (!canManageClub(role))
        return c.json(
          {
            error:
              "You do not have permission to create a match for this club.",
          },
          403,
        )
      const members = await getClubMembers(club)
      const requestedScorer = typeof body.scoringOwnerId === "string"
        ? body.scoringOwnerId
        : undefined
      const defaultAdmin = members.find((member) => member.role === "admin")
      scoringOwnerId = requestedScorer || defaultAdmin?.userId || club.createdBy
      if (!members.some((member) => member.userId === scoringOwnerId))
        return c.json({ error: "Choose a current club member as scorer." }, 400)
      const activeRosterIds = new Set(club.players.filter((player) => player.status === "active").map((player) => player.id))
      const representedPlayers = body.mode === "club-internal"
        ? body.teams.flatMap((team: any) => team.players)
        : body.teams[0].players
      if (representedPlayers.some((player: any) => player.source !== "roster" || !activeRosterIds.has(player.id)))
        return c.json({ error: "Club lineups can only use active roster players." }, 400)
      if (body.mode === "club-external" && body.teams[1].players.some((player: any) => player.source !== "temporary"))
        return c.json({ error: "External opponent players must be match-only players." }, 400)
    }
    const match: StoredMatch = {
      id: crypto.randomUUID(),
      mode: body.mode,
      clubId: body.mode === "quick" ? undefined : body.clubId,
      status: "ready",
      teams: body.teams,
      rules: body.rules,
      toss: body.toss,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      updatedAt: new Date().toISOString(),
      version: 0,
      scoringOwnerId,
    }
    await persistMatch(match)
    return c.json({ match: await publicMatch(match, userId) }, 201)
  } catch (error) {
    return c.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid match details.",
      },
      400,
    )
  }
})

app.get(`${API_PREFIX}/matches`, async (c) => {
  const userId = c.get("userId") as string
  const matches = (await kv.getByPrefix("match:")) as StoredMatch[]
  const readable = await Promise.all(
    matches.map(async (match) => ({
      match,
      allowed: await canReadMatch(match, userId),
    })),
  )
  const visibleMatches = await Promise.all(
    readable
      .filter((item) => item.allowed)
      .map((item) => publicMatch(item.match, userId)),
  )
  return c.json({
    matches: visibleMatches
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  })
})

app.get(`${API_PREFIX}/matches/:matchId`, async (c) => {
  const userId = c.get("userId") as string
  const match = (await kv.get(
    matchKey(c.req.param("matchId")),
  )) as StoredMatch | undefined
  if (!match) return c.json({ error: "Match not found." }, 404)
  if (!await canReadMatch(match, userId))
    return c.json({ error: "You do not have access to this match." }, 403)
  return c.json({ match: await publicMatch(match, userId) })
})

app.put(`${API_PREFIX}/matches/:matchId/scorer`, async (c) => {
  const userId = c.get("userId") as string
  const match = (await kv.get(
    matchKey(c.req.param("matchId")),
  )) as StoredMatch | undefined
  if (!match) return c.json({ error: "Match not found." }, 404)
  if (!match.clubId)
    return c.json({ error: "Quick Match scorer cannot be reassigned." }, 409)
  const club = (await kv.get(clubKey(match.clubId))) as StoredClub | undefined
  if (!club) return c.json({ error: "Club not found." }, 404)
  const role = await getClubRole(club, userId)
  if (!canManageClub(role))
    return c.json({ error: "Only an admin or organizer can change the scorer." }, 403)
  try {
    const body = await readJson(c)
    const members = await getClubMembers(club)
    if (!members.some((member) => member.userId === body.scorerId))
      return c.json({ error: "Choose a current club member as scorer." }, 400)
    match.scoringOwnerId = body.scorerId
    match.updatedAt = new Date().toISOString()
    match.version = (match.version || 0) + 1
    await persistMatch(match)
    return c.json({ match: await publicMatch(match, userId) })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid scorer." }, 400)
  }
})

app.delete(`${API_PREFIX}/matches/:matchId`, async (c) => {
  const userId = c.get("userId") as string
  const match = (await kv.get(
    matchKey(c.req.param("matchId")),
  )) as StoredMatch | undefined
  if (!match) return c.json({ error: "Match not found." }, 404)

  let canDelete = match.createdBy === userId
  if (!canDelete && match.clubId) {
    const club = (await kv.get(clubKey(match.clubId))) as StoredClub | undefined
    canDelete = Boolean(club && await getClubRole(club, userId) === "admin")
  }
  if (!canDelete)
    return c.json({ error: "Only the match creator or club admin can remove this match." }, 403)

  const keys = [matchKey(match.id), userMatchKey(match.createdBy, match.id)]
  if (match.clubId) keys.push(clubMatchKey(match.clubId, match.id))
  await kv.mdel(keys)
  return c.body(null, 204)
})

function validateScoreState(score: any, match: StoredMatch) {
  if (!score || typeof score !== "object")
    throw new Error("Score state is required.")
  if (!Array.isArray(score.innings) || score.innings.length < 1 || score.innings.length > 2)
    throw new Error("A match must contain one or two innings.")
  if (!Number.isInteger(score.activeInnings) || !score.innings[score.activeInnings])
    throw new Error("Invalid active innings.")
  const teamIds = new Set(match.teams.map((team) => team.id))
  const playerIds = new Set(match.teams.flatMap((team) => team.players.map((player) => player.id)))
  let expectedSequence = 1
  for (const innings of score.innings) {
    if (!teamIds.has(innings.battingTeamId)) throw new Error("Invalid batting team.")
    if (![innings.runs, innings.wickets, innings.legalBalls].every((value) => Number.isInteger(value) && value >= 0))
      throw new Error("Invalid innings totals.")
    if (!Array.isArray(innings.deliveries) || !Array.isArray(innings.dismissed))
      throw new Error("Invalid innings records.")
    for (const delivery of innings.deliveries) {
      if (typeof delivery.id !== "string" || !delivery.id || delivery.sequence !== expectedSequence)
        throw new Error("Delivery sequence is invalid.")
      if (!playerIds.has(delivery.strikerId) || !playerIds.has(delivery.bowlerId))
        throw new Error("Delivery references an unknown player.")
      if (![delivery.batRuns, delivery.completedRuns, delivery.extraRuns].every((value) => Number.isInteger(value) && value >= 0))
        throw new Error("Delivery runs are invalid.")
      expectedSequence += 1
    }
  }
  if (!["live", "new-batter", "new-bowler", "innings-break", "completed"].includes(score.phase))
    throw new Error("Invalid scoring phase.")
}

app.put(`${API_PREFIX}/matches/:matchId/score`, async (c) => {
  const userId = c.get("userId") as string
  const match = (await kv.get(
    matchKey(c.req.param("matchId")),
  )) as StoredMatch | undefined
  if (!match) return c.json({ error: "Match not found." }, 404)
  if (!await canScoreMatch(match, userId))
    return c.json({ error: "You do not have permission to score this match." }, 403)
  if (match.status === "abandoned")
    return c.json({ error: "An abandoned match cannot accept deliveries." }, 409)
  try {
    const body = await readJson(c)
    const currentVersion = match.version || 0
    if (!Number.isInteger(body.version) || body.version !== currentVersion)
      return c.json({
        error: "This match changed on another session. Reload before continuing.",
        code: "VERSION_CONFLICT",
        match,
      }, 409)
    validateScoreState(body.score, match)
    const previousDeliveries = new Map<string, unknown>()
    for (const innings of ((match.score as any)?.innings || [])) {
      for (const delivery of innings.deliveries || []) previousDeliveries.set(delivery.id, delivery)
    }
    const nextDeliveries = new Map<string, unknown>()
    for (const innings of body.score.innings) {
      for (const delivery of innings.deliveries || []) nextDeliveries.set(delivery.id, delivery)
    }
    const correctionIds = new Set([...previousDeliveries.keys(), ...nextDeliveries.keys()])
    const corrections = [...correctionIds].flatMap((deliveryId) => {
      const original = previousDeliveries.get(deliveryId)
      const replacement = nextDeliveries.get(deliveryId)
      if (!original || JSON.stringify(original) === JSON.stringify(replacement)) return []
      return [{
        id: crypto.randomUUID(), deliveryId, original,
        replacement: replacement || null, actorId: userId,
        createdAt: new Date().toISOString(),
      }]
    })
    if (corrections.length) match.corrections = [...(match.corrections || []), ...corrections].slice(-200)
    match.score = body.score
    match.version = currentVersion + 1
    match.updatedAt = new Date().toISOString()
    match.scoringOwnerId = userId
    match.status = body.score.phase === "completed"
      ? "completed"
      : body.score.phase === "innings-break"
        ? "awaiting-second-innings"
        : "live"
    if (match.status === "completed") match.completedAt = match.updatedAt
    await persistMatch(match)
    return c.json({ match: await publicMatch(match, userId) })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid score state." }, 400)
  }
})

app.put(`${API_PREFIX}/matches/:matchId/status`, async (c) => {
  const userId = c.get("userId") as string
  const match = (await kv.get(
    matchKey(c.req.param("matchId")),
  )) as StoredMatch | undefined
  if (!match) return c.json({ error: "Match not found." }, 404)
  if (!await canScoreMatch(match, userId))
    return c.json({ error: "You do not have permission to update this match." }, 403)
  try {
    const body = await readJson(c)
    if (!["paused", "abandoned"].includes(body.status))
      throw new Error("A match can only be paused or abandoned here.")
    match.status = body.status
    match.updatedAt = new Date().toISOString()
    match.version = (match.version || 0) + 1
    if (body.status === "abandoned") match.completedAt = match.updatedAt
    await persistMatch(match)
    return c.json({ match: await publicMatch(match, userId) })
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "Invalid match status." }, 400)
  }
})

app.get(`${API_PREFIX}/matches/:deviceId/active`, async (c) => {
  const userId = c.get("userId") as string
  const deviceId = c.req.param("deviceId")
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(deviceId))
    return c.json({ error: "Invalid device identifier." }, 400)
  return c.json({
    match: (await kv.get(activeMatchKey(userId, deviceId))) || null,
  })
})

app.post(`${API_PREFIX}/matches/:deviceId/active`, async (c) => {
  const userId = c.get("userId") as string
  const deviceId = c.req.param("deviceId")
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(deviceId))
    return c.json({ error: "Invalid device identifier." }, 400)
  try {
    const body = await readJson(c)
    if (
      ![body.runs, body.wickets, body.balls].every(
        (value) => Number.isInteger(value) && value >= 0,
      )
    )
      throw new Error(
        "Runs, wickets and balls must be non-negative whole numbers.",
      )
    if (!Array.isArray(body.deliveries))
      throw new Error("Deliveries must be an array.")
    const match = {
      runs: body.runs,
      wickets: body.wickets,
      balls: body.balls,
      deliveries: body.deliveries.slice(-100),
      updatedAt: new Date().toISOString(),
    }
    await kv.set(activeMatchKey(userId, deviceId), match)
    return c.json({ match })
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : "Invalid score state.",
      },
      400,
    )
  }
})

Deno.serve(app.fetch)
