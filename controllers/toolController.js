const asyncHandler = require('express-async-handler');
const Tool = require('../models/toolModel');
const { getRedisClient } = require('../config/db');
// @desc    Get tools submitted by the logged-in user
// @route   GET /api/tools/my-tools
// @access  Private
const getMyTools = asyncHandler(async (req, res) => {
	// This function is correct, no changes needed.
	const tools = await Tool.find({ submittedBy: req.user._id }).sort({
		createdAt: -1,
	});
	res.json(tools);
});
// @desc    Submit a new tool
// @route   POST /api/tools
// @access  Private
// --- THIS FUNCTION HAS BEEN MODIFIED ---
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
	let finalVisual = visual;
	if (visual && Array.isArray(visual.content)) {
		finalVisual.content = visual.content.filter(
			(item) => item && item.text && item.text.trim() !== ''
		);
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
	});

	const createdTool = await tool.save();
	const redisClient = getRedisClient();
	await redisClient.del('allTools');
	await redisClient.del('featuredTools');

	res.status(201).json(createdTool);
});

// @desc    Get all approved tools
// @route   GET /api/tools
// @access  Public
const getAllTools = asyncHandler(async (req, res) => {
	// This function is correct, no changes needed.
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
	// This function is correct, no changes needed.
	const redisClient = getRedisClient();
	const cacheKey = 'featuredTools';
	const cachedFeatured = await redisClient.get(cacheKey);
	if (cachedFeatured) {
		return res.json(JSON.parse(cachedFeatured));
	}
	const tools = await Tool.find({ status: 'approved', isFeatured: true }).limit(
		5
	);
	await redisClient.set(cacheKey, JSON.stringify(tools), { EX: 3600 });
	res.json(tools);
});
// @desc    Get a single tool by ID
// @route   GET /api/tools/:id
// @access  Public
const getToolById = asyncHandler(async (req, res) => {
	// This function is correct, no changes needed.
	const tool = await Tool.findById(req.params.id);
	if (tool && tool.status === 'approved') {
		res.json(tool);
	} else {
		res.status(404);
		throw new Error('Tool not found or not approved');
	}
});
// Export all functions
module.exports = {
	submitTool,
	getAllTools,
	getFeaturedTools,
	getToolById,
	getMyTools,
};
