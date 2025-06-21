const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
	const user = await User.findById(req.user._id).select('-password');
	if (user) {
		res.json(user);
	} else {
		res.status(404);
		throw new Error('User not found');
	}
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = asyncHandler(async (req, res) => {
	const user = await User.findById(req.user._id);

	if (user) {
		user.companyName = req.body.companyName || user.companyName;
		user.email = req.body.email || user.email;
		if (req.file) {
			user.companyLogoUrl = req.file.path;
		}

		const updatedUser = await user.save();

		res.json({
			_id: updatedUser._id,
			companyName: updatedUser.companyName,
			email: updatedUser.email,
			role: updatedUser.role,
			companyLogoUrl: updatedUser.companyLogoUrl,
		});
	} else {
		res.status(404);
		throw new Error('User not found');
	}
});

module.exports = { getUserProfile, updateUserProfile };
