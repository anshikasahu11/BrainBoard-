import AiUsage from "../models/AiUsage.js";

const tokens = { $sum: { $add: ["$inputTokens", "$outputTokens"] } };

// What has been used so far on `day`: this person's requests, this workspace's tokens, and
// everyone's tokens. workspaceId and userId are the ids as stored (ObjectIds).
export async function getUsage({ workspaceId, userId, day }) {
  const [userRequests, workspaceRows, globalRows] = await Promise.all([
    AiUsage.countDocuments({ user: userId, day }),
    AiUsage.aggregate([{ $match: { workspace: workspaceId, day } }, { $group: { _id: null, tokens } }]),
    AiUsage.aggregate([{ $match: { day } }, { $group: { _id: null, tokens } }]),
  ]);

  return {
    userRequests,
    workspaceTokens: workspaceRows[0]?.tokens ?? 0,
    globalTokens: globalRows[0]?.tokens ?? 0,
  };
}

// Writes one line to the ledger. It never throws: a ledger hiccup must not break an answer
// the person already waited for.
export async function recordUsage(entry) {
  try {
    await AiUsage.create(entry);
  } catch (error) {
    console.error("Recording AI usage failed:", error.message);
  }
}