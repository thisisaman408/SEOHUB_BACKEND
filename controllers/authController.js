const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const generateToken = require('../utils/generateToken');

// @desc    Register a new user
// @route   POST /api/auth/signup
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
	const { companyName, email, password } = req.body;

	const userExists = await User.findOne({ email });

	if (userExists) {
		res.status(400);
		throw new Error('User already exists');
	}

	const user = await User.create({
		companyName,
		email,
		password,
	});

	if (user) {
		res.status(201).json({
			_id: user._id,
			companyName: user.companyName,
			email: user.email,
			role: user.role,
			companyLogoUrl: user.companyLogoUrl,
			token: generateToken(user._id),
		});
	} else {
		res.status(400);
		throw new Error('Invalid user data');
	}
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
	const { email, password } = req.body;
	const user = await User.findOne({ email });

	if (user && (await user.matchPassword(password))) {
		res.json({
			_id: user._id,
			companyName: user.companyName,
			email: user.email,
			role: user.role,
			companyLogoUrl: user.companyLogoUrl,
			token: generateToken(user._id),
		});
	} else {
		res.status(401);
		throw new Error('Invalid email or password');
	}
});

// @desc    Admin login
// @route   POST /api/auth/admin/login
// @access  Public
const adminLogin = asyncHandler(async (req, res) => {
	const { email, password } = req.body;

	const user = await User.findOne({ email, role: 'admin' });

	if (user && (await user.matchPassword(password))) {
		res.json({
			_id: user._id,
			email: user.email,
			role: user.role,
			companyLogoUrl: user.companyLogoUrl,
			token: generateToken(user._id),
		});
	} else {
		res.status(401);
		throw new Error('Not authorized as an admin');
	}
});

module.exports = { registerUser, loginUser, adminLogin };
