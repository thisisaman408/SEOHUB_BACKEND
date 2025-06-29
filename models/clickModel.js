const mongoose = require('mongoose');
const clickSchema = mongoose.Schema(
	{
		tool: {
			type: mongoose.Schema.Types.ObjectId,
			required: true,
			ref: 'Tool',
		},
		user: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'User',
			default: null,
		},
		sessionId: {
			type: String,
			required: true,
		},
		ipAddress: {
			type: String,
			required: true,
		},
		userAgent: {
			type: String,
			required: true,
		},
		clickType: {
			type: String,
			enum: ['website', 'app_store', 'google_play'],
			default: 'website',
		},
		source: {
			type: String,
			enum: ['direct', 'search', 'referral', 'marketplace'],
			default: 'marketplace',
		},
		country: {
			type: String,
			default: 'Unknown',
		},
	},
	{
		timestamps: true,
	}
);

clickSchema.index({ tool: 1, createdAt: -1 });
clickSchema.index({ sessionId: 1, tool: 1 });

const Click = mongoose.model('Click', clickSchema);
module.exports = Click;
