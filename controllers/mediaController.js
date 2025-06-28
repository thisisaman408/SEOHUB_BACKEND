// controllers/mediaController.js
const asyncHandler = require('express-async-handler');
const Media = require('../models/mediaModel');
const Tool = require('../models/toolModel');
const { cloudinary } = require('../config/cloudinary');
const { getRedisClient } = require('../config/db');

// @desc Upload media for a tool
// @route POST /api/tools/:toolId/media
// @access Private
const uploadMedia = asyncHandler(async (req, res) => {
	const { toolId } = req.params;
	const { category, title, description, order = 0 } = req.body;

	const tool = await Tool.findById(toolId);
	if (!tool) {
		res.status(404);
		throw new Error('Tool not found');
	}

	// Check if user owns the tool
	if (tool.submittedBy.toString() !== req.user._id.toString()) {
		res.status(403);
		throw new Error('Not authorized to upload media for this tool');
	}

	if (!req.file) {
		res.status(400);
		throw new Error('No file uploaded');
	}

	const validCategories = [
		'screenshot',
		'demo_video',
		'tutorial',
		'feature_highlight',
		'logo',
		'banner',
	];
	if (!validCategories.includes(category)) {
		res.status(400);
		throw new Error('Invalid media category');
	}

	// Determine media type
	let mediaType;
	if (req.file.mimetype.startsWith('image/')) {
		mediaType = 'image';
	} else if (req.file.mimetype.startsWith('video/')) {
		mediaType = 'video';
	} else {
		mediaType = 'document';
	}

	// Create media record
	const mediaData = {
		tool: toolId,
		uploadedBy: req.user._id,
		type: mediaType,
		category,
		url: req.file.path,
		title: title || '',
		description: description || '',
		order: parseInt(order),
		fileSize: req.file.bytes,
	};

	// Add dimensions for images
	if (mediaType === 'image' && req.file.width && req.file.height) {
		mediaData.dimensions = {
			width: req.file.width,
			height: req.file.height,
		};
	}

	// Add duration for videos
	if (mediaType === 'video' && req.file.duration) {
		mediaData.duration = req.file.duration;
	}

	// Generate thumbnail for videos
	if (mediaType === 'video') {
		try {
			const thumbnailUrl = cloudinary.url(req.file.public_id, {
				resource_type: 'video',
				format: 'jpg',
				transformation: [
					{ width: 640, height: 360, crop: 'fill' },
					{ quality: 'auto' },
				],
			});
			mediaData.thumbnail = thumbnailUrl;
		} catch (error) {
			console.error('Error generating video thumbnail:', error);
		}
	}

	const media = await Media.create(mediaData);

	// Update tool media stats
	const mediaStats = await Media.aggregate([
		{ $match: { tool: tool._id, status: 'active' } },
		{
			$group: {
				_id: null,
				totalMedia: { $sum: 1 },
				screenshots: {
					$sum: {
						$cond: [{ $eq: ['$category', 'screenshot'] }, 1, 0],
					},
				},
				videos: {
					$sum: {
						$cond: [{ $eq: ['$type', 'video'] }, 1, 0],
					},
				},
			},
		},
	]);

	if (mediaStats.length > 0) {
		await Tool.findByIdAndUpdate(toolId, {
			'mediaStats.totalMedia': mediaStats[0].totalMedia,
			'mediaStats.screenshots': mediaStats[0].screenshots,
			'mediaStats.videos': mediaStats[0].videos,
		});
	}

	// Clear cache
	const redisClient = getRedisClient();
	await redisClient.del(`tool:${toolId}`);
	await redisClient.del('allTools');

	res.status(201).json(media);
});

// @desc Get media for a tool
// @route GET /api/tools/:toolId/media
// @access Public
const getToolMedia = asyncHandler(async (req, res) => {
	const { toolId } = req.params;
	const { category, type } = req.query;

	let filter = { tool: toolId, status: 'active' };

	if (category) {
		filter.category = category;
	}

	if (type) {
		filter.type = type;
	}

	const media = await Media.find(filter)
		.sort({ order: 1, createdAt: 1 })
		.populate('uploadedBy', 'companyName');

	res.json(media);
});

// @desc Update media
// @route PUT /api/tools/:toolId/media/:mediaId
// @access Private
const updateMedia = asyncHandler(async (req, res) => {
	const { toolId, mediaId } = req.params;
	const { title, description, order, category } = req.body;

	const media = await Media.findById(mediaId);
	if (!media) {
		res.status(404);
		throw new Error('Media not found');
	}

	const tool = await Tool.findById(toolId);
	if (!tool || tool.submittedBy.toString() !== req.user._id.toString()) {
		res.status(403);
		throw new Error('Not authorized to update this media');
	}

	// Update fields
	if (title !== undefined) media.title = title;
	if (description !== undefined) media.description = description;
	if (order !== undefined) media.order = parseInt(order);
	if (category !== undefined) {
		const validCategories = [
			'screenshot',
			'demo_video',
			'tutorial',
			'feature_highlight',
			'logo',
			'banner',
		];
		if (validCategories.includes(category)) {
			media.category = category;
		}
	}

	await media.save();

	// Clear cache
	const redisClient = getRedisClient();
	await redisClient.del(`tool:${toolId}`);

	res.json(media);
});

// @desc Delete media
// @route DELETE /api/tools/:toolId/media/:mediaId
// @access Private
const deleteMedia = asyncHandler(async (req, res) => {
	const { toolId, mediaId } = req.params;

	const media = await Media.findById(mediaId);
	if (!media) {
		res.status(404);
		throw new Error('Media not found');
	}

	const tool = await Tool.findById(toolId);
	if (!tool || tool.submittedBy.toString() !== req.user._id.toString()) {
		res.status(403);
		throw new Error('Not authorized to delete this media');
	}

	// Delete from Cloudinary
	try {
		if (media.type === 'video') {
			await cloudinary.uploader.destroy(
				media.url.split('/').pop().split('.')[0],
				{
					resource_type: 'video',
				}
			);
		} else {
			await cloudinary.uploader.destroy(
				media.url.split('/').pop().split('.')[0]
			);
		}
	} catch (error) {
		console.error('Error deleting from Cloudinary:', error);
	}

	await media.deleteOne();

	// Update tool media stats
	const mediaStats = await Media.aggregate([
		{ $match: { tool: tool._id, status: 'active' } },
		{
			$group: {
				_id: null,
				totalMedia: { $sum: 1 },
				screenshots: {
					$sum: {
						$cond: [{ $eq: ['$category', 'screenshot'] }, 1, 0],
					},
				},
				videos: {
					$sum: {
						$cond: [{ $eq: ['$type', 'video'] }, 1, 0],
					},
				},
			},
		},
	]);

	const stats =
		mediaStats.length > 0
			? mediaStats[0]
			: { totalMedia: 0, screenshots: 0, videos: 0 };

	await Tool.findByIdAndUpdate(toolId, {
		'mediaStats.totalMedia': stats.totalMedia,
		'mediaStats.screenshots': stats.screenshots,
		'mediaStats.videos': stats.videos,
	});

	// Clear cache
	const redisClient = getRedisClient();
	await redisClient.del(`tool:${toolId}`);
	await redisClient.del('allTools');

	res.json({ message: 'Media deleted successfully' });
});

module.exports = {
	uploadMedia,
	getToolMedia,
	updateMedia,
	deleteMedia,
};
