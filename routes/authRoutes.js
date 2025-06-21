const express = require('express');
const {
	registerUser,
	loginUser,
	adminLogin,
} = require('../controllers/authController');
const router = express.Router();

router.post('/signup', registerUser);
router.post('/login', loginUser);
router.post('/admin/login', adminLogin);

module.exports = router;
