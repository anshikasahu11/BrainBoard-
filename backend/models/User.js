import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true, // MongoDB enforces this, even if two requests arrive at once
      lowercase: true,
      trim: true,
    },
    // select: false means queries never return the hash unless asked explicitly.
    password: { type: String, required: true, select: false },
    avatar: { type: String, default: "" },
  },
  { timestamps: true } // adds createdAt and updatedAt
);

// Hash the password before saving, but only when it was set or changed.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Shape of the user object sent to the browser. The password is never included.
userSchema.set("toJSON", {
  transform(doc, ret) {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  },
});

export default mongoose.model("User", userSchema);