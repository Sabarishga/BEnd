const express = require("express");
const {
  getDashboardNotifications,
  getDashboardSummary,
} = require("../Controllers/dashboardController");

const router = express.Router();

router.get("/dashboard/notifications", getDashboardNotifications);
router.get("/dashboard/summary", getDashboardSummary);

module.exports = router;