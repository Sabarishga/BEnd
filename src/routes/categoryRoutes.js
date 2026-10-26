const express = require("express");
const createCategory = require("../Controllers/categoryController");

const router = express.Router();

router.post("/categories", createCategory);

module.exports = router;
