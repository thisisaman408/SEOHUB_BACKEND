const asyncHandler = require('express-async-handler');
const Tool = require('../models/toolModel');
const { getRedisClient } = require('../config/db');
const Rating = require('../models/ratingModel');
const Media = require('../models/mediaModel');
// @desc Submit a new tool for review
// @route POST /api/tools
// @access Private¯

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

	const logoFile = req.files?.toolLogo?.[0];
	const logoUrl = logoFile ? logoFile.path : '';

	const tool = await Tool.create({
		name,
		tagline,
		description,
		websiteUrl,
		logoUrl,
		tags: tags ? tags.split(',').map((tag) => tag.trim()) : [],
		appStoreUrl,
		playStoreUrl,
		visual: typeof visual === 'string' ? JSON.parse(visual) : visual,
		submittedBy: req.user._id,
	});
	const mediaFiles = req.files?.mediaFiles || [];
	const mediaDocs = [];

	for (let i = 0; i < mediaFiles.length; i++) {
		const file = mediaFiles[i];
		const metaStr = req.body[`mediaData_${i}`];
		let meta = {};
		try {
			meta = metaStr ? JSON.parse(metaStr) : {};
		} catch {
			meta = {};
		}
		const validCategories = [
			'screenshot',
			'demo_video',
			'tutorial',
			'feature_highlight',
			'logo',
			'banner',
		];
		if (!validCategories.includes(meta.category)) continue;
		let type = 'document';
		if (file.mimetype.startsWith('image/')) type = 'image';
		else if (file.mimetype.startsWith('video/')) type = 'video';
		const mediaDoc = await Media.create({
			tool: tool._id,
			uploadedBy: req.user._id,
			type,
			category: meta.category,
			url: file.path,
			title: meta.title || '',
			description: meta.description || '',
			order: i,
			fileSize: file.size,
		});
		mediaDocs.push(mediaDoc);
	}

	res.status(201).json({
		tool,
		media: mediaDocs,
	});
});
// @desc Update a tool
// @route PUT /api/tools/:id
// @access Private
const updateTool = asyncHandler(async (req, res) => {
	const tool = await Tool.findById(req.params.id);

	if (tool && tool.submittedBy.toString() === req.user._id.toString()) {
		tool.name = req.body.name || tool.name;
		tool.tagline = req.body.tagline || tool.tagline;
		tool.description = req.body.description || tool.description;
		tool.websiteUrl = req.body.websiteUrl || tool.websiteUrl;
		tool.appStoreUrl = req.body.appStoreUrl || tool.appStoreUrl;
		tool.playStoreUrl = req.body.playStoreUrl || tool.playStoreUrl;

		if (req.body.tags) {
			tool.tags = req.body.tags.split(',').map((tag) => tag.trim());
		}

		if (req.file) {
			tool.logoUrl = req.file.path;
		}

		if (req.body.visual) {
			tool.visual =
				typeof req.body.visual === 'string'
					? JSON.parse(req.body.visual)
					: req.body.visual;
		}

		const updatedTool = await tool.save();

		// Clear cache
		const redisClient = getRedisClient();
		await redisClient.del('allTools');
		await redisClient.del('featuredTools');
		await redisClient.del(`tool:${req.params.id}`);

		res.json(updatedTool);
	} else {
		res.status(404);
		throw new Error('Tool not found or not authorized');
	}
});

// @desc Get all approved tools
// @route GET /api/tools
// @access Public
const getAllTools = asyncHandler(async (req, res) => {
	const redisClient = getRedisClient();
	const cachedTools = await redisClient.get('allTools');

	if (cachedTools) {
		return res.json(JSON.parse(cachedTools));
	}

	const tools = await Tool.find({ status: 'approved' }).sort({
		isFeatured: -1,
		createdAt: -1,
	});

	await redisClient.set('allTools', JSON.stringify(tools), { EX: 3600 });
	res.json(tools);
});

// @desc Get featured tools
// @route GET /api/tools/featured
// @access Public
const getFeaturedTools = asyncHandler(async (req, res) => {
	const redisClient = getRedisClient();
	const cachedFeatured = await redisClient.get('featuredTools');

	if (cachedFeatured) {
		return res.json(JSON.parse(cachedFeatured));
	}

	const tools = await Tool.find({
		status: 'approved',
		isFeatured: true,
	}).sort({ createdAt: -1 });

	await redisClient.set('featuredTools', JSON.stringify(tools), { EX: 3600 });
	res.json(tools);
});

// @desc Get a single tool by ID
// @route GET /api/tools/:id
// @access Public
const getToolById = asyncHandler(async (req, res) => {
	const redisClient = getRedisClient();
	const cacheKey = `tool:${req.params.id}`;
	const cachedTool = await redisClient.get(cacheKey);

	if (cachedTool) {
		return res.json(JSON.parse(cachedTool));
	}

	const tool = await Tool.findOne({
		_id: req.params.id,
		status: 'approved',
	});

	if (tool) {
		await redisClient.set(cacheKey, JSON.stringify(tool), { EX: 3600 });
		res.json(tool);
	} else {
		res.status(404);
		throw new Error('Tool not found');
	}
});

// @desc Get a single tool by slug
// @route GET /api/tools/slug/:slug
// @access Public
const getToolBySlug = asyncHandler(async (req, res) => {
	const redisClient = getRedisClient();
	const cacheKey = `tool:slug:${req.params.slug}`;
	const cachedTool = await redisClient.get(cacheKey);

	if (cachedTool) {
		return res.json(JSON.parse(cachedTool));
	}

	const tool = await Tool.findOne({
		slug: req.params.slug,
		status: 'approved',
	});

	if (tool) {
		await redisClient.set(cacheKey, JSON.stringify(tool), { EX: 3600 });
		res.json(tool);
	} else {
		res.status(404);
		throw new Error('Tool not found');
	}
});

// @desc Get my tools
// @route GET /api/tools/my-tools
// @access Private
const getMyTools = asyncHandler(async (req, res) => {
	const tools = await Tool.find({ submittedBy: req.user._id }).sort({
		createdAt: -1,
	});
	res.json(tools);
});

// @desc Rate a tool
// @route POST /api/tools/:id/rate
// @access Private
const rateTool = asyncHandler(async (req, res) => {
	const { rating } = req.body;
	const toolId = req.params.id;

	if (!rating || rating < 1 || rating > 5) {
		res.status(400);
		throw new Error('Rating must be between 1 and 5');
	}

	const tool = await Tool.findById(toolId);
	if (!tool) {
		res.status(404);
		throw new Error('Tool not found');
	}

	// Check if user already rated
	const existingRating = await Rating.findOne({
		tool: toolId,
		user: req.user._id,
	});

	if (existingRating) {
		// Update existing rating
		const oldRating = existingRating.rating;
		existingRating.rating = rating;
		await existingRating.save();

		// Update tool's rating stats
		tool.totalRatingSum = tool.totalRatingSum - oldRating + rating;
		tool.averageRating = tool.totalRatingSum / tool.numberOfRatings;
	} else {
		// Create new rating
		await Rating.create({
			tool: toolId,
			user: req.user._id,
			rating,
		});

		// Update tool's rating stats
		tool.numberOfRatings += 1;
		tool.totalRatingSum += rating;
		tool.averageRating = tool.totalRatingSum / tool.numberOfRatings;
	}

	await tool.save();

	// Clear cache
	const redisClient = getRedisClient();
	await redisClient.del('allTools');
	await redisClient.del('featuredTools');
	await redisClient.del(`tool:${toolId}`);

	res.json({
		success: true,
		message: 'Rating saved successfully',
		averageRating: tool.averageRating,
		numberOfRatings: tool.numberOfRatings,
		userRating: rating,
	});
});

// ✅ AI-powered search function
// @desc Search tools with AI enhancement
// @route GET /api/tools/search/ai
// @access Public
const searchToolsWithAI = asyncHandler(async (req, res) => {
	const { q: query, filters = {} } = req.query;
	const limit = parseInt(req.query.limit) || 20;
	const page = parseInt(req.query.page) || 1;
	const skip = (page - 1) * limit;

	try {
		let searchResults = [];
		let totalCount = 0;

		if (!query || query.trim() === '') {
			const tools = await Tool.find({ status: 'approved' })
				.sort({ isFeatured: -1, createdAt: -1 })
				.skip(skip)
				.limit(limit);

			totalCount = await Tool.countDocuments({ status: 'approved' });
			searchResults = tools;
		} else {
			const searchQuery = query.trim();
			const enhancedQuery = enhanceQueryWithAI(searchQuery);
			searchResults = await performTextSearch(searchQuery, skip, limit);
			totalCount = searchResults.length;
		}

		if (Object.keys(filters).length > 0) {
			searchResults = applyFilters(searchResults, filters);
		}

		res.json({
			success: true,
			data: {
				tools: searchResults,
				pagination: {
					currentPage: page,
					totalPages: Math.ceil(totalCount / limit),
					totalResults: totalCount,
					hasNextPage: page < Math.ceil(totalCount / limit),
					hasPrevPage: page > 1,
					limit: limit,
				},
				searchMeta: {
					query: query,
					enhancedQuery: query ? enhanceQueryWithAI(query) : null,
					searchTime: Date.now(),
					totalResults: totalCount,
					processingTimeMs: Date.now(),
				},
			},
		});
	} catch (error) {
		console.error('Search error:', error);
		res.status(500).json({
			success: false,
			message: 'Search failed',
			error: error.message,
		});
	}
});

// ✅ Get search suggestions
// @route GET /api/tools/search/suggestions
// @access Public
const getSearchSuggestions = asyncHandler(async (req, res) => {
	const { q: query } = req.query;

	if (!query || query.trim().length < 2) {
		return res.json({ suggestions: [] });
	}

	try {
		// Get suggestions based on existing tool names and tags
		const tools = await Tool.find(
			{
				status: 'approved',
				$or: [
					{ name: { $regex: query, $options: 'i' } },
					{ tags: { $elemMatch: { $regex: query, $options: 'i' } } },
				],
			},
			'name tags'
		).limit(5);

		const suggestions = [];

		// Add tool names
		tools.forEach((tool) => {
			if (tool.name.toLowerCase().includes(query.toLowerCase())) {
				suggestions.push(tool.name);
			}
		});

		// Add relevant tags
		const allTags = tools.flatMap((tool) => tool.tags);
		const uniqueTags = [...new Set(allTags)];
		uniqueTags.forEach((tag) => {
			if (
				tag.toLowerCase().includes(query.toLowerCase()) &&
				!suggestions.includes(tag)
			) {
				suggestions.push(tag);
			}
		});

		res.json({ suggestions: suggestions.slice(0, 8) });
	} catch (error) {
		console.error('Suggestions error:', error);
		res.json({ suggestions: [] });
	}
});

function enhanceQueryWithAI(query) {
	const lowerQuery = query.toLowerCase();

	// Category mappings
	const categoryMappings = {
		ai: ['artificial intelligence', 'machine learning', 'neural network'],
		seo: [
			'search engine optimization',
			'search ranking',
			'website optimization',
		],
		analytics: ['data analysis', 'metrics', 'tracking', 'insights'],
		content: ['writing', 'copywriting', 'text generation'],
		design: ['ui', 'ux', 'user interface', 'graphic design'],
		social: ['social media', 'marketing', 'promotion'],
		automation: ['workflow', 'process', 'automatic'],
	};

	let expandedTerms = [query];
	let intent = 'general';

	// Detect intent
	if (lowerQuery.includes('help') || lowerQuery.includes('assist')) {
		intent = 'help_seeking';
	} else if (lowerQuery.includes('best') || lowerQuery.includes('top')) {
		intent = 'recommendation';
	} else if (lowerQuery.includes('create') || lowerQuery.includes('make')) {
		intent = 'creation';
	}

	// Expand terms
	Object.entries(categoryMappings).forEach(([category, terms]) => {
		if (
			lowerQuery.includes(category) ||
			terms.some((term) => lowerQuery.includes(term))
		) {
			expandedTerms.push(...terms, category);
		}
	});

	return {
		original: query,
		expanded: [...new Set(expandedTerms)],
		intent,
		keywords: extractKeywords(query),
		synonyms: generateSynonyms(query),
	};
}

function extractKeywords(query) {
	const stopWords = new Set([
		'i',
		'me',
		'my',
		'we',
		'our',
		'you',
		'your',
		'he',
		'him',
		'his',
		'she',
		'her',
		'it',
		'its',
		'they',
		'them',
		'their',
		'what',
		'which',
		'who',
		'this',
		'that',
		'these',
		'those',
		'am',
		'is',
		'are',
		'was',
		'were',
		'be',
		'been',
		'being',
		'have',
		'has',
		'had',
		'having',
		'do',
		'does',
		'did',
		'doing',
		'a',
		'an',
		'the',
		'and',
		'but',
		'if',
		'or',
		'because',
		'as',
		'until',
		'while',
		'of',
		'at',
		'by',
		'for',
		'with',
		'through',
		'during',
		'before',
		'after',
		'above',
		'below',
		'up',
		'down',
		'in',
		'out',
		'on',
		'off',
		'over',
		'under',
		'again',
		'further',
		'then',
		'once',
		'here',
		'there',
		'when',
		'where',
		'why',
		'how',
		'all',
		'any',
		'both',
		'each',
		'few',
		'more',
		'most',
		'other',
		'some',
		'such',
		'no',
		'nor',
		'not',
		'only',
		'own',
		'same',
		'so',
		'than',
		'too',
		'very',
		'can',
		'will',
		'just',
		'should',
		'now',
	]);

	return query
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ')
		.split(/\s+/)
		.filter((word) => word.length > 2 && !stopWords.has(word))
		.slice(0, 10);
}

function generateSynonyms(query) {
	const synonymMap = {
		tool: ['application', 'software', 'service', 'platform', 'solution'],
		create: ['make', 'build', 'generate', 'produce', 'design'],
		analyze: ['examine', 'study', 'review', 'assess', 'evaluate'],
		fast: ['quick', 'rapid', 'speedy', 'swift'],
		easy: ['simple', 'effortless', 'straightforward', 'user-friendly'],
		free: ['no-cost', 'complimentary', 'gratis'],
		content: ['text', 'copy', 'material', 'writing'],
		image: ['photo', 'picture', 'graphic', 'visual'],
		website: ['site', 'web page', 'online platform'],
	};

	const synonyms = [];
	const words = extractKeywords(query);

	words.forEach((word) => {
		if (synonymMap[word]) {
			synonyms.push(...synonymMap[word]);
		}
	});

	return [...new Set(synonyms)];
}

async function performTextSearch(query, skip, limit) {
	const keywords = extractKeywords(query);
	const allTerms = [query, ...keywords];

	const searchPipeline = [
		{
			$match: {
				status: 'approved',
				$or: [
					{ name: { $regex: query, $options: 'i' } },
					{ tagline: { $regex: query, $options: 'i' } },
					{ description: { $regex: query, $options: 'i' } },
					{ tags: { $in: allTerms.map((term) => new RegExp(term, 'i')) } },
				],
			},
		},
		{
			$addFields: {
				relevanceScore: {
					$add: [
						{
							$cond: [
								{ $regexMatch: { input: '$name', regex: query, options: 'i' } },
								10,
								0,
							],
						},
						{
							$cond: [
								{
									$regexMatch: {
										input: '$tagline',
										regex: query,
										options: 'i',
									},
								},
								7,
								0,
							],
						},
						{
							$cond: [
								{
									$regexMatch: {
										input: '$description',
										regex: query,
										options: 'i',
									},
								},
								5,
								0,
							],
						},
						{ $cond: ['$isFeatured', 2, 0] },
						{ $divide: [{ $ifNull: ['$analytics.totalViews', 0] }, 1000] },
					],
				},
			},
		},
		{
			$sort: { relevanceScore: -1, isFeatured: -1, createdAt: -1 },
		},
		{
			$skip: skip,
		},
		{
			$limit: limit,
		},
	];

	return await Tool.aggregate(searchPipeline);
}

function applyFilters(tools, filters) {
	return tools.filter((tool) => {
		if (filters.featured && !tool.isFeatured) return false;
		if (
			filters.category &&
			!tool.tags.some((tag) =>
				tag.toLowerCase().includes(filters.category.toLowerCase())
			)
		)
			return false;
		if (filters.minRating && tool.averageRating < parseFloat(filters.minRating))
			return false;
		return true;
	});
}

module.exports = {
	submitTool,
	updateTool,
	getAllTools,
	getFeaturedTools,
	getToolById,
	getToolBySlug,
	getMyTools,
	rateTool,
	searchToolsWithAI,
	getSearchSuggestions,
};
