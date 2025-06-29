const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const generateToken = require('../utils/generateToken');
const admin = require('firebase-admin');
const crypto = require('crypto');

const serviceAccount = require('../seo-app-b6991-firebase-adminsdk-fbsvc-05d3fe1305.json');
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
});

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
			companyName: user.companyName || '',
			email: user.email,
			role: user.role,
			companyLogoUrl: user.companyLogoUrl,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
			token: generateToken(user._id),
		});
	} else {
		res.status(401);
		throw new Error('Not authorized as an admin');
	}
});

// @desc Verify Google OAuth token
// @route POST /api/auth/google/verify
// @access Public
const verifyGoogleToken = asyncHandler(async (req, res) => {
	const { idToken, email, name, profilePicture } = req.body;

	try {
		const decodedToken = await admin.auth().verifyIdToken(idToken);

		if (decodedToken.email !== email) {
			res.status(400);
			throw new Error('Token verification failed');
		}

		const existingUser = await User.findOne({ email });

		if (existingUser) {
			res.json({
				user: {
					_id: existingUser._id,
					companyName: existingUser.companyName,
					email: existingUser.email,
					role: existingUser.role,
					companyLogoUrl: existingUser.companyLogoUrl,
					token: generateToken(existingUser._id),
				},
				needsAccountCreation: false,
			});
		} else {
			const tempToken = crypto.randomBytes(32).toString('hex');

			global.tempGoogleAccounts = global.tempGoogleAccounts || new Map();
			global.tempGoogleAccounts.set(tempToken, {
				email,
				name,
				profilePicture,
				expiresAt: Date.now() + 10 * 60 * 1000,
			});

			res.json({
				needsAccountCreation: true,
				tempToken,
			});
		}
	} catch (error) {
		console.error('Google token verification error:', error);
		res.status(401);
		throw new Error('Invalid Google token');
	}
});

// @desc Create account after Google OAuth
// @route POST /api/auth/google/create-account
// @access Public
const createGoogleAccount = asyncHandler(async (req, res) => {
	const { tempToken, companyName } = req.body;

	if (!tempToken || !companyName) {
		res.status(400);
		throw new Error('Missing required fields');
	}

	global.tempGoogleAccounts = global.tempGoogleAccounts || new Map();
	const tempData = global.tempGoogleAccounts.get(tempToken);

	if (!tempData || tempData.expiresAt < Date.now()) {
		res.status(400);
		throw new Error('Invalid or expired token');
	}

	const existingUser = await User.findOne({ email: tempData.email });
	if (existingUser) {
		res.status(400);
		throw new Error('Account already exists');
	}

	try {
		// Create new user
		const user = await User.create({
			companyName: companyName.trim(),
			email: tempData.email,
			password: crypto.randomBytes(32).toString('hex'),
			companyLogoUrl: tempData.profilePicture || '',
			authProvider: 'google',
		});

		global.tempGoogleAccounts.delete(tempToken);

		res.status(201).json({
			_id: user._id,
			companyName: user.companyName,
			email: user.email,
			role: user.role,
			companyLogoUrl: user.companyLogoUrl,
			token: generateToken(user._id),
		});
	} catch (error) {
		console.error('Google account creation error:', error);
		res.status(500);
		throw new Error('Failed to create account');
	}
});

module.exports = {
	registerUser,
	loginUser,
	adminLogin,
	verifyGoogleToken,
	createGoogleAccount,
};
