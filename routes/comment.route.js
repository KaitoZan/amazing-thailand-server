const commentCtrl = require("./../controllers/comment.controller.js");
const express = require("express");
const router = express.Router();

router.post("/", commentCtrl.createComment);

router.get("/photos/:photoId", commentCtrl.getCommentsForPhoto);

router.delete("/:commentId", commentCtrl.deleteComment);

module.exports = router;