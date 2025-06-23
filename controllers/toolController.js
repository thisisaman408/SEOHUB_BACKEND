const asyncHandler = require('express-async-handler');
const Tool = require('../models/toolModel');
const { getRedisClient } = require('../config/db');

const safeJsonParse = (jsonString) => {
	try {
		// This will handle cases where the string might be 'undefined' or null
		if (!jsonString || jsonString === 'undefined' || jsonString === 'null') {
			return null;
		}
		return JSON.parse(jsonString);
	} catch (e) {
		console.error('JSON Parse Error:', e);
		return null;
	}
};

// @desc    Get tools submitted by the logged-in user
// @route   GET /api/tools/my-tools
// @access  Private
const getMyTools = asyncHandler(async (req, res) => {
	// CORRECT: No cache for user-specific data.
	const tools = await Tool.find({ submittedBy: req.user._id }).sort({
		createdAt: -1,
	});
	res.json(tools);
});

// @desc    Submit a new tool
// @route   POST /api/tools
// @access  Private
const submitTool = asyncHandler(async (req, res) => {
	const {
		name,
		tagline,
		description,
		websiteUrl,
		tags,
		appStoreUrl,
		playStoreUrl,
		visual,
	} = req.body;

	if (!name || !tagline || !description || !websiteUrl) {
		res.status(400);
		throw new Error('Please fill all required fields');
	}

	let finalVisual = safeJsonParse(visual);
	if (finalVisual && Array.isArray(finalVisual.content)) {
		finalVisual.content = finalVisual.content.filter(
			(item) => item && item.text && item.text.trim() !== ''
		);
	} else {
		finalVisual = undefined;
	}

	const tool = new Tool({
		name,
		tagline,
		description,
		websiteUrl,
		tags: tags ? tags.split(',').map((tag) => tag.trim()) : [],
		appStoreUrl,
		playStoreUrl,
		submittedBy: req.user._id,
		visual: finalVisual,
		logoUrl: req.file ? req.file.path : '',
	});

	const createdTool = await tool.save();

	const redisClient = getRedisClient();
	await redisClient.del('allTools');
	await redisClient.del('featuredTools');

	res.status(201).json(createdTool);
});

// @desc    Update a tool submitted by the user
// @route   PUT /api/tools/:id
// @access  Private
const updateTool = asyncHandler(async (req, res) => {
	const tool = await Tool.findById(req.params.id);

	if (tool && tool.submittedBy.toString() === req.user._id.toString()) {
		tool.name = req.body.name || tool.name;
		tool.tagline = req.body.tagline || tool.tagline;
		tool.description = req.body.description || tool.description;
		tool.websiteUrl = req.body.websiteUrl || tool.websiteUrl;

		if (req.body.visual) {
			let finalVisual = safeJsonParse(req.body.visual);
			if (finalVisual && Array.isArray(finalVisual.content)) {
				finalVisual.content = finalVisual.content.filter(
					(item) => item && item.text && item.text.trim() !== ''
				);
				tool.visual = finalVisual;
			}
		}

		if (req.file) {
			tool.logoUrl = req.file.path;
		}

		const updatedTool = await tool.save();

		// CORRECT: Invalidate all relevant public caches.
		const redisClient = getRedisClient();
		await redisClient.del('allTools');
		await redisClient.del('featuredTools');
		await redisClient.del(`tool:${req.params.id}`);

		res.json(updatedTool);
	} else {
		res.status(404);
		throw new Error('Tool not found or user not authorized');
	}
});

// @desc    Get all approved tools
// @route   GET /api/tools
// @access  Public
const getAllTools = asyncHandler(async (req, res) => {
	const redisClient = getRedisClient();
	const cacheKey = 'allTools';
	const cachedTools = await redisClient.get(cacheKey);

	if (cachedTools) {
		return res.json(JSON.parse(cachedTools));
	}

	const tools = await Tool.find({ status: 'approved' });
	await redisClient.set(cacheKey, JSON.stringify(tools), { EX: 3600 });
	res.json(tools);
});

// @desc    Get featured tools
// @route   GET /api/tools/featured
// @access  Public
const getFeaturedTools = asyncHandler(async (req, res) => {
	const redisClient = getRedisClient();
	const cacheKey = 'featuredTools';
	const cachedFeatured = await redisClient.get(cacheKey);

	if (cachedFeatured) {
		return res.json(JSON.parse(cachedFeatured));
	}

	const tools = await Tool.find({ status: 'approved', isFeatured: true }).limit(
		10
	);
	await redisClient.set(cacheKey, JSON.stringify(tools), { EX: 3600 });
	res.json(tools);
});

// @desc    Get a single tool by ID
// @route   GET /api/tools/:id
// @access  Public
const getToolById = asyncHandler(async (req, res) => {
	const redisClient = getRedisClient();
	const cacheKey = `tool:${req.params.id}`;
	const cachedTool = await redisClient.get(cacheKey);

	if (cachedTool) {
		return res.json(JSON.parse(cachedTool));
	}

	const tool = await Tool.findById(req.params.id);

	if (tool && tool.status === 'approved') {
		await redisClient.set(cacheKey, JSON.stringify(tool), { EX: 3600 });
		res.json(tool);
	} else if (tool) {
		res.status(401).json({ message: 'Tool not approved' });
	} else {
		res.status(404);
		throw new Error('Tool not found');
	}
});

module.exports = {
	submitTool,
	updateTool,
	getAllTools,
	getFeaturedTools,
	getToolById,
	getMyTools,
};
