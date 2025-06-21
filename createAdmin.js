const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/userModel');
const connectDB = require('./config/db');

dotenv.config();

const createAdmin = async () => {
	try {
		await connectDB();

		const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
		const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
		const companyName = 'Admin'; // Admin users don't need a real company name

		// Check if the admin user already exists
		const adminExists = await User.findOne({ email: adminEmail });

		if (adminExists) {
			// If user exists, just update the password and role to be safe
			adminExists.password = adminPassword; // The pre-save hook will hash this
			adminExists.role = 'admin';
			await adminExists.save();
			console.log(
				'Admin user already existed. Password has been updated and role ensured.'
			);
		} else {
			// If not, create a new admin user
			await User.create({
				companyName,
				email: adminEmail,
				password: adminPassword,
				role: 'admin',
			});
			console.log('Admin user created successfully!');
		}

		process.exit();
	} catch (error) {
		console.error(`Error creating admin user: ${error.message}`);
		process.exit(1);
	}
};

createAdmin();
