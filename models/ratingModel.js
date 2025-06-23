const mongoose = require('mongoose');
const ratingSchema = mongoose.Schema(
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
		rating: {
			type: Number,
			required: true,
			min: 1,
			max: 5,
		},
	},
	{
		timestamps: true,
	}
);
ratingSchema.index({ tool: 1, user: 1 }, { unique: true });
const Rating = mongoose.model('Rating', ratingSchema);
module.exports = Rating;
