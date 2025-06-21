const express = require('express');
const router = express.Router();
const {
	getAdminStats,
	getPendingTools,
	getApprovedTools,
	getRejectedTools,
	getAllToolsAdmin,
	updateToolStatus,
	deleteTool,
} = require('../controllers/adminController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.route('/stats').get(protect, admin, getAdminStats);
router.route('/tools/pending').get(protect, admin, getPendingTools);
router.route('/tools/approved').get(protect, admin, getApprovedTools);
router.route('/tools/rejected').get(protect, admin, getRejectedTools);
router.route('/tools/all').get(protect, admin, getAllToolsAdmin);

router
	.route('/tools/:id')
	.put(protect, admin, updateToolStatus)
	.delete(protect, admin, deleteTool);

module.exports = router;
