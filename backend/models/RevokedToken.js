import mongoose from "mongoose";

// A login token that has been ended (the person signed out). Tokens are remembered by a fingerprint
// (a SHA-256 hash), never by the token itself, so this list can't be used to sign in. Each entry
// is removed by the database once the token would have expired anyway, so the list stays small.
const revokedTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, minlength: 64, maxlength: 64 },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// expireAfterSeconds: 0 means "delete this entry at the moment in expiresAt".
revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("RevokedToken", revokedTokenSchema);