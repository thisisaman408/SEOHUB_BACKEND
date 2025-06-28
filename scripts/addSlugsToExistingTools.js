require('dotenv').config();
const mongoose = require('mongoose');
const Tool = require('../models/toolModel');

const generateSlug = (name) => {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9 -]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
};

const addSlugsToExistingTools = async () => {
	try {
		await mongoose.connect(process.env.MONGO_URI);

		const tools = await Tool.find({ slug: { $exists: false } });

		for (const tool of tools) {
			let baseSlug = generateSlug(tool.name);
			let slug = baseSlug;
			let counter = 1;

			while (await Tool.findOne({ slug, _id: { $ne: tool._id } })) {
				slug = `${baseSlug}-${counter}`;
				counter++;
			}

			tool.slug = slug;
			await tool.save();
			console.log(`Added slug "${slug}" to tool "${tool.name}"`);
		}

		console.log('Migration completed successfully');
		process.exit(0);
	} catch (error) {
		console.error('Migration failed:', error);
		process.exit(1);
	}
};

addSlugsToExistingTools();
