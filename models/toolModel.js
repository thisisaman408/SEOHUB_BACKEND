const mongoose = require('mongoose');

const toolSchema = mongoose.Schema(
	{
		name: { type: String, required: true },
		tagline: { type: String, required: true },
		description: { type: String, required: true },
		websiteUrl: { type: String, required: true },
		tags: [{ type: String }],
		appStoreUrl: { type: String },
		playStoreUrl: { type: String },
		status: {
			type: String,
			enum: ['pending', 'approved', 'rejected'],
			default: 'pending',
		},
		isFeatured: {
			type: Boolean,
			default: false,
		},
		submittedBy: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			ref: 'User',
		},
		logoUrl: { type: String, default: '' },
		visual: {
			type: { type: String },
			color: { type: String },
			content: [
				{
					icon: { type: String },
					text: { type: String },
				},
			],
		},
	},
	{
		timestamps: true,
	}
);

const Tool = mongoose.model('Tool', toolSchema);
module.exports = Tool;
