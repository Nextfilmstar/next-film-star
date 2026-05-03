import { getDatabase } from "@netlify/database";

export default async (req: Request) => {
  const db = getDatabase();
  if (req.method === "POST") {
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const contestantId =
      typeof payload?.contestantId === "string" ? payload.contestantId.trim() : "";
    const voterEmailRaw =
      typeof payload?.voterEmail === "string" ? payload.voterEmail.trim() : "";
    const voterNameRaw =
      typeof payload?.voterName === "string" ? payload.voterName.trim() : "";
    const contestantName =
      typeof payload?.contestantName === "string" ? payload.contestantName : null;
    const votesAddedRaw = Number(payload?.votesAdded);
    const votesAdded =
      Number.isFinite(votesAddedRaw) && votesAddedRaw > 0
        ? Math.floor(votesAddedRaw)
        : 1;

    if (!contestantId || !voterEmailRaw) {
      return Response.json(
        { error: "contestantId and voterEmail are required" },
        { status: 400 },
      );
    }

    const voterEmail = voterEmailRaw.toLowerCase();
    const voterName = voterNameRaw || null;

    const [row] = await db.sql`
      INSERT INTO vote_events (contestant_id, contestant_name, voter_email, voter_name, votes_added)
      VALUES (${contestantId}, ${contestantName}, ${voterEmail}, ${voterName}, ${votesAdded})
      RETURNING id, contestant_id, contestant_name, voter_email, voter_name, votes_added, voted_at
    `;

    return Response.json({ ok: true, event: row }, { status: 201 });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const contestantId = url.searchParams.get("contestantId");

    if (!contestantId) {
      return Response.json(
        { error: "contestantId query parameter is required" },
        { status: 400 },
      );
    }

    const voters = await db.sql`
      SELECT
        voter_email,
        MAX(voter_name) AS voter_name,
        SUM(votes_added)::int AS total_votes,
        COUNT(*)::int AS event_count,
        MIN(voted_at) AS first_voted_at,
        MAX(voted_at) AS last_voted_at
      FROM vote_events
      WHERE contestant_id = ${contestantId}
      GROUP BY voter_email
      ORDER BY total_votes DESC, last_voted_at DESC
    `;

    const events = await db.sql`
      SELECT id, voter_email, voter_name, votes_added, voted_at
      FROM vote_events
      WHERE contestant_id = ${contestantId}
      ORDER BY voted_at DESC
      LIMIT 500
    `;

    const totalRow = await db.sql`
      SELECT COALESCE(SUM(votes_added), 0)::int AS total
      FROM vote_events
      WHERE contestant_id = ${contestantId}
    `;

    return Response.json({
      contestantId,
      totalTrackedVotes: totalRow[0]?.total ?? 0,
      uniqueVoters: voters.length,
      voters,
      events,
    });
  }

  return new Response("Method Not Allowed", { status: 405 });
};
