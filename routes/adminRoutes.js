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
	getReportedComments,
	moderateComment,
	getCommentById,
} = require('../controllers/adminController');
const { protect, admin } = require('../middlewares/authMiddleware');

router.use(protect);
router.use(admin);

router.route('/stats').get(getAdminStats);

router.route('/tools/pending').get(getPendingTools);
router.route('/tools/approved').get(getApprovedTools);
router.route('/tools/rejected').get(getRejectedTools);
router.route('/tools/all').get(getAllToolsAdmin);
router.route('/tools/:id').put(updateToolStatus).delete(deleteTool);

router.route('/comments/reported').get(getReportedComments);
router.route('/comments/:commentId/moderate').put(moderateComment);
router.route('/comments/:commentId').get(getCommentById);

module.exports = router;
