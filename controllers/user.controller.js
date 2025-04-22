// controllers/user.controller.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const bcrypt = require("bcryptjs");

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const multer = require("multer");
const path = require("path");

// require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const newFile = "user_" + Math.floor(Math.random() * Date.now());
        return {
            folder: "amazing-thailand-2025/users",
            allowed_formats: ["jpg", "png", "jpeg", "gif"],
            public_id: newFile,
        };
    },
});

exports.uploadUser = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024, // 1 MB
    },
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|gif/;
        const mimeType = fileTypes.test(file.mimetype);
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());

        if (mimeType && extname) {
            return cb(null, true);
        }
        cb(new Error("Error: Images Only! (Accepted formats: jpeg, jpg, png, gif)"));
    },
}).single("profilePicture");

exports.createUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
             if (req.file) {
                 cloudinary.uploader.destroy(req.file.filename).catch(err => console.error("Failed to delete uploaded file on validation error:", err));
             }
            return res.status(400).json({ message: "Please provide username, email, and password." });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const profilePictureUrl = req.file ? req.file.path : null;

        const newUser = await prisma.users.create({
            data: {
                username: username,
                email: email,
                password_hash: passwordHash,
                profile_picture_url: profilePictureUrl,
            },
            select: {
                user_id: true,
                username: true,
                email: true,
                profile_picture_url: true,
                created_at: true,
            },
        });

        res.status(201).json({
            message: "User registered successfully",
            data: newUser,
        });

    } catch (error) {
        console.error("Error creating user:", error);

        if (error.code === 'P2002') {
             if (req.file) {
                 cloudinary.uploader.destroy(req.file.filename).catch(err => console.error("Failed to delete uploaded file on DB error:", err));
             }
            const target = error.meta.target.join(', ');
            return res.status(409).json({
                message: `User with this ${target} already exists.`,
                error: process.env.NODE_ENV === 'development' ? error.message : 'Duplicate entry error.',
            });
        }

         if (req.file) {
             cloudinary.uploader.destroy(req.file.filename).catch(err => console.error("Failed to delete uploaded file on generic error:", err));
         }
        res.status(500).json({
            message: "Failed to register user",
            error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.',
        });
    }
};

exports.checkLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Please provide email and password." });
        }

        const user = await prisma.users.findUnique({
            where: {
                email: email,
            },
             select: {
                user_id: true,
                username: true,
                email: true,
                profile_picture_url: true,
                password_hash: true,
            },
        });

        if (user && await bcrypt.compare(password, user.password_hash)) {
             const { password_hash, ...userData } = user;
            res.status(200).json({
                message: "User login successfully",
                data: userData,
            });
        } else {
            res.status(401).json({
                message: "Invalid email or password",
            });
        }

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({
            message: "An internal server error occurred during login",
            error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.',
        });
    }
};

exports.editUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { username, email, password } = req.body;

         const updateData = {};
         if (username !== undefined) updateData.username = username;
         if (email !== undefined) updateData.email = email;

        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password_hash = await bcrypt.hash(password, salt);
        }

        if (req.file) {
            const user = await prisma.users.findUnique({
                 where: { user_id: userId },
                 select: { profile_picture_url: true }
            });

             if (user && user.profile_picture_url) {
                 const urlParts = user.profile_picture_url.split('/');
                 const uploadFolderIndex = urlParts.indexOf('amazing-thailand-2025');
                 if (uploadFolderIndex > -1) {
                     const folderAndPublicIdParts = urlParts.slice(uploadFolderIndex);
                     const publicIdWithExt = folderAndPublicIdParts.pop();
                     const folder = folderAndPublicIdParts.join('/');
                     const publicId = publicIdWithExt.split('.')[0];
                     const fullPublicId = `${folder}/${publicId}`;

                     if (fullPublicId) {
                         try {
                             await cloudinary.uploader.destroy(fullPublicId);
                             console.log("Old image deleted successfully from Cloudinary:", fullPublicId);
                         } catch (err) {
                             console.error("Error deleting old image from Cloudinary:", err);
                         }
                     }
                 } else {
                     console.warn("Could not extract public_id from old Cloudinary URL:", user.profile_picture_url);
                 }
             }

             updateData.profile_picture_url = req.file.path;
        }

        const updatedUser = await prisma.users.update({
            where: { user_id: userId },
            data: updateData,
             select: {
                 user_id: true,
                 username: true,
                 email: true,
                 profile_picture_url: true,
                 updated_at: true,
             },
        });

        res.status(200).json({
            message: "User updated successfully",
            data: updatedUser,
        });

    } catch (error) {
        console.error("Error updating user:", error);

         if (req.file) {
               const newUrlParts = req.file.path.split('/');
               const newUploadFolderIndex = newUrlParts.indexOf('amazing-thailand-2025');
                 if (newUploadFolderIndex > -1) {
                     const newFolderAndPublicIdParts = newUrlParts.slice(newUploadFolderIndex);
                     const newPublicIdWithExt = newFolderAndPublicIdParts.pop();
                     const newFolder = newFolderAndPublicIdParts.join('/');
                     const newPublicId = newPublicIdWithExt.split('.')[0];
                     const newFullPublicId = `${newFolder}/${newPublicId}`;

                     if (newFullPublicId) {
                         cloudinary.uploader.destroy(newFullPublicId)
                             .catch(err => console.error("Failed to delete new uploaded file on error:", err));
                     }
                 }
         }

        if (error.code === 'P2002') {
             const target = error.meta.target.join(', ');
             return res.status(409).json({
                 message: `Update failed: User with this ${target} already exists.`,
                 error: process.env.NODE_ENV === 'development' ? error.message : 'Duplicate entry error.',
             });
         } else if (error.code === 'P2025') {
              return res.status(404).json({
                  message: `User with ID ${userId} not found.`,
                  error: process.env.NODE_ENV === 'development' ? error.message : 'Record not found.',
              });
         }

        res.status(500).json({
            message: "Failed to update user",
            error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.',
        });
    }
};