// controllers/viewController.js
const asyncHandler = require('express-async-handler');
const ToolView = require('../models/toolViewModel');
const Tool = require('../models/toolModel');
const { getRedisClient } = require('../config/db');
const crypto = require('crypto');

// Generate session ID for anonymous users
const generateSessionId = (req) => {
	const userAgent = req.get('User-Agent') || '';
	const ip = req.ip || req.connection.remoteAddress;
	const timestamp = Date.now();

	return crypto
		.createHash('sha256')
		.update(`${ip}${userAgent}${timestamp}`)
		.digest('hex')
		.substring(0, 32);
};

// @desc Track tool view
// @route POST /api/tools/:toolId/view
// @access Public
const trackView = asyncHandler(async (req, res) => {
	const { toolId } = req.params;
	const { duration = 0, source = 'marketplace' } = req.body;

	const tool = await Tool.findById(toolId);
	if (!tool) {
		res.status(404);
		throw new Error('Tool not found');
	}

	const sessionId = req.user?.id || generateSessionId(req);
	const ipAddress = req.ip || req.connection.remoteAddress;
	const userAgent = req.get('User-Agent') || '';

	try {
		// Check if this session already viewed this tool
		const existingView = await ToolView.findOne({
			tool: toolId,
			sessionId: sessionId,
		});

		if (existingView) {
			// Update duration if provided
			if (duration > existingView.viewDuration) {
				existingView.viewDuration = duration;
				await existingView.save();
			}

			return res.json({ message: 'View updated', isNewView: false });
		}

		// Create new view record
		await ToolView.create({
			tool: toolId,
			user: req.user?._id || null,
			sessionId,
			ipAddress,
			userAgent,
			viewDuration: duration,
			source,
			country: req.get('CF-IPCountry') || 'Unknown', // Cloudflare header
		});

		// Update tool analytics
		const today = new Date();
		const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
		const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

		// Get counts
		const [totalViews, uniqueViews, weeklyViews, monthlyViews] =
			await Promise.all([
				ToolView.countDocuments({ tool: toolId }),
				ToolView.distinct('sessionId', { tool: toolId }).then(
					(sessions) => sessions.length
				),
				ToolView.countDocuments({ tool: toolId, createdAt: { $gte: weekAgo } }),
				ToolView.countDocuments({
					tool: toolId,
					createdAt: { $gte: monthAgo },
				}),
			]);

		// Update tool with new analytics
		await Tool.findByIdAndUpdate(toolId, {
			'analytics.totalViews': totalViews,
			'analytics.uniqueViews': uniqueViews,
			'analytics.weeklyViews': weeklyViews,
			'analytics.monthlyViews': monthlyViews,
			'analytics.lastViewedAt': new Date(),
		});

		// Clear tool cache
		const redisClient = getRedisClient();
		await redisClient.del(`tool:${toolId}`);
		await redisClient.del('allTools');
		await redisClient.del('featuredTools');

		res.json({ message: 'View tracked successfully', isNewView: true });
	} catch (error) {
		console.error('View tracking error:', error);
		// Don't fail the request if view tracking fails
		res.json({ message: 'Request processed', isNewView: false });
	}
});

// @desc Get tool analytics
// @route GET /api/tools/:toolId/analytics
// @access Private (tool owner or admin)
const getToolAnalytics = asyncHandler(async (req, res) => {
	const { toolId } = req.params;
	const { period = '30d' } = req.query;

	const tool = await Tool.findById(toolId);
	if (!tool) {
		res.status(404);
		throw new Error('Tool not found');
	}

	// Check if user owns the tool or is admin
	if (
		tool.submittedBy.toString() !== req.user._id.toString() &&
		req.user.role !== 'admin'
	) {
		res.status(403);
		throw new Error('Not authorized to view analytics');
	}

	// Calculate date range
	let startDate;
	switch (period) {
		case '7d':
			startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			break;
		case '30d':
			startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			break;
		case '90d':
			startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
			break;
		default:
			startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
	}

	// Aggregation pipeline for detailed analytics
	const analytics = await ToolView.aggregate([
		{
			$match: {
				tool: tool._id,
				createdAt: { $gte: startDate },
			},
		},
		{
			$group: {
				_id: {
					date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
					source: '$source',
				},
				views: { $sum: 1 },
				uniqueUsers: { $addToSet: '$sessionId' },
				avgDuration: { $avg: '$viewDuration' },
				countries: { $addToSet: '$country' },
			},
		},
		{
			$group: {
				_id: '$_id.date',
				totalViews: { $sum: '$views' },
				uniqueViews: { $sum: { $size: '$uniqueUsers' } },
				avgDuration: { $avg: '$avgDuration' },
				sources: {
					$push: {
						source: '$_id.source',
						views: '$views',
					},
				},
				countries: { $addToSet: '$countries' },
			},
		},
		{ $sort: { _id: 1 } },
	]);

	// Get top countries
	const topCountries = await ToolView.aggregate([
		{
			$match: {
				tool: tool._id,
				createdAt: { $gte: startDate },
			},
		},
		{
			$group: {
				_id: '$country',
				views: { $sum: 1 },
			},
		},
		{ $sort: { views: -1 } },
		{ $limit: 10 },
	]);

	res.json({
		period,
		totalViews: tool.analytics.totalViews,
		uniqueViews: tool.analytics.uniqueViews,
		weeklyViews: tool.analytics.weeklyViews,
		monthlyViews: tool.analytics.monthlyViews,
		dailyBreakdown: analytics,
		topCountries,
		lastUpdated: tool.analytics.lastViewedAt,
	});
});

module.exports = {
	trackView,
	getToolAnalytics,
};
