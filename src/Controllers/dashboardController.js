const User = require("../models/User");
const Notification = require("../models/Notification");
const { ALLOWED_CATEGORIES } = require("../constants/newsCategories");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parseCategories = (raw) => {
  if (raw === undefined) return [];
  const parts = Array.isArray(raw) ? raw : [raw];
  const result = [];

  for (const part of parts) {
    if (typeof part !== "string") return null;
    for (const value of part.split(",")) {
      const category = value.trim().toLowerCase();
      if (!category) continue;
      if (!ALLOWED_CATEGORIES.includes(category)) return null;
      result.push(category);
    }
  }
  return [...new Set(result)];
};

const parseDate = (value) => {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parsePositiveInt = (value, fallback) => {
  if (value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const findUserByEmail = async (email) => {
  if (typeof email !== "string" || !email.trim()) return { error: "Email is required", status: 400 };
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select("_id");
  if (!user) return { error: "User not found", status: 404 };
  return { user };
};


const getDashboardNotifications = async (req, res) => {
  const { email, category, sort = "newest", from, to } = req.query;

  const categories = parseCategories(category);
  if (categories === null) {
    return res.status(400).json({
      message: `Invalid category. Allowed options: ${ALLOWED_CATEGORIES.join(", ")}`,
    });
  }

  if (sort !== "newest" && sort !== "oldest") {
    return res.status(400).json({ message: "Invalid sort. Allowed options: newest, oldest" });
  }

  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (fromDate === null || toDate === null) {
    return res.status(400).json({ message: "from and to must be valid dates (e.g. 2026-10-25)" });
  }

  const page = parsePositiveInt(req.query.page, 1);
  let limit = parsePositiveInt(req.query.limit, DEFAULT_LIMIT);
  if (page === null || limit === null) {
    return res.status(400).json({ message: "page and limit must be positive integers" });
  }
  limit = Math.min(limit, MAX_LIMIT);

  try {
    const found = await findUserByEmail(email);
    if (found.error) return res.status(found.status).json({ message: found.error });

    const filter = { user: found.user._id };
    if (categories.length) filter.category = { $in: categories };
    if (fromDate || toDate) {
      filter.sentAt = {};
      if (fromDate) filter.sentAt.$gte = fromDate;
      if (toDate) filter.sentAt.$lte = toDate;
    }

    const direction = sort === "oldest" ? 1 : -1;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ sentAt: direction, _id: direction })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    return res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      filters: { categories, sort, from: fromDate || null, to: toDate || null },
    });
  } catch (err) {
    console.error("Unable to load dashboard notifications:", err.message);
    return res.status(500).json({ message: "Unable to load notification history" });
  }
};


const getDashboardSummary = async (req, res) => {
  try {
    const found = await findUserByEmail(req.query.email);
    if (found.error) return res.status(found.status).json({ message: found.error });

    const byCategory = await Notification.aggregate([
      { $match: { user: found.user._id } },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          lastSentAt: { $max: "$sentAt" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const total = byCategory.reduce((sum, item) => sum + item.count, 0);
    const lastSentAt = byCategory.reduce(
      (latest, item) => (!latest || item.lastSentAt > latest ? item.lastSentAt : latest),
      null
    );

    return res.json({
      total,
      lastSentAt,
      categories: byCategory.map((item) => ({
        category: item._id || "uncategorized",
        count: item.count,
        lastSentAt: item.lastSentAt,
      })),
      allowedCategories: ALLOWED_CATEGORIES,
    });
  } catch (err) {
    console.error("Unable to load dashboard summary:", err.message);
    return res.status(500).json({ message: "Unable to load dashboard summary" });
  }
};

module.exports = { getDashboardNotifications, getDashboardSummary };