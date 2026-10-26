const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Notification = require("../models/Notification");
const { ALLOWED_CATEGORIES } = require("../constants/newsCategories");
const { sendPasswordResetEmail } = require("../services/emailService");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const normalizeCategories = (categories, category) => {
  const selected = categories === undefined
    ? (category ? [category] : ["general"])
    : categories;
  if (!Array.isArray(selected) || selected.some(
    (value) => typeof value !== "string" || !ALLOWED_CATEGORIES.includes(value.toLowerCase())
  )) {
    return null;
  }
  return [...new Set(selected.map((value) => value.toLowerCase()))];
};

const registerUser = async (req, res) => {
  const { name, email, password, categories, category, frequency } = req.body;
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (normalizedName.length < 3 || normalizedName.length > 50) {
    return res.status(400).json({
      message: "Name must be between 3 and 50 characters",
    });
  }

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({
      message: "Email and a password between 8 and 72 bytes are required",
    });
  }

  const selectedCategories = normalizeCategories(categories, category);
  if (!selectedCategories) {
    return res.status(400).json({
      message: `Invalid categories. Allowed options: ${ALLOWED_CATEGORIES.join(", ")}`,
    });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(400).json({ message: "Email is already registered" });
    }

    const newUser = new User({
      name: normalizedName,
      email: normalizedEmail,
      password,
      categories: selectedCategories.length ? selectedCategories : ["general"],
      frequency: frequency || "daily",
      subscribed: true,
    });
    await newUser.save();

    const userResponse = newUser.toObject();
    delete userResponse.password;
    res.status(201).json(userResponse);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: "Email is already registered" });
    }
    console.error("Unable to register:", err.message);
    res.status(500).json({ message: "Unable to register" });
  }
};


router.post("/auth/register", registerUser);

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    await User.updateOne({ _id: user._id }, { isLoggedIn: true });
    res.json({ email: user.email, message: "Login successful" });
  } catch (err) {
    console.error("Unable to log in:", err.message);
    res.status(500).json({ message: "Unable to log in" });
  }
});

router.post("/auth/logout", async (req, res) => {
  const { email } = req.body;
  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    await User.updateOne(
      { email: email.trim().toLowerCase() },
      { isLoggedIn: false }
    );
    res.json({ message: "Logged out" });
  } catch (err) {
    console.error("Unable to log out:", err.message);
    res.status(500).json({ message: "Unable to log out" });
  }
});

router.post("/auth/change-password", async (req, res) => {
  const { email, currentPassword, password } = req.body;
  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof currentPassword !== "string" ||
    !currentPassword ||
    Buffer.byteLength(currentPassword, "utf8") > 72 ||
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({
      message: "Email, current password, and a new password between 8 and 72 bytes are required",
    });
  }

  try {
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password +passwordResetTokenHash +passwordResetExpires");
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ message: "Invalid email or current password" });
    }

    user.password = password;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateModifiedOnly: true });
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Unable to change password:", err.message);
    res.status(500).json({ message: "Unable to change password" });
  }
});

router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (typeof email !== "string" || !email.trim()) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      user.passwordResetTokenHash = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      try {
        await sendPasswordResetEmail(user.email, resetToken);
      } catch (err) {
        user.passwordResetTokenHash = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        console.error("Unable to send password reset email:", err.message);
        return res.status(502).json({ message: "Unable to send password reset email" });
      }
    }

    res.json({ message: "If the email is registered, a reset link has been sent." });
  } catch (err) {
    console.error("Unable to request password reset:", err.message);
    res.status(500).json({ message: "Unable to request password reset" });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  const { email, token, password } = req.body;
  if (
    typeof email !== "string" ||
    typeof token !== "string" ||
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    return res.status(400).json({
      message: "Email, reset token, and a password between 8 and 72 bytes are required",
    });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select("+password +passwordResetTokenHash +passwordResetExpires");

    if (!user) {
      return res.status(400).json({ message: "Reset link is invalid or has expired" });
    }

    user.password = password;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Unable to reset password:", err.message);
    res.status(500).json({ message: "Unable to reset password" });
  }
});

// Keep password-based registration working for existing API clients.
router.post("/subscribe", async (req, res) => {
  if (typeof req.body.password === "string") {
    return registerUser(req, res);
  }

  try {
    const { email, categories, category, frequency } = req.body;
    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ message: "Email is required" });
    }

    const selectedCategories = normalizeCategories(categories, category);
    if (!selectedCategories) {
      return res.status(400).json({
        message: `Invalid categories. Allowed options: ${ALLOWED_CATEGORIES.join(", ")}`,
      });
    }

    const user = await User.findOneAndUpdate(
      { email: email.trim().toLowerCase() },
      {
        categories: selectedCategories.length ? selectedCategories : ["general"],
        ...(frequency && { frequency }),
        subscribed: true,
      },
      { new: true, runValidators: true },
    ).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Unable to subscribe:", err.message);
    res.status(500).json({ message: "Unable to subscribe" });
  }
});

// Get a user's current preferences
router.get("/preferences/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update preferences when a logged-in user clicks a different category button
router.put("/preferences/:email", async (req, res) => {
  try {
    const { categories, category, frequency } = req.body;

    const selectedCategories = categories !== undefined || category
      ? normalizeCategories(categories, category)
      : undefined;
    if (selectedCategories === null) {
      return res.status(400).json({
        message: `Invalid categories. Allowed options: ${ALLOWED_CATEGORIES.join(", ")}`,
      });
    }

    const user = await User.findOneAndUpdate(
      { email: req.params.email.toLowerCase() },
      {
        ...(selectedCategories !== undefined && {
          categories: selectedCategories.length ? selectedCategories : ["general"],
        }),
        ...(frequency && { frequency }),
      },
      { new: true, runValidators: true }
    ).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Unsubscribe
router.post("/unsubscribe", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { subscribed: false },
      { new: true }
    ).select("-password");
    
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Notification history for a user
router.get("/notifications/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const notifications = await Notification.find({ user: user._id })
      .sort({ sentAt: -1 })
      .limit(50);

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Clear all notifications for a user
router.delete("/notifications/:email", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "User not found" });

    await Notification.deleteMany({ user: user._id });
    res.json({ message: "All notifications cleared" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;