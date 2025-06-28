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

const toolMediaStorage = new CloudinaryStorage({
	cloudinary,
	params: (req, file) => {
		const folder = `tool_media/${req.params.toolId || 'general'}`;

		if (file.mimetype.startsWith('video/')) {
			return {
				folder: folder,
				resource_type: 'video',
				allowed_formats: ['mp4', 'mov', 'avi', 'mkv'],
				transformation: [{ quality: 'auto', fetch_format: 'auto' }],
			};
		} else {
			return {
				folder: folder,
				allowed_formats: ['jpeg', 'png', 'jpg', 'webp', 'gif'],
				transformation: [
					{ quality: 'auto', fetch_format: 'auto', width: 1920, crop: 'limit' },
				],
			};
		}
	},
});

module.exports = {
	cloudinary,
	companyLogoStorage,
	toolLogoStorage,
	toolMediaStorage,
};
