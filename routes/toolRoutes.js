// routes/toolRoutes.js
const express = require('express');
const router = express.Router();

const {
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
} = require('../controllers/toolController');

const {
	getComments,
	createComment,
	updateComment,
	deleteComment,
	voteComment,
	reportComment,
} = require('../controllers/commentController');

const {
	uploadMedia,
	getToolMedia,
	updateMedia,
	deleteMedia,
} = require('../controllers/mediaController');

const {
	trackView,
	getToolAnalytics,
} = require('../controllers/viewController');

const { protect } = require('../middlewares/authMiddleware');
const {
	uploadToolLogo,
	uploadToolMedia,
	uploadToolSubmission,
} = require('../middlewares/uploadMiddleware');

// Validation middleware for toolId parameter
const validateToolId = (req, res, next) => {
	const { toolId } = req.params;

	if (!toolId || toolId.trim() === '') {
		return res.status(400).json({
			success: false,
			message: 'Tool ID is required',
		});
	}

	if (!/^[0-9a-fA-F]{24}$/.test(toolId)) {
		return res.status(400).json({
			success: false,
			message: 'Invalid Tool ID format',
		});
	}

	next();
};

// ==================== SEARCH ROUTES (Must be first) ====================
router.route('/search/ai').get(searchToolsWithAI);
router.route('/search/suggestions').get(getSearchSuggestions);

// ==================== BASIC TOOL ROUTES ====================
router.route('/my-tools').get(protect, getMyTools);
router
	.route('/')
	.post(protect, uploadToolSubmission, submitTool)
	.get(getAllTools);
router.route('/featured').get(getFeaturedTools);
router.route('/slug/:slug').get(getToolBySlug);
router.route('/:id').get(getToolById).put(protect, uploadToolLogo, updateTool);
router.route('/:id/rate').post(protect, rateTool);

// ==================== VIEW TRACKING ROUTES ====================
router.route('/:toolId/view').post(validateToolId, trackView);
router
	.route('/:toolId/analytics')
	.get(protect, validateToolId, getToolAnalytics);

// ==================== MEDIA ROUTES ====================
router
	.route('/:toolId/media')
	.get(validateToolId, getToolMedia)
	.post(protect, validateToolId, uploadToolMedia, uploadMedia);

router
	.route('/:toolId/media/:mediaId')
	.put(protect, validateToolId, updateMedia)
	.delete(protect, validateToolId, deleteMedia);

// ==================== COMMENT ROUTES ====================
router
	.route('/:toolId/comments')
	.get(validateToolId, getComments)
	.post(protect, validateToolId, createComment);

router
	.route('/:toolId/comments/:commentId')
	.put(protect, validateToolId, updateComment)
	.delete(protect, validateToolId, deleteComment);

router
	.route('/:toolId/comments/:commentId/vote')
	.post(protect, validateToolId, voteComment);

router
	.route('/:toolId/comments/:commentId/report')
	.post(protect, validateToolId, reportComment);

module.exports = router;
