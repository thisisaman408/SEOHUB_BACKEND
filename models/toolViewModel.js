const mongoose = require('mongoose');

const toolViewSchema = mongoose.Schema(
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
		viewDuration: {
			type: Number,
			default: 0,
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

toolViewSchema.index({ tool: 1, createdAt: -1 });
toolViewSchema.index({ sessionId: 1, tool: 1 }, { unique: true });
toolViewSchema.index({ user: 1, tool: 1 });

const ToolView = mongoose.model('ToolView', toolViewSchema);
module.exports = ToolView;
