const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

// Load environment variables
dotenv.config();

// Connect to DB
(async () => {
	try {
		await connectDB(); // Ensure connectDB is async
		console.log('✅ MongoDB Connected');
	} catch (err) {
		console.error('❌ MongoDB Connection Error:', err.message);
		process.exit(1); // Exit if DB fails
	}
})();

// Init express app
const app = express();

// Middleware
app.use(morgan('dev'));
app.use(express.json());

// CORS Setup
const corsOptions = {
	origin: ['http://localhost:5173', 'http://localhost:5001'],
	methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
	credentials: true,
	allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Root route
app.get('/', (req, res) => {
	res.send('✅ API is running...');
});

// Import routes
const authRoutes = require('./routes/authRoutes');
const toolRoutes = require('./routes/toolRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/admin', adminRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
	console.log(`🚀 Server running at http://localhost:${PORT}`);
});
