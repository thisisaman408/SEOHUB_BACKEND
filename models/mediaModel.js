const mongoose = require('mongoose');
const mediaSchema = mongoose.Schema(
	{
		tool: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			ref: 'Tool',
		},
		uploadedBy: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			ref: 'User',
		},
		type: {
			type: String,
			enum: ['image', 'video', 'document'],
			required: true,
		},
		category: {
			type: String,
			enum: [
				'screenshot',
				'demo_video',
				'tutorial',
				'feature_highlight',
				'logo',
				'banner',
			],
			required: true,
		},
		url: {
			type: String,
			required: true,
		},
		thumbnail: {
			type: String,
		},
		title: {
			type: String,
			maxlength: 100,
		},
		description: {
			type: String,
			maxlength: 500,
		},
		order: {
			type: Number,
			default: 0,
		},
		fileSize: {
			type: Number,
		},
		dimensions: {
			width: Number,
			height: Number,
		},
		duration: {
			type: Number,
		},
		status: {
			type: String,
			enum: ['active', 'archived', 'processing'],
			default: 'active',
		},
	},
	{
		timestamps: true,
	}
);

mediaSchema.index({ tool: 1, order: 1 });
mediaSchema.index({ category: 1 });

const Media = mongoose.model('Media', mediaSchema);
module.exports = Media;
