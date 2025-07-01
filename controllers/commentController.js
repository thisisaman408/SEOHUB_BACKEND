// controllers/commentController.js
const asyncHandler = require('express-async-handler');
const Comment = require('../models/commentModel');
const CommentVote = require('../models/commentVoteModel');
const Tool = require('../models/toolModel');
const { getRedisClient } = require('../config/db');

// @desc Get comments for a tool
// @route GET /api/tools/:toolId/comments
// @access Public
// @desc Get comments for a tool
// @route GET /api/tools/:toolId/comments
// @access Public
const getComments = asyncHandler(async (req, res) => {
	const { toolId } = req.params;
	const { page = 1, limit = 20, sort = 'newest' } = req.query;

	const redisClient = getRedisClient();
	const cacheKey = `comments:${toolId}:${page}:${limit}:${sort}:${
		req.user?._id || 'anonymous'
	}`;

	// Check cache first
	const cachedComments = await redisClient.get(cacheKey);
	if (cachedComments) {
		return res.json(JSON.parse(cachedComments));
	}

	let sortQuery = {};
	switch (sort) {
		case 'oldest':
			sortQuery = { createdAt: 1 };
			break;
		case 'popular':
			sortQuery = { 'votes.upvotes': -1, createdAt: -1 };
			break;
		default: // newest
			sortQuery = { createdAt: -1 };
	}

	const skip = (page - 1) * limit;

	// ✅ UPDATED QUERY TO EXCLUDE REPORTED COMMENTS FOR PUBLIC
	const commentQuery = {
		tool: toolId,
		parentComment: null,
		status: { $in: ['approved'] }, // Only show approved comments
	};

	// ✅ IF USER IS ADMIN, SHOW ALL COMMENTS INCLUDING REPORTED ONES
	if (req.user && req.user.role === 'admin') {
		commentQuery.status = { $in: ['approved', 'reported'] };
	}

	// Get top-level comments (no parent)
	const comments = await Comment.find(commentQuery)
		.populate('user', 'companyName companyLogoUrl')
		.sort(sortQuery)
		.skip(skip)
		.limit(parseInt(limit));

	// Get replies for each comment (also filter out reported replies for non-admins)
	const commentsWithReplies = await Promise.all(
		comments.map(async (comment) => {
			const replyQuery = {
				parentComment: comment._id,
				status: { $in: ['approved'] },
			};

			if (req.user && req.user.role === 'admin') {
				replyQuery.status = { $in: ['approved', 'reported'] };
			}

			const replies = await Comment.find(replyQuery)
				.populate('user', 'companyName companyLogoUrl')
				.sort({ createdAt: 1 })
				.limit(5);

			// Get user's vote for this comment if logged in
			let userVote = null;
			if (req.user) {
				const vote = await CommentVote.findOne({
					comment: comment._id,
					user: req.user._id,
				});
				if (vote) {
					userVote = vote.voteType;
				}
			}

			// Get user votes for replies if logged in
			const repliesWithVotes = await Promise.all(
				replies.map(async (reply) => {
					let replyUserVote = null;
					if (req.user) {
						const replyVote = await CommentVote.findOne({
							comment: reply._id,
							user: req.user._id,
						});
						if (replyVote) {
							replyUserVote = replyVote.voteType;
						}
					}

					return {
						...reply.toObject(),
						userVote: replyUserVote,
						// ✅ ADD REPORTED STATUS FOR ADMIN
						isReported: reply.reports && reply.reports.length > 0,
						reportCount: reply.reports ? reply.reports.length : 0,
					};
				})
			);

			return {
				...comment.toObject(),
				userVote,
				replies: repliesWithVotes,
				hasMoreReplies: comment.replyCount > 5,
				// ✅ ADD REPORTED STATUS FOR ADMIN
				isReported: comment.reports && comment.reports.length > 0,
				reportCount: comment.reports ? comment.reports.length : 0,
			};
		})
	);

	const totalComments = await Comment.countDocuments({
		tool: toolId,
		parentComment: null,
		status:
			req.user && req.user.role === 'admin'
				? { $in: ['approved', 'reported'] }
				: { $in: ['approved'] },
	});

	const result = {
		comments: commentsWithReplies,
		pagination: {
			currentPage: parseInt(page),
			totalPages: Math.ceil(totalComments / limit),
			totalComments,
			hasNextPage: page < Math.ceil(totalComments / limit),
		},
	};

	// Cache for 2 minutes (shorter cache for user-specific data)
	await redisClient.set(cacheKey, JSON.stringify(result), { EX: 120 });

	res.json(result);
});

// @desc Create a new comment
// @route POST /api/tools/:toolId/comments
// @access Private
const createComment = asyncHandler(async (req, res) => {
	const { toolId } = req.params;
	const { content, parentComment = null } = req.body;

	if (!content || content.trim().length === 0) {
		res.status(400);
		throw new Error('Comment content is required');
	}

	if (content.length > 1000) {
		res.status(400);
		throw new Error('Comment is too long (max 1000 characters)');
	}

	// Verify tool exists
	const tool = await Tool.findById(toolId);
	if (!tool) {
		res.status(404);
		throw new Error('Tool not found');
	}

	// If it's a reply, verify parent comment exists
	if (parentComment) {
		const parent = await Comment.findById(parentComment);
		if (!parent || parent.tool.toString() !== toolId) {
			res.status(400);
			throw new Error('Invalid parent comment');
		}
	}

	// Create comment
	const comment = await Comment.create({
		tool: toolId,
		user: req.user._id,
		content: content.trim(),
		parentComment,
		status: 'approved',
	});

	// Update reply count for parent comment
	if (parentComment) {
		await Comment.findByIdAndUpdate(parentComment, {
			$inc: { replyCount: 1 },
		});
	}

	// Update tool comment stats
	await Tool.findByIdAndUpdate(toolId, {
		$inc: {
			'commentStats.totalComments': 1,
			'commentStats.approvedComments': 1,
		},
		'commentStats.lastCommentAt': new Date(),
	});

	// Clear cache
	const redisClient = getRedisClient();
	const pattern = `comments:${toolId}:*`;
	const keys = await redisClient.keys(pattern);
	if (keys.length > 0) {
		await redisClient.del(keys);
	}

	// Return populated comment
	const populatedComment = await Comment.findById(comment._id).populate(
		'user',
		'companyName companyLogoUrl'
	);

	res.status(201).json(populatedComment);
});

// @desc Update a comment
// @route PUT /api/tools/:toolId/comments/:commentId
// @access Private
const updateComment = asyncHandler(async (req, res) => {
	const { commentId } = req.params;
	const { content } = req.body;

	if (!content || content.trim().length === 0) {
		res.status(400);
		throw new Error('Comment content is required');
	}

	const comment = await Comment.findById(commentId);

	if (!comment) {
		res.status(404);
		throw new Error('Comment not found');
	}

	// Check if user owns the comment
	if (comment.user.toString() !== req.user._id.toString()) {
		res.status(403);
		throw new Error('Not authorized to edit this comment');
	}

	// Check if comment is too old to edit (24 hours)
	const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
	if (comment.createdAt < dayAgo) {
		res.status(403);
		throw new Error('Comment can only be edited within 24 hours');
	}

	// Save edit history
	comment.editHistory.push({
		content: comment.content,
		editedAt: new Date(),
	});

	comment.content = content.trim();
	comment.isEdited = true;

	await comment.save();

	// Clear cache
	const redisClient = getRedisClient();
	const pattern = `comments:${comment.tool}:*`;
	const keys = await redisClient.keys(pattern);
	if (keys.length > 0) {
		await redisClient.del(keys);
	}

	const populatedComment = await Comment.findById(comment._id).populate(
		'user',
		'companyName companyLogoUrl'
	);

	res.json(populatedComment);
});

// @desc Delete a comment
// @route DELETE /api/tools/:toolId/comments/:commentId
// @access Private
const deleteComment = asyncHandler(async (req, res) => {
	const { commentId } = req.params;

	const comment = await Comment.findById(commentId);

	if (!comment) {
		res.status(404);
		throw new Error('Comment not found');
	}

	// Check if user owns the comment or is admin
	if (
		comment.user.toString() !== req.user._id.toString() &&
		req.user.role !== 'admin'
	) {
		res.status(403);
		throw new Error('Not authorized to delete this comment');
	}

	// If comment has replies, just mark as deleted instead of removing
	if (comment.replyCount > 0) {
		comment.content = '[Comment deleted by user]';
		comment.status = 'deleted';
		await comment.save();
	} else {
		// Update parent reply count if it's a reply
		if (comment.parentComment) {
			await Comment.findByIdAndUpdate(comment.parentComment, {
				$inc: { replyCount: -1 },
			});
		}

		await comment.deleteOne();
	}

	// Update tool stats
	await Tool.findByIdAndUpdate(comment.tool, {
		$inc: {
			'commentStats.totalComments': -1,
			'commentStats.approvedComments': -1,
		},
	});

	// Clear cache
	const redisClient = getRedisClient();
	const pattern = `comments:${comment.tool}:*`;
	const keys = await redisClient.keys(pattern);
	if (keys.length > 0) {
		await redisClient.del(keys);
	}

	res.json({ message: 'Comment deleted successfully' });
});

// @desc Vote on a comment
// @route POST /api/tools/:toolId/comments/:commentId/vote
// @access Private
const voteComment = asyncHandler(async (req, res) => {
	const { commentId } = req.params;
	const { voteType } = req.body;

	if (!['upvote', 'downvote'].includes(voteType)) {
		res.status(400);
		throw new Error('Invalid vote type');
	}

	const comment = await Comment.findById(commentId);
	if (!comment) {
		res.status(404);
		throw new Error('Comment not found');
	}

	// Check if user already voted
	const existingVote = await CommentVote.findOne({
		comment: commentId,
		user: req.user._id,
	});

	let action = '';
	let previousVote = null;

	if (existingVote) {
		previousVote = existingVote.voteType;
		if (existingVote.voteType === voteType) {
			// Remove vote
			await existingVote.deleteOne();
			// Update comment vote count
			const updateField =
				voteType === 'upvote' ? 'votes.upvotes' : 'votes.downvotes';
			await Comment.findByIdAndUpdate(commentId, {
				$inc: { [updateField]: -1 },
			});
			action = 'removed';
		} else {
			// Change vote
			const oldVoteField =
				existingVote.voteType === 'upvote'
					? 'votes.upvotes'
					: 'votes.downvotes';
			const newVoteField =
				voteType === 'upvote' ? 'votes.upvotes' : 'votes.downvotes';

			existingVote.voteType = voteType;
			await existingVote.save();

			// Update comment vote counts
			await Comment.findByIdAndUpdate(commentId, {
				$inc: {
					[oldVoteField]: -1,
					[newVoteField]: 1,
				},
			});
			action = 'added';
		}
	} else {
		// Create new vote
		await CommentVote.create({
			comment: commentId,
			user: req.user._id,
			voteType,
		});

		// Update comment vote count
		const updateField =
			voteType === 'upvote' ? 'votes.upvotes' : 'votes.downvotes';
		await Comment.findByIdAndUpdate(commentId, {
			$inc: { [updateField]: 1 },
		});
		action = 'added';
	}

	// Clear cache
	const redisClient = getRedisClient();
	const pattern = `comments:${comment.tool}:*`;
	const keys = await redisClient.keys(pattern);
	if (keys.length > 0) {
		await redisClient.del(keys);
	}

	res.json({
		message: `Vote ${action}`,
		action,
		...(previousVote && { previousVote }),
	});
});

// @desc Report a comment
// @desc Report a comment
// @route POST /api/tools/:toolId/comments/:commentId/report
// @access Private
const reportComment = asyncHandler(async (req, res) => {
	const { commentId } = req.params;
	const { reason, description } = req.body;

	const validReasons = [
		'spam',
		'inappropriate',
		'harassment',
		'misinformation',
		'other',
	];

	if (!validReasons.includes(reason)) {
		res.status(400);
		throw new Error('Invalid report reason');
	}

	const comment = await Comment.findById(commentId);
	if (!comment) {
		res.status(404);
		throw new Error('Comment not found');
	}

	// Check if user already reported this comment
	const alreadyReported = comment.reports.some(
		(report) => report.reportedBy.toString() === req.user._id.toString()
	);

	if (alreadyReported) {
		res.status(400);
		throw new Error('You have already reported this comment');
	}
	comment.reports.push({
		reportedBy: req.user._id,
		reason,
		description: description || '',
		reportedAt: new Date(),
	});

	if (comment.status === 'approved') {
		comment.status = 'reported';
		await Tool.findByIdAndUpdate(comment.tool, {
			$inc: {
				'commentStats.approvedComments': -1,
			},
		});
	}
	await comment.save();
	if (comment.status === 'reported') {
		await Tool.findByIdAndUpdate(comment.tool, {
			$inc: {
				'commentStats.approvedComments': -1,
			},
		});
	}
	const redisClient = getRedisClient();
	const pattern = `comments:${comment.tool}:*`;
	const keys = await redisClient.keys(pattern);
	if (keys.length > 0) {
		await redisClient.del(keys);
	}

	res.json({
		message: 'Comment reported successfully',
		status: comment.status,
	});
});

module.exports = {
	getComments,
	createComment,
	updateComment,
	deleteComment,
	voteComment,
	reportComment,
};
