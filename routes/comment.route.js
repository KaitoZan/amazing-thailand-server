// routes/comment.route.js
const commentCtrl = require("./../controllers/comment.controller.js");
const express = require("express");
const router = express.Router();

router.post("/", commentCtrl.createComment);

router.get("/photos/:photoId", commentCtrl.getCommentsForPhoto);

router.put("/:commentId", commentCtrl.editComment);

router.delete("/:commentId", commentCtrl.deleteComment);

module.exports = router;