const express = require('express');
const router = express.Router();
const {
	submitTool,
	updateTool,
	getAllTools,
	getFeaturedTools,
	getToolById,
	getMyTools,
	rateTool,
} = require('../controllers/toolController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadToolLogo } = require('../middlewares/uploadMiddleware');
router.route('/my-tools').get(protect, getMyTools);
router.route('/').post(protect, uploadToolLogo, submitTool).get(getAllTools);
router.route('/featured').get(getFeaturedTools);
router.route('/:id').get(getToolById).put(protect, uploadToolLogo, updateTool);
router.route('/:id/rate').post(protect, rateTool);
module.exports = router;
