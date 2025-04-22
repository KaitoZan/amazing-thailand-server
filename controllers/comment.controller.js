const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Comment logic generally doesn't involve file uploads, so Multer setup is not needed here.

exports.getCommentsForPhoto = async (req, res) => {
    try {
        const photoId = parseInt(req.params.photoId);

        const comments = await prisma.comments.findMany({
            where: { photo_id: photoId },
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
        });

        res.status(200).json({ message: "Comments fetched successfully", data: comments });

    } catch (error) {
        console.error("Error fetching comments for photo:", error);
        res.status(500).json({ message: "Failed to fetch comments", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};

exports.createComment = async (req, res) => {
    try {
        const { photo_id, user_id, comment_text } = req.body;

        if (!photo_id || !user_id || !comment_text) {
            return res.status(400).json({ message: "Photo ID, user ID, and comment text are required." });
        }

        const newComment = await prisma.comments.create({
            data: {
                photo_id: parseInt(photo_id),
                user_id: parseInt(user_id),
                comment_text: comment_text,
            },
             select: {
                 comment_id: true,
                 photo_id: true,
                 user_id: true,
                 comment_text: true,
                 created_at: true,
             },
        });

        res.status(201).json({ message: "Comment created successfully", data: newComment });

    } catch (error) {
        console.error("Error creating comment:", error);
        res.status(500).json({ message: "Failed to create comment", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};

exports.editComment = async (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);
        const { comment_text } = req.body;

        if (!comment_text) {
             return res.status(400).json({ message: "Comment text is required for editing." });
        }

        const comment = await prisma.comments.findUnique({
             where: { comment_id: commentId },
        });

        if (!comment) {
             return res.status(404).json({ message: "Comment not found" });
        }

        // Optional: Add authorization check here - ensure only the comment owner or an admin can edit

        const updatedComment = await prisma.comments.update({
            where: { comment_id: commentId },
            data: {
                comment_text: comment_text,
            },
            select: {
                 comment_id: true,
                 photo_id: true,
                 user_id: true,
                 comment_text: true,
                 updated_at: true,
             },
        });

        res.status(200).json({ message: "Comment updated successfully", data: updatedComment });

    } catch (error) {
        console.error("Error updating comment:", error);
         if (error.code === 'P2025') {
              return res.status(404).json({
                  message: `Comment with ID ${commentId} not found.`,
                  error: process.env.NODE_ENV === 'development' ? error.message : 'Record not found.',
              });
         }
        res.status(500).json({ message: "Failed to update comment", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};


exports.deleteComment = async (req, res) => {
    try {
        const commentId = parseInt(req.params.commentId);

        const comment = await prisma.comments.findUnique({
            where: { comment_id: commentId },
        });

        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        // Optional: Add authorization check here - ensure only the comment owner or an admin can delete

        const deletedComment = await prisma.comments.delete({
            where: { comment_id: commentId },
             select: {
                 comment_id: true,
                 photo_id: true,
                 user_id: true,
             }
        });

        res.status(200).json({ message: "Comment deleted successfully", data: deletedComment });

    } catch (error) {
        console.error("Error deleting comment:", error);
         if (error.code === 'P2025') {
              return res.status(404).json({
                  message: `Comment with ID ${commentId} not found.`,
                  error: process.env.NODE_ENV === 'development' ? error.message : 'Record not found.',
              });
         }
        res.status(500).json({ message: "Failed to delete comment", error: process.env.NODE_ENV === 'development' ? error.message : 'An internal server error occurred.' });
    }
};