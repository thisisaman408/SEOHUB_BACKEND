const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middlewares/errorMiddleware');

dotenv.config();

(async () => {
	try {
		await connectDB();
		console.log('✅ MongoDB Connected');
	} catch (err) {
		console.error('❌ MongoDB Connection Error:', err.message);
		process.exit(1);
	}
})();

const app = express();

app.use(morgan('dev'));
app.use(express.json());

const corsOptions = {
	origin: [
		'http://localhost:5173',
		'http://localhost:5001',
		'https://seohub-frontend-omega.vercel.app',
	],
	methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
	credentials: true,
	allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

app.get('/', (req, res) => {
	res.send('✅ API is running...');
});

const authRoutes = require('./routes/authRoutes');
const toolRoutes = require('./routes/toolRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
	console.log(`🚀 Server running at http://localhost:${PORT}`);
});
