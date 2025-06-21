const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const companyLogoStorage = new CloudinaryStorage({
	cloudinary,
	params: {
		folder: 'company_logos',
		allowed_formats: ['jpeg', 'png', 'jpg', 'webp'],
	},
});
const toolLogoStorage = new CloudinaryStorage({
	cloudinary,
	params: {
		folder: 'tool_logos',
		allowed_formats: ['jpeg', 'png', 'jpg', 'webp'],
	},
});

module.exports = {
	cloudinary,
	companyLogoStorage,
	toolLogoStorage,
};
