const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/userModel');
const Tool = require('./models/toolModel');
dotenv.config();
const migrateData = async () => {
	try {
		await mongoose.connect(process.env.MONGO_URI);
		console.log('✅ MongoDB Connected for migration.');
		const userUpdateResult = await User.updateMany(
			{ source: { $exists: false } },
			{ $set: { source: 'listed' } }
		);
		console.log(
			`👤 Users updated: ${userUpdateResult.matchedCount} found, ${userUpdateResult.modifiedCount} modified.`
		);
		const toolUpdateResult = await Tool.updateMany(
			{ source: { $exists: false } },
			{ $set: { source: 'listed' } }
		);
		console.log(
			`🛠️  Tools updated: ${toolUpdateResult.matchedCount} found, ${toolUpdateResult.modifiedCount} modified.`
		);

		console.log('✅ Migration complete.');
	} catch (error) {
		console.error('❌ Migration failed:', error);
	} finally {
		await mongoose.disconnect();
		console.log('🔌 MongoDB connection closed.');
	}
};
migrateData();
