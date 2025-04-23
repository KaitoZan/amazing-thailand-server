// controllers/photo.controller.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const multer = require("multer");
const path = require("path");

// ตรวจสอบให้แน่ใจว่ามีการกำหนดค่า Cloudinary ในไฟล์ .env หรือ config
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        console.log("CloudinaryStorage params executing..."); // เพิ่ม Log
        // สร้างชื่อไฟล์ที่ไม่ซ้ำกัน โดยใช้ timestamp และ random number
        const newFile = "photo_" + Math.floor(Math.random() * Date.now());
        console.log("Generated new file name:", newFile); // เพิ่ม Log
        const result = {
            folder: "amazing-thailand-2025/photos", // Folder ใน Cloudinary
            allowed_formats: ["jpg", "png", "jpeg", "gif"], // อนุญาตเฉพาะ format เหล่านี้
            public_id: newFile, // ชื่อ Public ID ใน Cloudinary
        };
        console.log("CloudinaryStorage params result:", result); // เพิ่ม Log
        return result;
    },
});

// ตั้งค่า Multer Upload สำหรับรูปภาพเดียว ใน field ชื่อ "photoImage"
exports.uploadPhoto = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // จำกัดขนาดไฟล์ไม่เกิน 5 MB (ตัวอย่าง)
    },
    fileFilter: (req, file, cb) => {
        console.log("File Filter executing..."); // เพิ่ม Log
        console.log("File originalname:", file.originalname); // เพิ่ม Log
        console.log("File mimetype:", file.mimetype); // เพิ่ม Log

        // โค้ดตรวจสอบประเภทไฟล์ที่อนุญาต (นำมาใช้งานจริง)
        const fileTypes = /jpeg|jpg|png|gif/;
        const mimeType = fileTypes.test(file.mimetype);
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());

        if (mimeType && extname) {
             console.log("File Filter passed."); // เพิ่ม Log
             return cb(null, true); // อนุญาตไฟล์นี้
        }

         console.log("File Filter failed."); // เพิ่ม Log
         cb(new Error("Error: Images Only! (Accepted formats: jpeg, jpg, png, gif)")); // ไม่อนุญาตไฟล์

    },
}).single("photoImage"); // ชื่อ Field ใน Form Data ที่ใช้ส่งรูปภาพ


// --- แก้ไข Function นี้เพื่อเพิ่ม Logic Search และ Date Filtering ---
exports.getAllPhotos = async (req, res) => {
    try {
        // --- 1. เข้าถึง Query Parameter ที่ Frontend ส่งมา ---
        const searchTerm = req.query.search;
        const startDate = req.query.startDate; // YYYY-MM-DD format จาก Frontend
        const endDate = req.query.endDate;   // YYYY-MM-DD format จาก Frontend

        console.log("Backend received search term:", searchTerm);
        console.log("Backend received start date:", startDate);
        console.log("Backend received end date:", endDate);
        // --------------------------------------------------


        // --- 2. สร้าง WHERE condition object สำหรับ Prisma ---
        const whereConditions = {}; // Object สำหรับเก็บเงื่อนไข WHERE ใน Prisma Syntax

        // เพิ่มเงื่อนไข Search Term ถ้ามี
        if (searchTerm) {
            // ใช้ Prisma's `OR` เพื่อรวมเงื่อนไขการค้นหาในหลาย Field
            // ใช้ `contains` สำหรับการค้นหาแบบ Substring (หาคำที่อยู่ในข้อความ)
            // ใช้ `mode: 'insensitive'` สำหรับการค้นหาแบบไม่สนใจตัวพิมพ์เล็กใหญ่ (Case-Insensitive)
            // หมายเหตุ: `mode: 'insensitive'` รองรับบนฐานข้อมูลบางประเภท เช่น PostgreSQL
            // ถ้าใช้ MySQL และต้องการ Case-Insensitive อาจต้องปรับ Config ฐานข้อมูล
            // หรือถ้าไม่ได้ผล อาจต้องพิจารณาใช้ Raw Query หรือวิธีอื่น
            whereConditions.OR = [
                { location_name: { contains: searchTerm, mode: 'insensitive' } }, // ค้นใน location_name
                { description: { contains: searchTerm, mode: 'insensitive' } },   // ค้นใน description
                // สมมติว่าคุณได้กำหนด Relation ชื่อ 'user' ใน Schema.prisma ของ Photo Model
                // และ User Model มี Field ชื่อ 'username'
                { user: { username: { contains: searchTerm, mode: 'insensitive' } } } // ค้นใน username ของ User ที่โพสต์
            ];
        }

        // เพิ่มเงื่อนไข Date Range ถ้ามี
        if (startDate || endDate) {
            whereConditions.created_at = {}; // สร้าง Object ซ้อนสำหรับเงื่อนไขวันที่
            if (startDate) {
                // ใช้ `gte` (Greater Than or Equal to) สำหรับวันที่เริ่มต้น
                // แปลง String YYYY-MM-DD เป็น Object Date
                 // Note: การจัดการ Time Zone และเวลาเริ่มต้น/สิ้นสุดของวันอาจต้องการการพิจารณาเพิ่มเติม
                 // ขึ้นอยู่กับการตั้งค่า Database และ Prisma
                whereConditions.created_at.gte = new Date(startDate);
            }
            if (endDate) {
                 // ใช้ `lte` (Less Than or Equal to) สำหรับวันที่สิ้นสุด
                 // เพื่อให้รวมโพสต์ทั้งหมดในวันสิ้นสุดนั้น ควรตั้งเวลาเป็น 23:59:59.999
                 const endOfDay = new Date(endDate);
                 endOfDay.setHours(23, 59, 59, 999);
                 whereConditions.created_at.lte = endOfDay;

                 // Alternatively, if your DB/Prisma handles YYYY-MM-DD comparison for full days:
                 // whereConditions.created_at.lte = endDate;
            }
        }


        console.log("Prisma WHERE conditions:", whereConditions); // Log Object เงื่อนไข WHERE ที่สร้างขึ้น


        // --- 3. เรียกใช้ Prisma's findMany พร้อมเงื่อนไข WHERE ---
        const photos = await prisma.photos.findMany({
            where: whereConditions, // ส่ง Object เงื่อนไข WHERE เข้าไปตรงนี้
            include: {
                user: { // ยังคง Include user data ตามเดิม
                    select: {
                        user_id: true,
                        username: true,
                        profile_picture_url: true, // ดึง profile_picture_url ของ user มาด้วยถ้าต้องการแสดง
                    }
                }
            },
            orderBy: {
                 created_at: 'desc' // ยังคงเรียงลำดับตามวันที่สร้างล่าสุด
            }
        });

        console.log(`Found ${photos.length} photos after filtering.`); // Log จำนวนรูปที่พบหลังจากกรอง

        // --- 4. ส่งผลลัพธ์ (รูปภาพที่ถูกกรองแล้ว) กลับไปให้ Frontend ---
        res.status(200).json({ message: "Photos fetched successfully", data: photos });

    } catch (error) {
        console.error("Error fetching photos with filters:", error);
        // ส่ง Error Message ที่ละเอียดขึ้นในโหมด Development
        res.status(500).json({ message: "Failed to fetch photos", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};
// --- สิ้นสุดการแก้ไข Function getAllPhotos ---


// --- Function getPhotoDetails (คงเดิม) ---
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
                     orderBy: { created_at: 'asc' } // เรียง Comment ตามเวลาเก่าสุดไปใหม่สุด
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


// --- Function createPhoto (คงเดิม) ---
exports.createPhoto = async (req, res) => {
    try {
        console.log("Request Body:", req.body);
        console.log("Request File:", req.file);

        const { location_name, description, user_id } = req.body;

        if (!location_name || !user_id || !req.file) {
             if (req.file) {
                 // ลบไฟล์ที่อัปโหลดขึ้น Cloudinary ถ้า validation ไม่ผ่าน
                 cloudinary.uploader.destroy(req.file.filename).catch(err => console.error("Failed to delete uploaded file on validation error:", err));
             }
            return res.status(400).json({ message: "Location name, user ID, and photo image are required." });
        }

        const imageUrl = req.file.path; // URL ของรูปภาพที่ได้จาก Cloudinary Storage (Multer middleware จะเพิ่มให้)

        const newPhoto = await prisma.photos.create({
            data: {
                location_name: location_name,
                description: description || null, // ถ้าไม่มี description ให้เก็บเป็น null
                user_id: parseInt(user_id), // แปลง user_id จาก String เป็น Integer
                image_url: imageUrl,
                // created_at และ updated_at มักถูกจัดการโดย Prisma (@createdAt, @updatedAt)
            },
             select: { // เลือก Field ที่จะส่งกลับไปให้ Frontend
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
             // ลบไฟล์ที่อัปโหลดขึ้น Cloudinary ถ้าการบันทึกลง DB ล้มเหลว
              const newUrlParts = req.file.path.split('/');
              const newUploadFolderIndex = newUrlParts.indexOf('amazing-thailand-2025'); // ตรวจสอบชื่อ Folder ที่ใช้
              if (newUploadFolderIndex > -1) {
                  const newFolderAndPublicIdParts = newUrlParts.slice(newUploadFolderIndex);
                  const newPublicIdWithExt = newFolderAndPublicIdParts.pop();
                  const newFolder = newFolderAndPublicIdParts.join('/');
                  const newPublicId = newPublicIdWithExt.split('.')[0];
                  const newFullPublicId = `${newFolder}/${newPublicId}`;

                  if (newFullPublicId) {
                      cloudinary.uploader.destroy(newFullPublicId)
                          .catch(err => console.error("Failed to delete new uploaded file on error:", err));
                  } else {
                       console.warn("Could not extract public_id from new Cloudinary URL for deletion:", req.file.path);
                  }
              }
         }
        res.status(500).json({ message: "Failed to create photo", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};


// --- Function editPhoto (คงเดิม) ---
exports.editPhoto = async (req, res) => {
    try {
        const photoId = parseInt(req.params.photoId);
        const { location_name, description } = req.body; // รับข้อมูลที่ต้องการแก้ไขจาก Body

        // สร้าง Object สำหรับข้อมูลที่ต้องการ Update
        const updateData = {};
        if (location_name !== undefined) updateData.location_name = location_name; // ถ้า location_name ถูกส่งมา ให้อัปเดต
        if (description !== undefined) updateData.description = description; // ถ้า description ถูกส่งมา ให้อัปเดต

        // ถ้ามีการอัปโหลดไฟล์รูปใหม่
        if (req.file) {
            // ดึงข้อมูลรูปเก่าเพื่อลบจาก Cloudinary
            const photo = await prisma.photos.findUnique({
                 where: { photo_id: photoId },
                 select: { image_url: true } // เลือกมาเฉพาะ image_url
            });

             if (photo && photo.image_url) {
                 // Extract Public ID จาก URL Cloudinary เพื่อลบไฟล์เก่า
                 const urlParts = photo.image_url.split('/');
                 const uploadFolderIndex = urlParts.indexOf('amazing-thailand-2025'); // ชื่อ Folder หลักใน Cloudinary
                 if (uploadFolderIndex > -1) {
                      const folderAndPublicIdParts = urlParts.slice(uploadFolderIndex);
                      const publicIdWithExt = folderAndPublicIdParts.pop(); // เช่น "photo_1678888888888.jpg"
                      const folder = folderAndPublicIdParts.join('/'); // เช่น "amazing-thailand-2025/photos"
                      const publicId = publicIdWithExt.split('.')[0]; // เช่น "photo_1678888888888"
                      const fullPublicId = `${folder}/${publicId}`; // เช่น "amazing-thailand-2025/photos/photo_1678888888888"

                      if (fullPublicId) {
                          try {
                              await cloudinary.uploader.destroy(fullPublicId); // ลบไฟล์เก่า
                              console.log("Old photo image deleted successfully from Cloudinary:", fullPublicId);
                          } catch (err) {
                              console.error("Error deleting old photo image from Cloudinary:", err);
                          }
                      } else {
                          console.warn("Could not extract public_id from old Cloudinary URL for deletion:", photo.image_url);
                      }
                 } else {
                      console.warn("Old Cloudinary URL does not contain the expected folder path:", photo.image_url);
                 }
             }
             // เพิ่ม URL รูปใหม่ลงในข้อมูลที่จะ Update
             updateData.image_url = req.file.path;
        }

        // อัปเดตข้อมูลในฐานข้อมูลโดยใช้ photoId
        const updatedPhoto = await prisma.photos.update({
            where: { photo_id: photoId },
            data: updateData, // ใช้ Object updateData ที่เตรียมไว้
             select: { // เลือก Field ที่จะส่งกลับไปให้ Frontend
                 photo_id: true,
                 location_name: true,
                 image_url: true,
                 updated_at: true, // ส่ง updated_at กลับไปด้วยถ้าต้องการ
                 user_id: true,
             },
        });

        res.status(200).json({ message: "Photo updated successfully", data: updatedPhoto });

    } catch (error) {
        console.error("Error updating photo:", error);
         // ถ้ามี Error และมีการอัปโหลดไฟล์ใหม่ ให้ลบไฟล์ใหม่นั้นออกจาก Cloudinary
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
         // จัดการ Error จาก Prisma (เช่น ไม่พบ Photo ID)
         if (error.code === 'P2025') {
              return res.status(404).json({
                   message: `Photo with ID ${photoId} not found.`,
                   error: process.env.NODE_ENV === 'development' ? error.message : 'Record not found.',
               });
          }
        res.status(500).json({ message: "Failed to update photo", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};


// --- Function deletePhoto (คงเดิม) ---
exports.deletePhoto = async (req, res) => {
    try {
        const photoId = parseInt(req.params.photoId); // ดึง photoId จาก Path Parameter

        // ดึงข้อมูลรูปภาพก่อนลบ เพื่อเอา image_url ไปลบไฟล์ใน Cloudinary
        const photo = await prisma.photos.findUnique({
            where: { photo_id: photoId },
            select: { image_url: true }, // เลือกมาเฉพาะ image_url
        });

        // ถ้าไม่พบรูปภาพ
        if (!photo) {
            return res.status(404).json({ message: "Photo not found" });
        }

        // ถ้ามี image_url ให้ลบไฟล์ใน Cloudinary
        if (photo.image_url) {
            // Extract Public ID จาก URL Cloudinary เพื่อลบไฟล์
            const urlParts = photo.image_url.split('/');
            const uploadFolderIndex = urlParts.indexOf('amazing-thailand-2025'); // ชื่อ Folder หลักใน Cloudinary
             if (uploadFolderIndex > -1) {
                  const folderAndPublicIdParts = urlParts.slice(uploadFolderIndex);
                  const publicIdWithExt = folderAndPublicIdParts.pop(); // เช่น "photo_1678888888888.jpg"
                  const folder = folderAndPublicIdParts.join('/'); // เช่น "amazing-thailand-2025/photos"
                  const publicId = publicIdWithExt.split('.')[0]; // เช่น "photo_1678888888888"
                  const fullPublicId = `${folder}/${publicId}`; // เช่น "amazing-thailand-2025/photos/photo_1678888888888"

                  if (fullPublicId) {
                      try {
                          await cloudinary.uploader.destroy(fullPublicId); // ลบไฟล์จาก Cloudinary
                          console.log("Photo image deleted successfully from Cloudinary:", fullPublicId);
                      } catch (err) {
                          console.error("Error deleting photo image from Cloudinary:", err);
                      }
                  } else {
                       console.warn("Could not extract public_id from Cloudinary URL for deletion:", photo.image_url);
                  }
             } else {
                  console.warn("Cloudinary URL does not contain the expected folder path for deletion:", photo.image_url);
             }
        }

        // ลบข้อมูลรูปภาพออกจากฐานข้อมูลโดยใช้ photoId
        const deletedPhoto = await prisma.photos.delete({
            where: { photo_id: photoId },
             select: { // เลือก Field ที่จะส่งกลับไปให้ Frontend (Optional)
                 photo_id: true,
                 location_name: true,
                 image_url: true,
             },
        });

        res.status(200).json({ message: "Photo deleted successfully", data: deletedPhoto });

    } catch (error) {
        console.error("Error deleting photo:", error);
         // จัดการ Error จาก Prisma (เช่น ไม่พบ Photo ID)
          if (error.code === 'P2025') {
               return res.status(404).json({
                    message: `Photo with ID ${photoId} not found.`,
                    error: process.env.NODE_ENV === 'development' ? error.message : 'Record not found.',
                });
           }
        res.status(500).json({ message: "Failed to delete photo", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};