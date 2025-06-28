// models/commentModel.js
const mongoose = require('mongoose');

const commentSchema = mongoose.Schema(
	{
		tool: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			ref: 'Tool',
		},
		user: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			ref: 'User',
		},
		content: {
			type: String,
			required: true,
			maxlength: 1000,
		},
		parentComment: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Comment',
			default: null,
		},
		status: {
			type: String,
			enum: ['approved', 'pending', 'rejected', 'reported'],
			default: 'approved',
		},
		votes: {
			upvotes: {
				type: Number,
				default: 0,
			},
			downvotes: {
				type: Number,
				default: 0,
			},
		},
		reports: [
			{
				reportedBy: {
					type: mongoose.Schema.Types.ObjectId,
					ref: 'User',
				},
				reason: {
					type: String,
					enum: [
						'spam',
						'inappropriate',
						'harassment',
						'misinformation',
						'other',
					],
				},
				description: {
					type: String,
					maxlength: 500,
				},
				reportedAt: {
					type: Date,
					default: Date.now,
				},
			},
		],
		editHistory: [
			{
				content: String,
				editedAt: {
					type: Date,
					default: Date.now,
				},
			},
		],
		isEdited: {
			type: Boolean,
			default: false,
		},
		replyCount: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: true,
	}
);

// Indexes for performance
commentSchema.index({ tool: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ status: 1 });
commentSchema.index({ user: 1 });

const Comment = mongoose.model('Comment', commentSchema);
module.exports = Comment;
