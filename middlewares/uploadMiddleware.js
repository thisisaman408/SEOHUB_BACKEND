const multer = require('multer');
const { companyLogoStorage, toolLogoStorage } = require('../config/cloudinary');
const uploadCompanyLogo = multer({ storage: companyLogoStorage }).single(
	'companyLogo'
);
const uploadToolLogo = multer({ storage: toolLogoStorage }).single('toolLogo');

module.exports = { uploadCompanyLogo, uploadToolLogo };
