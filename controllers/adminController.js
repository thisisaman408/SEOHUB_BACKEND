const asyncHandler = require('express-async-handler');
const Tool = require('../models/toolModel');
const User = require('../models/userModel');
const Comment = require('../models/commentModel');
const { getRedisClient } = require('../config/db');

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
const getAdminStats = asyncHandler(async (req, res) => {
	const [
		approvedCount,
		pendingCount,
		rejectedCount,
		featuredCount,
		userCount,
		allToolsCount,
	] = await Promise.all([
		Tool.countDocuments({ status: 'approved' }),
		Tool.countDocuments({ status: 'pending' }),
		Tool.countDocuments({ status: 'rejected' }),
		Tool.countDocuments({ isFeatured: true, status: 'approved' }),
		User.countDocuments(),
		Tool.countDocuments(),
	]);

	res.json({
		tools: {
			approved: approvedCount,
			pending: pendingCount,
			rejected: rejectedCount,
			featured: featuredCount,
			all: allToolsCount,
		},
		users: {
			total: userCount,
		},
	});
});

// @desc    Get all pending tools
// @route   GET /api/admin/tools/pending
// @access  Private/Admin
const getPendingTools = asyncHandler(async (req, res) => {
	const tools = await Tool.find({ status: 'pending' }).populate(
		'submittedBy',
		'companyName email'
	);
	res.json(tools);
});
// @desc    Get all approved tools for admin
// @route   GET /api/admin/tools/approved
// @access  Private/Admin
const getApprovedTools = asyncHandler(async (req, res) => {
	const tools = await Tool.find({ status: 'approved' }).populate(
		'submittedBy',
		'companyName email'
	);
	res.json(tools);
});

// @desc    Get all rejected tools for admin
// @route   GET /api/admin/tools/rejected
// @access  Private/Admin
const getRejectedTools = asyncHandler(async (req, res) => {
	const tools = await Tool.find({ status: 'rejected' }).populate(
		'submittedBy',
		'companyName email'
	);
	res.json(tools);
});

// @desc    Get all tools for admin regardless of status
// @route   GET /api/admin/tools/all
// @access  Private/Admin
const getAllToolsAdmin = asyncHandler(async (req, res) => {
	const tools = await Tool.find({}).populate(
		'submittedBy',
		'companyName email'
	);
	res.json(tools);
});

// @desc    Update tool status (approve, reject, feature)
// @route   PUT /api/admin/tools/:id
// @access  Private/Admin
const updateToolStatus = asyncHandler(async (req, res) => {
	const { status, isFeatured } = req.body;
	const tool = await Tool.findById(req.params.id);

	if (tool) {
		if (status) tool.status = status;
		if (isFeatured !== undefined) tool.isFeatured = isFeatured;
		const updatedTool = await tool.save();
		const redisClient = getRedisClient();
		await redisClient.del('allTools');
		await redisClient.del('featuredTools');
		await redisClient.del(`tool:${req.params.id}`);
		res.json(updatedTool);
	} else {
		res.status(404).throw(new Error('Tool not found'));
	}
});

// @desc    Delete a tool
// @route   DELETE /api/admin/tools/:id
// @access  Private/Admin
const deleteTool = asyncHandler(async (req, res) => {
	const tool = await Tool.findById(req.params.id);
	if (tool) {
		await tool.deleteOne();
		const redisClient = getRedisClient();
		await redisClient.del('allTools');
		await redisClient.del('featuredTools');
		await redisClient.del(`tool:${req.params.id}`);
		res.json({ message: 'Tool removed' });
	} else {
		res.status(404).throw(new Error('Tool not found'));
	}
});

// @desc Get reported comments
// @route GET /api/admin/comments/reported
// @access Private/Admin
const getReportedComments = asyncHandler(async (req, res) => {
	const reportedComments = await Comment.find({
		$or: [{ status: 'reported' }, { 'reports.0': { $exists: true } }],
	})
		.populate('user', 'companyName email')
		.populate('tool', 'name')
		.sort({ updatedAt: -1 });

	res.json(reportedComments);
});

// @desc Moderate comment
// @route PUT /api/admin/comments/:commentId/moderate
// @access Private/Admin
const moderateComment = asyncHandler(async (req, res) => {
	const { status } = req.body; // 'approved', 'rejected'

	const comment = await Comment.findById(req.params.commentId);
	if (!comment) {
		res.status(404);
		throw new Error('Comment not found');
	}

	comment.status = status;

	if (status === 'approved') {
		comment.reports = [];
	}

	await comment.save();

	const redisClient = getRedisClient();
	const pattern = `comments:${comment.tool}:*`;
	const keys = await redisClient.keys(pattern);
	if (keys.length > 0) {
		await redisClient.del(keys);
	}

	res.json(comment);
});
const getCommentById = asyncHandler(async (req, res) => {
	const comment = await Comment.findById(req.params.commentId)
		.populate('user', 'companyName email companyLogoUrl')
		.populate('tool', 'name slug');

	if (!comment) {
		res.status(404);
		throw new Error('Comment not found');
	}

	res.json(comment);
});
module.exports = {
	getAdminStats,
	getPendingTools,
	getApprovedTools,
	getRejectedTools,
	getAllToolsAdmin,
	updateToolStatus,
	deleteTool,
	getReportedComments,
	moderateComment,
	getCommentById,
};
