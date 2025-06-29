const asyncHandler = require('express-async-handler');
const ToolView = require('../models/toolViewModel');
const Tool = require('../models/toolModel');
const { getRedisClient } = require('../config/db');
const crypto = require('crypto');
const Click = require('../models/clickModel');

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

// @desc Track external click
// @route POST /api/tools/:toolId/click
// @access Public
const trackClick = asyncHandler(async (req, res) => {
	const { toolId } = req.params;
	const { clickType = 'website', source = 'marketplace' } = req.body;

	const tool = await Tool.findById(toolId);
	if (!tool) {
		res.status(404);
		throw new Error('Tool not found');
	}

	const sessionId = req.user?.id || generateSessionId(req);
	const ipAddress = req.ip || req.connection.remoteAddress;
	const userAgent = req.get('User-Agent') || '';

	try {
		// Create click record
		await Click.create({
			tool: toolId,
			user: req.user?._id || null,
			sessionId,
			ipAddress,
			userAgent,
			clickType,
			source,
			country: req.get('CF-IPCountry') || 'Unknown',
		});

		res.json({ message: 'Click tracked successfully' });
	} catch (error) {
		console.error('Click tracking error:', error);
		res.json({ message: 'Request processed' });
	}
});

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

	if (
		tool.submittedBy.toString() !== req.user._id.toString() &&
		req.user.role !== 'admin'
	) {
		res.status(403);
		throw new Error('Not authorized to view analytics');
	}

	let startDate, previousStartDate;
	const endDate = new Date();

	switch (period) {
		case '7d':
			startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			previousStartDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
			break;
		case '30d':
			startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			previousStartDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
			break;
		case '90d':
			startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
			previousStartDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
			break;
		default:
			startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			previousStartDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
	}

	const previousEndDate = startDate;

	const [currentViews, previousViews, currentClicks, previousClicks] =
		await Promise.all([
			ToolView.countDocuments({
				tool: tool._id,
				createdAt: { $gte: startDate, $lte: endDate },
			}),
			ToolView.countDocuments({
				tool: tool._id,
				createdAt: { $gte: previousStartDate, $lt: previousEndDate },
			}),
			Click.countDocuments({
				tool: tool._id,
				createdAt: { $gte: startDate, $lte: endDate },
			}),
			Click.countDocuments({
				tool: tool._id,
				createdAt: { $gte: previousStartDate, $lt: previousEndDate },
			}),
		]);

	const [currentUniqueVisitors, previousUniqueVisitors] = await Promise.all([
		ToolView.distinct('sessionId', {
			tool: tool._id,
			createdAt: { $gte: startDate, $lte: endDate },
		}).then((sessions) => sessions.length),
		ToolView.distinct('sessionId', {
			tool: tool._id,
			createdAt: { $gte: previousStartDate, $lt: previousEndDate },
		}).then((sessions) => sessions.length),
	]);

	const viewsChange =
		previousViews > 0
			? ((currentViews - previousViews) / previousViews) * 100
			: 0;
	const visitorsChange =
		previousUniqueVisitors > 0
			? ((currentUniqueVisitors - previousUniqueVisitors) /
					previousUniqueVisitors) *
			  100
			: 0;
	const clicksChange =
		previousClicks > 0
			? ((currentClicks - previousClicks) / previousClicks) * 100
			: 0;

	const clickThroughRate =
		currentViews > 0 ? (currentClicks / currentViews) * 100 : 0;
	const previousCTR =
		previousViews > 0 ? (previousClicks / previousViews) * 100 : 0;
	const ctrChange =
		previousCTR > 0
			? ((clickThroughRate - previousCTR) / previousCTR) * 100
			: 0;

	const dailyAnalytics = await ToolView.aggregate([
		{
			$match: {
				tool: tool._id,
				createdAt: { $gte: startDate, $lte: endDate },
			},
		},
		{
			$group: {
				_id: {
					date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
				},
				views: { $sum: 1 },
				uniqueVisitors: { $addToSet: '$sessionId' },
				avgDuration: { $avg: '$viewDuration' },
			},
		},
		{
			$project: {
				date: '$_id.date',
				views: 1,
				uniqueViews: { $size: '$uniqueVisitors' },
				avgDuration: 1,
			},
		},
		{ $sort: { date: 1 } },
	]);

	const trafficSources = await ToolView.aggregate([
		{
			$match: {
				tool: tool._id,
				createdAt: { $gte: startDate, $lte: endDate },
			},
		},
		{
			$group: {
				_id: '$source',
				visits: { $sum: 1 },
			},
		},
		{
			$project: {
				source: '$_id',
				visits: 1,
			},
		},
		{ $sort: { visits: -1 } },
	]);

	const topCountries = await ToolView.aggregate([
		{
			$match: {
				tool: tool._id,
				createdAt: { $gte: startDate, $lte: endDate },
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

	const avgDurationResult = await ToolView.aggregate([
		{
			$match: {
				tool: tool._id,
				createdAt: { $gte: startDate, $lte: endDate },
			},
		},
		{
			$group: {
				_id: null,
				avgDuration: { $avg: '$viewDuration' },
				totalSessions: { $sum: 1 },
				shortSessions: {
					$sum: {
						$cond: [{ $lt: ['$viewDuration', 10] }, 1, 0],
					},
				},
			},
		},
	]);

	const averageTimeOnPage =
		avgDurationResult.length > 0 ? avgDurationResult[0].avgDuration : 0;
	const bounceRate =
		avgDurationResult.length > 0
			? (avgDurationResult[0].shortSessions /
					avgDurationResult[0].totalSessions) *
			  100
			: 0;

	const returnVisitorsCount = await ToolView.aggregate([
		{
			$match: {
				tool: tool._id,
				createdAt: { $gte: startDate, $lte: endDate },
			},
		},
		{
			$group: {
				_id: '$sessionId',
				visitCount: { $sum: 1 },
			},
		},
		{
			$match: {
				visitCount: { $gt: 1 },
			},
		},
		{
			$count: 'returnVisitors',
		},
	]);

	const returnVisitors =
		currentUniqueVisitors > 0
			? ((returnVisitorsCount[0]?.returnVisitors || 0) /
					currentUniqueVisitors) *
			  100
			: 0;

	res.json({
		period,
		totalViews: currentViews,
		uniqueViews: currentUniqueVisitors,
		uniqueVisitors: currentUniqueVisitors,
		weeklyViews: tool.analytics.weeklyViews,
		monthlyViews: tool.analytics.monthlyViews,

		viewsChange,
		visitorsChange,
		ctrChange,
		clicksChange,

		externalClicks: currentClicks,
		clickThroughRate,

		averageTimeOnPage,
		bounceRate,
		returnVisitors,

		dailyData: dailyAnalytics,
		dailyBreakdown: dailyAnalytics,
		trafficSources,
		topCountries,

		lastUpdated: tool.analytics.lastViewedAt,
	});
});

module.exports = {
	trackView,
	trackClick,
	getToolAnalytics,
};
