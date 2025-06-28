const multer = require('multer');
const {
	companyLogoStorage,
	toolLogoStorage,
	toolMediaStorage,
} = require('../config/cloudinary');

const uploadToolSubmission = multer({
	storage: toolMediaStorage,
	limits: { fileSize: 100 * 1024 * 1024, files: 10 },
}).fields([
	{ name: 'toolLogo', maxCount: 1 },
	{ name: 'mediaFiles', maxCount: 10 },
]);

module.exports = {
	uploadCompanyLogo: multer({ storage: companyLogoStorage }).single(
		'companyLogo'
	),
	uploadToolLogo: multer({ storage: toolLogoStorage }).single('toolLogo'),
	uploadToolMedia: multer({
		storage: toolMediaStorage,
		limits: { fileSize: 100 * 1024 * 1024 },
	}).single('media'),
	uploadMultipleToolMedia: multer({
		storage: toolMediaStorage,
		limits: { fileSize: 50 * 1024 * 1024, files: 10 },
	}).array('media', 10),
	uploadToolSubmission,
};
