// controllers/photo.controller.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient(); // สร้าง instance ของ Prisma Client

// นำเข้า Cloudinary และ multer-storage-cloudinary
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

// นำเข้า multer สำหรับจัดการ file uploads
const multer = require("multer");
const path = require("path"); // สำหรับจัดการ path ไฟล์

// ตรวจสอบให้แน่ใจว่ามีการกำหนดค่า Cloudinary ในไฟล์ .env หรือ config ที่สามารถเข้าถึงได้
// process.env.CLOUDINARY_CLOUD_NAME, process.env.CLOUDINARY_API_KEY, process.env.CLOUDINARY_API_SECRET
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// กำหนด Storage Engine สำหรับ Multer โดยใช้ Cloudinary Storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary, // ใช้ Cloudinary instance ที่กำหนดค่าไว้
    params: async (req, file) => {
        console.log("CloudinaryStorage params executing...");
        // สร้างชื่อไฟล์ที่ไม่ซ้ำกันสำหรับ Public ID ใน Cloudinary
        // ตัวอย่าง: "photo_1678888888888"
        const newFile = "photo_" + Math.floor(Math.random() * Date.now());
        console.log("Generated new file name:", newFile);
        const result = {
            folder: "amazing-thailand-2025/photos", // กำหนด Folder ใน Cloudinary ที่จะเก็บรูปภาพ
            allowed_formats: ["jpg", "png", "jpeg", "gif"], // กำหนดประเภทไฟล์ที่อนุญาตให้อัปโหลด
            public_id: newFile, // กำหนด Public ID ให้กับไฟล์ใน Cloudinary
        };
        console.log("CloudinaryStorage params result:", result);
        return result; // คืนค่า parameters ให้ Cloudinary Storage
    },
});

// สร้าง Multer Middleware สำหรับอัปโหลดรูปภาพเดียว
// โดยใช้ Storage Engine ที่กำหนดไว้ และกำหนดข้อจำกัด/File Filter
// .single("photoImage") หมายถึง รับไฟล์เดียวจาก field ใน Form Data ที่ชื่อ "photoImage"
exports.uploadPhoto = multer({
    storage: storage, // ใช้ Cloudinary Storage ที่สร้างไว้
    limits: {
        fileSize: 5 * 1024 * 1024, // จำกัดขนาดไฟล์ไม่เกิน 5 MB (ตัวอย่าง)
    },
    fileFilter: (req, file, cb) => {
        console.log("File Filter executing...");
        console.log("File originalname:", file.originalname);
        console.log("File mimetype:", file.mimetype);

        // โค้ดตรวจสอบประเภทไฟล์ที่อนุญาต (JPEG, JPG, PNG, GIF)
        const fileTypes = /jpeg|jpg|png|gif/;
        const mimeType = fileTypes.test(file.mimetype); // ตรวจสอบ MIME Type
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase()); // ตรวจสอบนามสกุลไฟล์

        if (mimeType && extname) {
             console.log("File Filter passed.");
             return cb(null, true); // ถ้าผ่านเกณฑ์ อนุญาตไฟล์นี้
        }

         console.log("File Filter failed.");
         // ถ้าไม่ผ่านเกณฑ์ ไม่อนุญาตไฟล์ และส่ง Error กลับไป
         cb(new Error("Error: Images Only! (Accepted formats: jpeg, jpg, png, gif)"));
    },
}).single("photoImage"); // ชื่อ Field ใน Form Data ที่ใช้ส่งรูปภาพ


// --- Function getAllPhotos (แก้ไขเพื่อเพิ่ม Search และ Date Filtering - ลบ mode: 'insensitive') ---
// Function นี้จัดการ GET Request ไปยัง /api/photos (ดึงรูปภาพทั้งหมดพร้อมเงื่อนไขกรอง)
exports.getAllPhotos = async (req, res) => {
    try {
        // 1. เข้าถึง Query Parameter ที่ Frontend ส่งมา
        const searchTerm = req.query.search; // คำค้นหาจากช่อง Search
        const startDate = req.query.startDate; // วันที่เริ่มต้นสำหรับกรอง (YYYY-MM-DD)
        const endDate = req.query.endDate;   // วันที่สิ้นสุดสำหรับกรอง (YYYY-MM-DD)

        console.log("Backend received search term:", searchTerm);
        console.log("Backend received start date:", startDate);
        console.log("Backend received end date:", endDate);

        // 2. สร้าง WHERE condition object สำหรับ Prisma
        const whereConditions = {}; // Object สำหรับเก็บเงื่อนไข WHERE ใน Prisma Syntax

        // เพิ่มเงื่อนไข Search Term ถ้ามี (searchTerm ไม่ว่าง)
        if (searchTerm) {
            whereConditions.OR = [ // ใช้ Prisma's `OR` เพื่อรวมเงื่อนไขการค้นหาในหลาย Field
                // ใช้ `contains` สำหรับการค้นหาแบบ Substring (หาคำที่อยู่ในข้อความ)
                // --- ลบ mode: 'insensitive' ออกที่นี่ เพื่อแก้ Error 500 ---
                // Note: การลบ mode: 'insensitive' จะทำให้การค้นหาเป็น Case-Sensitive
                // ถ้าต้องการ Case-Insensitive บน MySQL อาจต้องตั้งค่า Collation หรือใช้ Raw Query ของ Prisma โดยใช้ LOWER()
                { location_name: { contains: searchTerm } }, // ค้นใน location_name
                { description: { contains: searchTerm } },   // ค้นใน description
                // สมมติว่าคุณได้กำหนด Relation ชื่อ 'user' ใน Schema.prisma ของ Photo Model และ User Model มี Field ชื่อ 'username'
                { user: { username: { contains: searchTerm } } } // ค้นใน username ของ User ที่โพสต์
                // --------------------------------------
            ];
        }

        // เพิ่มเงื่อนไข Date Range ถ้ามี (startDate หรือ endDate ไม่ว่าง)
        if (startDate || endDate) {
            whereConditions.created_at = {}; // สร้าง Object ซ้อนสำหรับเงื่อนไขวันที่บน Field created_at
            if (startDate) {
                // ใช้ `gte` (Greater Than or Equal to) สำหรับวันที่เริ่มต้น
                // แปลง String YYYY-MM-DD เป็น Object Date
                whereConditions.created_at.gte = new Date(startDate);
            }
            if (endDate) {
                 // ใช้ `lte` (Less Than or Equal to) สำหรับวันที่สิ้นสุด
                 // เพื่อให้รวมโพสต์ทั้งหมดในวันสิ้นสุดนั้น ควรตั้งเวลาเป็น 23:59:59.999
                 const endOfDay = new Date(endDate);
                 endOfDay.setHours(23, 59, 59, 999); // ตั้งเวลาเป็นสิ้นสุดของวัน
                 whereConditions.created_at.lte = endOfDay;
            }
        }

        console.log("Prisma WHERE conditions:", whereConditions); // Log Object เงื่อนไข WHERE ที่สร้างขึ้น

        // 3. เรียกใช้ Prisma's findMany พร้อมเงื่อนไข WHERE ที่สร้างขึ้น
        const photos = await prisma.photos.findMany({
            where: whereConditions, // ส่ง Object เงื่อนไข WHERE เข้าไปตรงนี้
            include: {
                user: { // Include user data ตามเดิม เพื่อให้เข้าถึง username ได้
                    select: {
                        user_id: true,
                        username: true,
                        profile_picture_url: true, // ดึง profile_picture_url ของ user มาด้วยถ้าต้องการแสดง
                    }
                }
            },
            orderBy: {
                 created_at: 'desc' // เรียงลำดับตามวันที่สร้างล่าสุดจากมากไปน้อย
            }
        });

        console.log(`Found ${photos.length} photos after filtering.`); // Log จำนวนรูปที่พบหลังจากกรอง

        // 4. ส่งผลลัพธ์ (รูปภาพที่ถูกกรองแล้ว) กลับไปให้ Frontend ด้วย Status 200 OK
        res.status(200).json({ message: "Photos fetched successfully", data: photos });

    } catch (error) {
        console.error("Error fetching photos with filters:", error); // Log Error ที่เกิดขึ้น
        // ส่ง Error Message ที่ละเอียดขึ้นในโหมด Development, หรือ Generic Message ในโหมด Production
        res.status(500).json({ message: "Failed to fetch photos", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};
// --- สิ้นสุด Function getAllPhotos ---


// --- Function getPhotoDetails (ดึงรายละเอียดรูปภาพเดียว) ---
// Function นี้จัดการ GET Request ไปยัง /api/photos/:photoId
exports.getPhotoDetails = async (req, res) => {
    try {
        const photoId = parseInt(req.params.photoId); // ดึง photoId จาก URL Parameter

        const photo = await prisma.photos.findUnique({
            where: { photo_id: photoId }, // ค้นหารูปภาพด้วย photo_id
             include: {
                 user: { // Include ข้อมูล User ที่โพสต์
                     select: {
                         user_id: true,
                         username: true,
                         profile_picture_url: true,
                     }
                 },
                 comments: { // Include ข้อมูล Comment ทั้งหมดของรูปภาพนี้
                     include: {
                         user: { // Include ข้อมูล User ที่ Comment
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

        // ถ้าไม่พบรูปภาพ ให้ส่ง Status 404 Not Found
        if (!photo) {
            return res.status(404).json({ message: "Photo not found" });
        }

        // ถ้าพบรูปภาพ ให้ส่งข้อมูลกลับไปพร้อม Status 200 OK
        res.status(200).json({ message: "Photo fetched successfully", data: photo });

    } catch (error) {
        console.error("Error fetching photo details:", error); // Log Error
        res.status(500).json({ message: "Failed to fetch photo details", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};


// --- Function createPhoto (สร้างรูปภาพใหม่) ---
// Function นี้จัดการ POST Request ไปยัง /api/photos
exports.createPhoto = async (req, res) => {
    try {
        console.log("Request Body:", req.body); // Log Request Body ที่ได้รับ
        console.log("Request File:", req.file); // Log File ที่อัปโหลด

        // ดึงข้อมูลจาก Request Body
        const { location_name, description, user_id } = req.body;

        // ตรวจสอบ Validation เบื้องต้น: field ที่จำเป็นต้องมี
        if (!location_name || !user_id || !req.file) {
             if (req.file) {
                 // ถ้ามีไฟล์อัปโหลดขึ้น Cloudinary แล้วแต่ validation ไม่ผ่าน ให้ลบไฟล์นั้นออก
                 cloudinary.uploader.destroy(req.file.filename).catch(err => console.error("Failed to delete uploaded file on validation error:", err));
             }
            // ส่ง Error 400 Bad Request ถ้าข้อมูลไม่ครบ
            return res.status(400).json({ message: "Location name, user ID, and photo image are required." });
        }

        const imageUrl = req.file.path; // URL ของรูปภาพที่ได้จาก Cloudinary Storage (Multer middleware จะเพิ่มให้ใน req.file)

        // สร้าง Record รูปภาพใหม่ในฐานข้อมูลด้วย Prisma
        const newPhoto = await prisma.photos.create({
            data: {
                location_name: location_name,
                description: description || null, // ถ้าไม่มี description ให้เก็บเป็น null
                user_id: parseInt(user_id), // แปลง user_id จาก String เป็น Integer
                image_url: imageUrl,
                // created_at และ updated_at มักถูกจัดการโดย Prisma โดยอัตโนมัติถ้าตั้งค่าใน schema.prisma (@createdAt, @updatedAt)
            },
             select: { // เลือก Field ที่จะส่งกลับไปให้ Frontend ใน Response
                 photo_id: true,
                 location_name: true,
                 image_url: true,
                 created_at: true,
                 user_id: true,
             },
        });

        // ส่ง Response กลับพร้อม Status 201 Created
        res.status(201).json({ message: "Photo created successfully", data: newPhoto });

    } catch (error) {
        console.error("Error creating photo:", error); // Log Error ที่เกิดขึ้น
         // ถ้ามี Error และมีการอัปโหลดไฟล์ใหม่ ให้ลบไฟล์ใหม่นั้นออกจาก Cloudinary
          if (req.file) {
                const newUrlParts = req.file.path.split('/');
                const newUploadFolderIndex = newUrlParts.indexOf('amazing-thailand-2025'); // ตรวจสอบชื่อ Folder หลักใน Cloudinary ที่ใช้
                 if (newUploadFolderIndex > -1) {
                      const newFolderAndPublicIdParts = newUrlParts.slice(newUploadFolderIndex);
                      const newPublicIdWithExt = newFolderAndPublicIdParts.pop(); // เช่น "photo_1678888888888.jpg"
                      const newFolder = newFolderAndPublicIdParts.join('/'); // เช่น "amazing-thailand-2025/photos"
                      const newPublicId = newPublicIdWithExt.split('.')[0]; // เช่น "photo_1678888888888"
                      const newFullPublicId = `${newFolder}/${newPublicId}`; // เช่น "amazing-thailand-2025/photos/photo_1678888888888"

                      if (newFullPublicId) {
                          // ลบไฟล์จาก Cloudinary
                          cloudinary.uploader.destroy(newFullPublicId)
                              .catch(err => console.error("Failed to delete new uploaded file on error:", err));
                      } else {
                           console.warn("Could not extract public_id from new Cloudinary URL for deletion:", req.file.path);
                      }
                 } else {
                      console.warn("New Cloudinary URL does not contain the expected folder path for deletion:", req.file.path);
                 }
          }
        res.status(500).json({ message: "Failed to create photo", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};


// --- Function editPhoto (แก้ไขรูปภาพ) ---
// Function นี้จัดการ PUT Request ไปยัง /api/photos/:photoId
exports.editPhoto = async (req, res) => {
    try {
        const photoId = parseInt(req.params.photoId); // ดึง photoId จาก URL Parameter
        const { location_name, description } = req.body; // รับข้อมูลที่ต้องการแก้ไขจาก Request Body

        // สร้าง Object สำหรับข้อมูลที่ต้องการ Update ในฐานข้อมูล
        const updateData = {};
        if (location_name !== undefined) updateData.location_name = location_name; // ถ้า location_name ถูกส่งมาใน Body ให้อัปเดต
        if (description !== undefined) updateData.description = description; // ถ้า description ถูกส่งมาใน Body ให้อัปเดต

        // ถ้ามีการอัปโหลดไฟล์รูปใหม่ (req.file มีค่า)
        if (req.file) {
            // 1. ดึงข้อมูลรูปเก่าจากฐานข้อมูลเพื่อเอา image_url ไปลบไฟล์ใน Cloudinary
            const photo = await prisma.photos.findUnique({
                 where: { photo_id: photoId }, // ค้นหารูปภาพด้วย photoId
                 select: { image_url: true } // เลือกมาเฉพาะ image_url
            });

             // 2. ถ้าพบรูปเก่าและมี image_url ให้ลบไฟล์เก่าใน Cloudinary
             if (photo && photo.image_url) {
                 // Extract Public ID จาก URL Cloudinary เพื่อลบไฟล์เก่า
                 const urlParts = photo.image_url.split('/');
                 const uploadFolderIndex = urlParts.indexOf('amazing-thailand-2025'); // ตรวจสอบชื่อ Folder หลักใน Cloudinary ที่ใช้
                 if (uploadFolderIndex > -1) {
                      const folderAndPublicIdParts = urlParts.slice(uploadFolderIndex);
                      const publicIdWithExt = folderAndPublicIdParts.pop(); // เช่น "photo_1678888888888.jpg"
                      const folder = folderAndPublicIdParts.join('/'); // เช่น "amazing-thailand-2025/photos"
                      const publicId = publicIdWithExt.split('.')[0]; // เช่น "photo_1678888888888"
                      const fullPublicId = `${folder}/${publicId}`; // เช่น "amazing-thailand-2025/photos/photo_1678888888888"

                      if (fullPublicId) {
                          try {
                              await cloudinary.uploader.destroy(fullPublicId); // ลบไฟล์เก่าจาก Cloudinary
                              console.log("Old photo image deleted successfully from Cloudinary:", fullPublicId);
                          } catch (err) {
                              console.error("Error deleting old photo image from Cloudinary:", err);
                          }
                      } else {
                           console.warn("Could not extract public_id from old Cloudinary URL for deletion:", photo.image_url);
                      }
                 } else {
                      console.warn("Old Cloudinary URL does not contain the expected folder path for deletion:", photo.image_url);
                 }
             }
             // 3. เพิ่ม URL รูปใหม่ที่อัปโหลดสำเร็จลงในข้อมูลที่จะ Update
             updateData.image_url = req.file.path;
        }

        // 4. อัปเดตข้อมูลรูปภาพในฐานข้อมูลโดยใช้ photoId และข้อมูลใน updateData
        const updatedPhoto = await prisma.photos.update({
            where: { photo_id: photoId }, // เงื่อนไข: อัปเดต Record ที่มี photo_id ตรงกัน
            data: updateData, // ข้อมูลที่ต้องการอัปเดต
             select: { // เลือก Field ที่จะส่งกลับไปให้ Frontend ใน Response
                 photo_id: true,
                 location_name: true,
                 image_url: true,
                 updated_at: true, // ส่ง updated_at กลับไปด้วยถ้าต้องการ
                 user_id: true,
             },
        });

        // 5. ส่ง Response กลับพร้อม Status 200 OK
        res.status(200).json({ message: "Photo updated successfully", data: updatedPhoto });

    } catch (error) {
        console.error("Error updating photo:", error); // Log Error ที่เกิดขึ้น
         // ถ้ามี Error และมีการอัปโหลดไฟล์ใหม่ ให้ลบไฟล์ใหม่นั้นออกจาก Cloudinary เพื่อป้องกันไฟล์ค้าง
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
                      } else {
                          console.warn("Could not extract public_id from new Cloudinary URL for deletion:", req.file.path);
                      }
                 } else {
                      console.warn("New Cloudinary URL does not contain the expected folder path for deletion:", req.file.path);
                 }
          }
         // จัดการ Error จาก Prisma (เช่น P2025: ไม่พบ Record)
         if (error.code === 'P2025') {
              return res.status(404).json({
                   message: `Photo with ID ${photoId} not found.`,
                   error: process.env.NODE_ENV === 'development' ? error.message : 'Record not found.',
               });
          }
        res.status(500).json({ message: "Failed to update photo", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};


// --- Function deletePhoto (ลบรูปภาพ) ---
// Function นี้จัดการ DELETE Request ไปยัง /api/photos/:photoId
exports.deletePhoto = async (req, res) => {
    try {
        const photoId = parseInt(req.params.photoId); // ดึง photoId จาก URL Parameter

        // 1. ดึงข้อมูลรูปภาพก่อนลบ เพื่อเอา image_url ไปลบไฟล์ใน Cloudinary
        const photo = await prisma.photos.findUnique({
            where: { photo_id: photoId }, // ค้นหารูปภาพด้วย photoId
            select: { image_url: true }, // เลือกมาเฉพาะ image_url
        });

        // ถ้าไม่พบรูปภาพ ให้ส่ง Status 404 Not Found
        if (!photo) {
            return res.status(404).json({ message: "Photo not found" });
        }

        // 2. ถ้ามี image_url ในข้อมูลที่ดึงมา ให้ลบไฟล์ใน Cloudinary
        if (photo.image_url) {
            // Extract Public ID จาก URL Cloudinary เพื่อลบไฟล์
            const urlParts = photo.image_url.split('/');
            const uploadFolderIndex = urlParts.indexOf('amazing-thailand-2025'); // ตรวจสอบชื่อ Folder หลักใน Cloudinary ที่ใช้
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

        // 3. ลบข้อมูลรูปภาพออกจากฐานข้อมูลโดยใช้ photoId
        const deletedPhoto = await prisma.photos.delete({
            where: { photo_id: photoId }, // เงื่อนไข: ลบ Record ที่มี photo_id ตรงกัน
             select: { // เลือก Field ที่จะส่งกลับไปให้ Frontend ใน Response (Optional)
                 photo_id: true,
                 location_name: true,
                 image_url: true,
             },
        });

        // 4. ส่ง Response กลับพร้อม Status 200 OK
        res.status(200).json({ message: "Photo deleted successfully", data: deletedPhoto });

    } catch (error) {
        console.error("Error deleting photo:", error); // Log Error ที่เกิดขึ้น
         // จัดการ Error จาก Prisma (เช่น P2025: ไม่พบ Record ที่จะลบ)
          if (error.code === 'P2025') {
               return res.status(404).json({
                    message: `Photo with ID ${photoId} not found.`,
                    error: process.env.NODE_ENV === 'development' ? error.message : 'Record not found.',
                });
           }
        res.status(500).json({ message: "Failed to delete photo", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};
