const mongoose = require('mongoose');
const generateSlug = (name) => {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9 -]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
};
const toolSchema = mongoose.Schema(
	{
		name: { type: String, required: true },
		slug: {
			type: String,
			unique: true,
			required: true,
			default: function () {
				return 'temp-slug-' + Date.now();
			},
		},
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
		source: {
			type: String,
			enum: ['listed', 'scraped'],
			default: 'listed',
		},
		totalRatingSum: {
			type: Number,
			default: 0,
		},
		numberOfRatings: {
			type: Number,
			default: 0,
		},
		averageRating: {
			type: Number,
			default: 0,
		},
		analytics: {
			totalViews: {
				type: Number,
				default: 0,
			},
			uniqueViews: {
				type: Number,
				default: 0,
			},
			weeklyViews: {
				type: Number,
				default: 0,
			},
			monthlyViews: {
				type: Number,
				default: 0,
			},
			lastViewedAt: {
				type: Date,
			},
		},
		commentStats: {
			totalComments: {
				type: Number,
				default: 0,
			},
			approvedComments: {
				type: Number,
				default: 0,
			},
			lastCommentAt: {
				type: Date,
			},
		},
		mediaStats: {
			totalMedia: {
				type: Number,
				default: 0,
			},
			screenshots: {
				type: Number,
				default: 0,
			},
			videos: {
				type: Number,
				default: 0,
			},
		},
	},
	{
		timestamps: true,
	}
);

toolSchema.path('slug').validate(function (value) {
	return /^[a-z0-9-]+$/.test(value);
}, 'Invalid slug format');

toolSchema.pre('save', async function (next) {
	// Only generate slug if it's a new document or name is modified
	if (this.isNew || this.isModified('name')) {
		let baseSlug = generateSlug(this.name);
		let slug = baseSlug;
		let counter = 1;
		const maxAttempts = 100;
		let attempts = 0;
		let existingTool;
		do {
			existingTool = await this.constructor.findOne({
				slug,
				_id: { $ne: this._id },
			});

			if (existingTool) {
				slug = `${baseSlug}-${counter}`;
				counter++;
				attempts++;
			}
		} while (existingTool && attempts < maxAttempts);

		if (attempts >= maxAttempts) {
			return next(new Error('Could not generate unique slug'));
		}

		this.slug = slug;
	}
	next();
});

toolSchema.index({ slug: 1 });

const Tool = mongoose.model('Tool', toolSchema);
module.exports = Tool;
