// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const {
	getUserProfile,
	updateUserProfile,
} = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadCompanyLogo } = require('../middlewares/uploadMiddleware');

router
	.route('/profile')
	.get(protect, getUserProfile)
	.put(protect, uploadCompanyLogo, updateUserProfile);

module.exports = router;
