const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true,
      trim: true,
      minLength: 3,
      maxLength: 50 
    },
    email: {
      type: String,
      required: true,
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid Email"],
      lowercase: true,
    },
    password: { 
      type: String, 
      required: true,
      minLength: 8,
      select: false 
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    categories: {
      type: [String],
      trim: true,
      default: ["general"],
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    isVerified: { type: Boolean, 
      default: false 
    },
    frequency: {
      type: String,
      enum: ["immediate", "hourly", "daily"],
      default: "daily",
    },
    subscribed: { type: Boolean, default: true },
    lastSentAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

module.exports = mongoose.model("User", userSchema);
