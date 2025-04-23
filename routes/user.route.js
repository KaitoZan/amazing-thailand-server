// routes/user.route.js
const userCtrl = require("./../controllers/user.controller.js");
const express = require("express");
const router = express.Router();

router.post("/register", userCtrl.uploadUser, userCtrl.createUser);

router.post("/login", userCtrl.checkLogin);

router.put("/:userId", userCtrl.uploadUser, userCtrl.editUser);

router.get("/:userId", userCtrl.getUserById);
module.exports = router;
