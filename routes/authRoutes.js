// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {
	registerUser,
	loginUser,
	adminLogin,
	verifyGoogleToken,
	createGoogleAccount,
} = require('../controllers/authController');

router.post('/signup', registerUser);
router.post('/login', loginUser);
router.post('/admin/login', adminLogin);

router.post('/google/verify', verifyGoogleToken);
router.post('/google/create-account', createGoogleAccount);

module.exports = router;
