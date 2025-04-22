const express = require("express");
const cors = require("cors");
const path = require("path");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/images/users', express.static(path.join(__dirname, 'images/users')));
app.use('/images/photos', express.static(path.join(__dirname, 'images/photos')));

// Import routers
const userRouter = require('./routes/user.route');
const photoRoute = require('./routes/photo.route');
const commentRoute = require('./routes/comment.route');

// Use routers - Mount routers at specific base paths
app.use('/api/users', userRouter);     // กำหนดให้ API เกี่ยวกับผู้ใช้งาน อยู่ภายใต้ /api/users
app.use('/api/photos', photoRoute);   // กำหนดให้ API เกี่ยวกับรูปภาพ อยู่ภายใต้ /api/photos
app.use('/api/comments', commentRoute); // กำหนดให้ API เกี่ยวกับความคิดเห็น อยู่ภายใต้ /api/comments


app.get("/", (req, res) => {
    res.json({ message: "Amazing Thailand 2025 Backend is running!" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}...`);
    console.log(`Access it at http://localhost:${PORT}`);
});