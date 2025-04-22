const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const multer = require("multer");
const path = require("path");

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        console.log("CloudinaryStorage params executing..."); // เพิ่ม Log
        const newFile = "photo_" + Math.floor(Math.random() * Date.now());
        console.log("Generated new file name:", newFile); // เพิ่ม Log
        const result = {
            folder: "amazing-thailand-2025/photos",
            allowed_formats: ["jpg", "png", "jpeg", "gif"],
            public_id: newFile,
        };
        console.log("CloudinaryStorage params result:", result); // เพิ่ม Log
        return result;
    },
});

exports.uploadPhoto = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5 MB limit example
    },
    fileFilter: (req, file, cb) => {
        console.log("File Filter executing..."); // เพิ่ม Log
        console.log("File originalname:", file.originalname); // เพิ่ม Log
        console.log("File mimetype:", file.mimetype); // เพิ่ม Log
        // console.log("File extname:", path.extname(file.originalname).toLowerCase()); // เพิ่ม Log ส่วนขยายไฟล์

        // // โค้ดเดิมที่ตรวจสอบประเภทไฟล์
        // const fileTypes = /jpeg|jpg|png|gif/;
        // const mimeType = fileTypes.test(file.mimetype);
        // const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        // if (mimeType && extname) {
        //     console.log("File Filter passed."); // เพิ่ม Log
        //     return cb(null, true);
        // }
        // console.log("File Filter failed."); // เพิ่ม Log
        // cb(new Error("Error: Images Only! (Accepted formats: jpeg, jpg, png, gif)"));

        // ทำให้ File Filter อนุญาตทุกไฟล์ชั่วคราวเพื่อทดสอบ
        console.log("File Filter passing file (temporarily allowing all)."); // เพิ่ม Log
        cb(null, true); // อนุญาตให้ไฟล์ผ่านเสมอเพื่อทดสอบ
    },
}).single("photoImage");

exports.getAllPhotos = async (req, res) => {
    try {
        const photos = await prisma.photos.findMany({
            include: {
                user: {
                    select: {
                        user_id: true,
                        username: true,
                        profile_picture_url: true,
                    }
                }
            },
             orderBy: {
                 created_at: 'desc'
             }
        });

        res.status(200).json({ message: "Photos fetched successfully", data: photos });
    } catch (error) {
        console.error("Error fetching photos:", error);
        res.status(500).json({ message: "Failed to fetch photos", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};

exports.getPhotoDetails = async (req, res) => {
    try {
        const photoId = parseInt(req.params.photoId);

        const photo = await prisma.photos.findUnique({
            where: { photo_id: photoId },
             include: {
                 user: {
                     select: {
                         user_id: true,
                         username: true,
                         profile_picture_url: true,
                     }
                 },
                 comments: {
                     include: {
                         user: {
                             select: {
                                 user_id: true,
                                 username: true,
                                 profile_picture_url: true,
                             }
                         }
                     },
                     orderBy: { created_at: 'asc' }
                 }
             }
        });

        if (!photo) {
            return res.status(404).json({ message: "Photo not found" });
        }

        res.status(200).json({ message: "Photo fetched successfully", data: photo });

    } catch (error) {
        console.error("Error fetching photo details:", error);
        res.status(500).json({ message: "Failed to fetch photo details", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};

exports.createPhoto = async (req, res) => {
    try {
        console.log("Request Body:", req.body);
        console.log("Request File:", req.file);

        const { location_name, description, user_id } = req.body;

        if (!location_name || !user_id || !req.file) {
             if (req.file) {
                 cloudinary.uploader.destroy(req.file.filename).catch(err => console.error("Failed to delete uploaded file on validation error:", err));
             }
            return res.status(400).json({ message: "Location name, user ID, and photo image are required." });
        }

        const imageUrl = req.file.path;

        const newPhoto = await prisma.photos.create({
            data: {
                location_name: location_name,
                description: description || null,
                user_id: parseInt(user_id),
                image_url: imageUrl,
            },
             select: {
                 photo_id: true,
                 location_name: true,
                 image_url: true,
                 created_at: true,
                 user_id: true,
             },
        });

        res.status(201).json({ message: "Photo created successfully", data: newPhoto });

    } catch (error) {
        console.error("Error creating photo:", error);
         if (req.file) {
              cloudinary.uploader.destroy(req.file.filename).catch(err => console.error("Failed to delete uploaded file on error:", err));
         }
        res.status(500).json({ message: "Failed to create photo", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};

exports.editPhoto = async (req, res) => {
    try {
        const photoId = parseInt(req.params.photoId);
        const { location_name, description } = req.body;

         const updateData = {};
         if (location_name !== undefined) updateData.location_name = location_name;
         if (description !== undefined) updateData.description = description;

        if (req.file) {
            const photo = await prisma.photos.findUnique({
                 where: { photo_id: photoId },
                 select: { image_url: true }
            });

             if (photo && photo.image_url) {
                 const urlParts = photo.image_url.split('/');
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
                             console.log("Old photo image deleted successfully from Cloudinary:", fullPublicId);
                         } catch (err) {
                             console.error("Error deleting old photo image from Cloudinary:", err);
                         }
                     }
                 } else {
                     console.warn("Could not extract public_id from old Cloudinary URL:", photo.image_url);
                 }
             }
             updateData.image_url = req.file.path;
        }

        const updatedPhoto = await prisma.photos.update({
            where: { photo_id: photoId },
            data: updateData,
             select: {
                 photo_id: true,
                 location_name: true,
                 image_url: true,
                 updated_at: true,
                 user_id: true,
             },
        });

        res.status(200).json({ message: "Photo updated successfully", data: updatedPhoto });

    } catch (error) {
        console.error("Error updating photo:", error);
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
        if (error.code === 'P2025') {
              return res.status(404).json({
                  message: `Photo with ID ${photoId} not found.`,
                  error: process.env.NODE_ENV === 'development' ? error.message : 'Record not found.',
              });
         }
        res.status(500).json({ message: "Failed to update photo", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};

exports.deletePhoto = async (req, res) => {
    try {
        const photoId = parseInt(req.params.photoId);

        const photo = await prisma.photos.findUnique({
            where: { photo_id: photoId },
            select: { image_url: true },
        });

        if (!photo) {
            return res.status(404).json({ message: "Photo not found" });
        }

        if (photo.image_url) {
            const urlParts = photo.image_url.split('/');
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
                             console.log("Photo image deleted successfully from Cloudinary:", fullPublicId);
                         } catch (err) {
                             console.error("Error deleting photo image from Cloudinary:", err);
                         }
                     }
                 } else {
                      console.warn("Could not extract public_id from Cloudinary URL for deletion:", photo.image_url);
                 }
        }

        const deletedPhoto = await prisma.photos.delete({
            where: { photo_id: photoId },
             select: {
                 photo_id: true,
                 location_name: true,
                 image_url: true,
             }
        });

        res.status(200).json({ message: "Photo deleted successfully", data: deletedPhoto });

    } catch (error) {
        console.error("Error deleting photo:", error);
         if (error.code === 'P2025') {
              return res.status(404).json({
                  message: `Photo with ID ${photoId} not found.`,
                  error: process.env.NODE_ENV === 'development' ? error.message : 'Record not found.',
              });
         }
        res.status(500).json({ message: "Failed to delete photo", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};