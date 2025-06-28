const mongoose = require('mongoose');

const commentVoteSchema = mongoose.Schema(
	{
		comment: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			ref: 'Comment',
		},
		user: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			ref: 'User',
		},
		voteType: {
			type: String,
			enum: ['upvote', 'downvote'],
			required: true,
		},
	},
	{
		timestamps: true,
	}
);
commentVoteSchema.index({ comment: 1, user: 1 }, { unique: true });

const CommentVote = mongoose.model('CommentVote', commentVoteSchema);
module.exports = CommentVote;
