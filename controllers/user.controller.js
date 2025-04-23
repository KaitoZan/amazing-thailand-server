// controllers/user.controller.js

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const bcrypt = require("bcryptjs");

const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const multer = require("multer");
const path = require("path");

// ตรวจสอบว่าคุณได้ตั้งค่า environment variables CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET แล้ว
// require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // ถ้าใช้ dotenv

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        // สร้าง public_id ที่ไม่ซ้ำกัน
        const newFile = "user_" + Math.floor(Math.random() * Date.now());
        return {
            folder: "amazing-thailand-2025/users", // โฟลเดอร์ใน Cloudinary
            allowed_formats: ["jpg", "png", "jpeg", "gif"],
            public_id: newFile,
        };
    },
});

exports.uploadUser = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024, // จำกัดขนาดไฟล์ไม่เกิน 1 MB
    },
    fileFilter: (req, file, cb) => {
        // ตรวจสอบชนิดไฟล์
        const fileTypes = /jpeg|jpg|png|gif/;
        const mimeType = fileTypes.test(file.mimetype);
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());

        if (mimeType && extname) {
            return cb(null, true);
        }
        cb(new Error("Error: Images Only! (Accepted formats: jpeg, jpg, png, gif)"));
    },
}).single("profilePicture"); // ชื่อ field สำหรับไฟล์รูป Profile ต้องตรงกับที่ Frontend ส่งมา

// ฟังก์ชันสำหรับสร้างผู้ใช้ใหม่ (สมัครสมาชิก)
exports.createUser = async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // req.file จะมีข้อมูลไฟล์ที่อัปโหลด ถ้า multer ทำงานถูกต้อง

        // ตรวจสอบว่าข้อมูลจำเป็นครบถ้วนหรือไม่
        if (!username || !email || !password) {
            // ถ้าข้อมูลไม่ครบ และมีการอัปโหลดไฟล์ ให้ลบไฟล์ที่อัปโหลดไปแล้วออกจาก Cloudinary
             if (req.file) {
                 cloudinary.uploader.destroy(req.file.filename).catch(err => console.error("Failed to delete uploaded file on validation error:", err));
             }
            return res.status(400).json({ message: "Please provide username, email, and password." });
        }

        // Hash Password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // กำหนด URL รูป Profile (ใช้ URL จาก Cloudinary ที่ multer สร้างไว้ หรือเป็น null ถ้าไม่มีไฟล์)
        const profilePictureUrl = req.file ? req.file.path : null;

        // สร้างผู้ใช้ใหม่ใน Database ด้วย Prisma
        const newUser = await prisma.users.create({
            data: {
                username: username,
                email: email,
                password_hash: passwordHash,
                profile_picture_url: profilePictureUrl,
            },
            // เลือก field ที่ต้องการคืนกลับไป Frontend
            select: {
                user_id: true,
                username: true,
                email: true,
                profile_picture_url: true,
                created_at: true,
            },
        });

        // ส่ง Response กลับไปว่าสมัครสำเร็จ
        res.status(201).json({ // ใช้ 201 Created สำหรับการสร้างทรัพยากรใหม่
            message: "User registered successfully",
            data: newUser,
        });

    } catch (error) {
        console.error("Error creating user:", error);

        // จัดการ Error กรณี Email หรือ Username ซ้ำ (Prisma Error Code P2002)
        if (error.code === 'P2002') {
            // ถ้า Error เพราะซ้ำ และมีการอัปโหลดไฟล์ ให้ลบไฟล์ออกจาก Cloudinary
             if (req.file) {
                 cloudinary.uploader.destroy(req.file.filename).catch(err => console.error("Failed to delete uploaded file on DB error:", err));
             }
            const target = error.meta.target.join(', ');
            return res.status(409).json({ // ใช้ 409 Conflict
                message: `User with this ${target} already exists.`,
                error: process.env.NODE_ENV === 'development' ? error.message : 'Duplicate entry error.',
            });
        }

        // ถ้า Error อื่นๆ และมีการอัปโหลดไฟล์ ให้ลบไฟล์ออกจาก Cloudinary
         if (req.file) {
             cloudinary.uploader.destroy(req.file.filename).catch(err => console.error("Failed to delete uploaded file on generic error:", err));
         }
        // ส่ง Response Error ทั่วไป
        res.status(500).json({ // ใช้ 500 Internal Server Error
            message: "Failed to register user",
            error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.',
        });
    }
};

// ฟังก์ชันสำหรับตรวจสอบการ Login
exports.checkLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Please provide email and password." });
        }

        // ค้นหาผู้ใช้ด้วย Email
        const user = await prisma.users.findUnique({
            where: {
                email: email,
            },
            // เลือก field ที่ต้องการ รวมถึง password_hash เพื่อใช้เปรียบเทียบ
             select: {
                user_id: true,
                username: true,
                email: true,
                profile_picture_url: true,
                password_hash: true,
            },
        });

        // เปรียบเทียบ Password
        if (user && await bcrypt.compare(password, user.password_hash)) {
             // ถ้า Login สำเร็จ ลบ password_hash ออกจากข้อมูลที่จะส่งกลับ
             const { password_hash, ...userData } = user;
            res.status(200).json({ // ใช้ 200 OK
                message: "User login successfully",
                data: userData, // ส่งข้อมูลผู้ใช้ (ไม่มี password_hash) กลับไป
            });
        } else {
            // ถ้า Email หรือ Password ไม่ถูกต้อง
            res.status(401).json({ // ใช้ 401 Unauthorized
                message: "Invalid email or password",
            });
        }

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ // ใช้ 500 Internal Server Error
            message: "An internal server error occurred during login",
            error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.',
        });
    }
};


// *** ฟังก์ชันใหม่สำหรับดึงข้อมูลผู้ใช้ตาม ID (GET /api/users/:userId) ***
exports.getUserById = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId); // ดึง userId จาก Path Parameter ใน URL

        // ตรวจสอบว่า userId เป็นตัวเลขที่ถูกต้องหรือไม่
        if (isNaN(userId)) {
            return res.status(400).json({ message: "Invalid user ID format" });
        }

        // ดึงข้อมูลผู้ใช้จาก Database ด้วย Prisma โดยใช้ user_id
        const user = await prisma.users.findUnique({
            where: {
                user_id: userId, // ค้นหาจาก field user_id ใน Database
            },
             select: { // เลือก field ที่ต้องการส่งกลับไป Frontend
                 user_id: true,
                 username: true,
                 email: true,
                 profile_picture_url: true,
                 created_at: true,
                 updated_at: true,
                 // ไม่ต้องเลือก password_hash หรือ field ที่ละเอียดอ่อนอื่นๆ
             },
        });

        // ถ้าไม่พบผู้ใช้ด้วย ID นี้
        if (!user) {
            console.log(`User with ID ${userId} not found.`);
            return res.status(404).json({ message: `User with ID ${userId} not found` }); // ใช้ 404 Not Found
        }

        // ถ้าพบผู้ใช้ ส่งข้อมูล Profile กลับไป
        console.log(`User with ID ${userId} found. Sending data.`);
        res.status(200).json({ // ใช้ 200 OK
            message: "User data fetched successfully",
            data: user, // ส่งข้อมูลผู้ใช้กลับไปใน field 'data'
        });

    } catch (error) {
        console.error("Error fetching user data by ID:", error); // Log Error
        res.status(500).json({ // ใช้ 500 Internal Server Error สำหรับ Server Error
            message: "An internal server error occurred while fetching user data",
            error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.',
        });
    }
};
// -------------------------------------------------------------------


// ฟังก์ชันสำหรับแก้ไขข้อมูลผู้ใช้ (PUT /api/users/:userId)
exports.editUser = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        // ข้อมูลที่ส่งมาใน Body อาจจะมี username, email, password หรือไม่มีก็ได้
        const { username, email, password } = req.body;
        // req.file จะมีข้อมูลไฟล์รูป Profile ใหม่ ถ้ามีการอัปโหลด

        // สร้าง Object สำหรับเก็บข้อมูลที่จะอัปเดต
         const updateData = {};
         // ตรวจสอบว่ามีการส่ง field ไหนมาบ้าง แล้วค่อยเพิ่มลงใน updateData
         if (username !== undefined) updateData.username = username;
         if (email !== undefined) updateData.email = email;

        // ถ้ามีการส่ง password ใหม่มา ให้ Hash ก่อนบันทึก
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password_hash = await bcrypt.hash(password, salt);
        }

        // ถ้ามีการอัปโหลดรูป Profile ใหม่
        if (req.file) {
            // ค้นหาผู้ใช้เพื่อดูว่ามีรูปเก่าอยู่หรือไม่
            const user = await prisma.users.findUnique({
                 where: { user_id: userId },
                 select: { profile_picture_url: true }
            });

            // ถ้ามีรูปเก่า ให้ลบรูปเก่าออกจาก Cloudinary
             if (user && user.profile_picture_url) {
                 // ดึง public_id จาก URL ของรูปเก่า
                 const urlParts = user.profile_picture_url.split('/');
                 const uploadFolderIndex = urlParts.indexOf('amazing-thailand-2025'); // หรือชื่อโฟลเดอร์หลักของคุณ
                 if (uploadFolderIndex > -1) {
                     const folderAndPublicIdParts = urlParts.slice(uploadFolderIndex);
                     const publicIdWithExt = folderAndPublicIdParts.pop();
                     const folder = folderAndPublicIdParts.join('/');
                     const publicId = publicIdWithExt.split('.')[0];
                     const fullPublicId = `<span class="math-inline">\{folder\}/</span>{publicId}`;

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

            // กำหนด URL ของรูป Profile ใหม่ ที่ได้จากการอัปโหลดโดย multer/Cloudinary
             updateData.profile_picture_url = req.file.path;
        }

        // อัปเดตข้อมูลผู้ใช้ใน Database ด้วย Prisma
        const updatedUser = await prisma.users.update({
            where: { user_id: userId }, // อัปเดตผู้ใช้คนที่มี ID ตรงกัน
            data: updateData, // ใช้ข้อมูลที่เตรียมไว้ใน updateData
            // เลือก field ที่ต้องการคืนกลับไป Frontend
             select: {
                 user_id: true,
                 username: true,
                 email: true,
                 profile_picture_url: true,
                 updated_at: true,
             },
        });

        res.status(200).json({ // ใช้ 200 OK
            message: "User updated successfully",
            data: updatedUser, // ส่งข้อมูลผู้ใช้ที่อัปเดตแล้วกลับไป
        });

    } catch (error) {
        console.error("Error updating user:", error);

        // ถ้า Error ในการอัปเดต และมีการอัปโหลดไฟล์ใหม่ ให้ลบไฟล์ใหม่นั้นออกจาก Cloudinary
         if (req.file) {
               const newUrlParts = req.file.path.split('/');
               const newUploadFolderIndex = newUrlParts.indexOf('amazing-thailand-2025');
                 if (newUploadFolderIndex > -1) {
                     const newFolderAndPublicIdParts = newUrlParts.slice(newUploadFolderIndex);
                     const newPublicIdWithExt = newFolderAndPublicIdParts.pop();
                     const newFolder = newFolderAndPublicIdParts.join('/');
                     const newPublicId = newPublicIdWithExt.split('.')[0];
                     const newFullPublicId = `<span class="math-inline">\{newFolder\}/</span>{newPublicId}`;

                     if (newFullPublicId) {
                         cloudinary.uploader.destroy(newFullPublicId)
                             .catch(err => console.error("Failed to delete new uploaded file on error:", err));
                     }
                 }
         }

        // จัดการ Error กรณี Email หรือ Username ซ้ำ
        if (error.code === 'P2002') {
             const target = error.meta.target.join(', ');
             return res.status(409).json({ // ใช้ 409 Conflict
                 message: `Update failed: User with this ${target} already exists.`,
                 error: process.env.NODE_ENV === 'development' ? error.message : 'Duplicate entry error.',
             });
         } else if (error.code === 'P2025') { // Error กรณีไม่พบ Record ที่ต้องการอัปเดต
              return res.status(404).json({ // ใช้ 404 Not Found
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
