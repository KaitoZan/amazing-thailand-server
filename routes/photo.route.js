// routes/photo.route.js
const photoCtrl = require("./../controllers/photo.controller.js");
const express = require("express");
const router = express.Router();
const multer = require('multer');

router.get("/", photoCtrl.getAllPhotos);

router.get("/:photoId", photoCtrl.getPhotoDetails);

router.post("/", (req, res, next) => {
    photoCtrl.uploadPhoto(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            console.error("Multer Error:", err);
            return res.status(500).json({ message: "File upload failed (Multer Error)", error: err.message });
        } else if (err) {
            console.error("Unknown Upload Error:", err);
            return res.status(500).json({ message: "File upload failed (Unknown Error)", error: err.message });
        }
        next();
    });
}, photoCtrl.createPhoto);

router.put("/:photoId", photoCtrl.uploadPhoto, photoCtrl.editPhoto);

router.delete("/:photoId", photoCtrl.deletePhoto);

module.exports = router;