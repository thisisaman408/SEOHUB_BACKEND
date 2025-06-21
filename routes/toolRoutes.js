const express = require('express');
const router = express.Router();
const {
	submitTool,
	getAllTools,
	getFeaturedTools,
	getToolById,
	getMyTools,
} = require('../controllers/toolController');
const { protect } = require('../middlewares/authMiddleware');

router.route('/my-tools').get(protect, getMyTools);

router.route('/').post(protect, submitTool).get(getAllTools);
router.route('/featured').get(getFeaturedTools);
router.route('/:id').get(getToolById);

module.exports = router;
