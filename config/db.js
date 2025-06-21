const mongoose = require('mongoose');
const redis = require('redis');

let redisClient;

const connectDB = async () => {
	try {
		// Connect to MongoDB
		const conn = await mongoose.connect(process.env.MONGO_URI);
		console.log(`MongoDB Connected: ${conn.connection.host}`);

		// Connect to Redis
		redisClient = redis.createClient({
			url: process.env.REDIS_URL,
		});

		redisClient.on('error', (err) => console.log('Redis Client Error', err));

		await redisClient.connect();
		console.log('Redis Connected');
	} catch (error) {
		console.error(`Error: ${error.message}`);
		process.exit(1);
	}
};

const getRedisClient = () => {
	if (!redisClient) {
		throw new Error('Redis client not initialized. Call connectDB first.');
	}
	return redisClient;
};

module.exports = connectDB;
module.exports.getRedisClient = getRedisClient;
