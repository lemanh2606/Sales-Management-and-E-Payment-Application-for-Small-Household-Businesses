// controllers/activityLogController.js
const mongoose = require("mongoose");
const ActivityLog = require("../models/ActivityLog");
const User = require("../models/User");
const Store = require("../models/Store");
const logActivity = require("../utils/logActivity");

/**
 * 1️⃣ GET /api/activity-logs - Lấy danh sách log với filter, sort, pagination
 * Query: userName, action, entity, entityId, fromDate, toDate, keyword, page, limit, sort
 */
const getActivityLogs = async (req, res) => {
  try {
    const {
      userName,
      action,
      entity,
      entityId,
      fromDate,
      toDate,
      keyword,
      page = 1,
      limit = 20,
      sort = "-createdAt",
      storeId,
    } = req.query;

    const currentPage = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (currentPage - 1) * pageSize;

    console.log("QUERY PARAMS:", req.query);
    console.log("MATCH OBJECT:", { action, entity, storeId });

    const match = {};

    // 🔥 FIX LOGIN AUTH LOGIC – ƯU TIÊN HÀNG ĐẦU
    if (action === "auth" && entity === "Store") {
      match.action = "auth";
      match.entity = "Store";

      if (storeId) {
        match.$or = [
          { store: new mongoose.Types.ObjectId(storeId) },
          { entityId: new mongoose.Types.ObjectId(storeId) },
        ];
      }
    } else {
      // 🔥 Chỉ chạy khi KHÔNG phải log login
      if (action) match.action = action;
      if (entity) match.entity = entity;
      if (entityId) match.entityId = new mongoose.Types.ObjectId(entityId);

      if (storeId) {
        match.store = new mongoose.Types.ObjectId(storeId);
      }
    }

    // User filter
    if (userName) match.userName = { $regex: userName, $options: "i" };

    // 🔥 DATE RANGE (chuẩn)
    if (fromDate || toDate) {
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);

      match.createdAt = {
        $gte: start,
        $lte: end,
      };
    }

    // 🔥 KEYWORD KHÔNG ĐƯỢC GHI ĐÈ OR
    if (keyword) {
      const keywordConditions = [
        { description: { $regex: keyword, $options: "i" } },
        { entityName: { $regex: keyword, $options: "i" } },
        { userName: { $regex: keyword, $options: "i" } },
      ];

      if (match.$or) {
        // Kết hợp $or hiện tại với keyword search bằng $and
        match.$and = [{ $or: match.$or }, { $or: keywordConditions }];
        delete match.$or;
      } else {
        match.$or = keywordConditions;
      }
    }

    // 🚀 TỐI ƯU: Dùng $facet để chạy count và data song song
    const pipeline = [
      { $match: match },
      {
        $facet: {
          // Đếm tổng số (không cần lookup ở đây)
          metadata: [{ $count: "total" }],

          // Lấy data với pagination
          data: [
            { $sort: { createdAt: sort === "-createdAt" ? -1 : 1 } },
            { $skip: skip },
            { $limit: pageSize },

            // Lookup chỉ cho data cần thiết
            {
              $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userDetail",
                pipeline: [
                  { $project: { fullname: 1, email: 1, role: 1, image: 1 } },
                ],
              },
            },
            {
              $lookup: {
                from: "stores",
                localField: "store",
                foreignField: "_id",
                as: "storeDetail",
                pipeline: [{ $project: { name: 1 } }],
              },
            },
            {
              $unwind: {
                path: "$userDetail",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: "$storeDetail",
                preserveNullAndEmptyArrays: true,
              },
            },

            {
              $project: {
                _id: 1,
                userName: 1,
                userRole: 1,
                action: 1,
                entity: 1,
                entityId: 1,
                entityName: 1,
                description: 1,
                ip: 1,
                userAgent: 1,
                createdAt: 1,
                "userDetail.fullname": 1,
                "userDetail.image": 1,
                "userDetail.email": 1,
                "userDetail.role": 1,
                "storeDetail.name": 1,
              },
            },
          ],
        },
      },
    ];

    const result = await ActivityLog.aggregate(pipeline);

    const totalCount = result[0]?.metadata[0]?.total || 0;
    const logs = result[0]?.data || [];

    // Thêm phần log login để check xem nhân viên có đi làm không, có dùng máy ở quán không hay gian lận
    const enrichedLogs = logs.map((log) => {
      const isLogin = log.action === "auth" && log.entity === "Store";
      //"Máy này đang ở trong quán (IP nội bộ) hay là login từ nhà (IP public)"
      const isStoreIP =
        log.ip &&
        ["192.168.", "10.0.", "172.16."].some((prefix) =>
          log.ip.startsWith(prefix)
        );

      return {
        ...log,
        _id: log._id,
        time: new Date(log.createdAt).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        date: new Date(log.createdAt).toLocaleDateString("vi-VN"),
        actionText: isLogin ? "Vào ca làm" : log.action,
        badge: isLogin ? (isStoreIP ? "success" : "warning") : "info",
        badgeText: isLogin ? (isStoreIP ? "Máy quán" : "Từ nhà") : "",
        icon: isLogin ? "login" : "edit",
      };
    });

    // 📱 Response format tương thích với cả Ant Design Table và React Native FlatList
    res.json({
      success: true,
      message: "Lấy danh sách nhật ký thành công",
      data: enrichedLogs, // FlatList dùng trực tiếp
      pagination: {
        current: currentPage,
        pageSize: pageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasMore: currentPage * pageSize < totalCount, // Cho infinite scroll
      },
    });
  } catch (err) {
    console.error("Lỗi getActivityLogs:", err);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy nhật ký",
    });
  }
};

/**
 * 2️⃣ GET /api/activity-logs/:id - Chi tiết 1 log
 */
const getActivityLogDetail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "ID không hợp lệ" });
    }

    const log = await ActivityLog.findById(id)
      .populate("user", "fullName email role")
      .populate("store", "name")
      .lean();

    if (!log) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy nhật ký" });
    }

    res.json({
      success: true,
      message: "Lấy chi tiết nhật ký thành công",
      data: log,
    });
  } catch (err) {
    console.error("Lỗi getActivityLogDetail:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi lấy chi tiết" });
  }
};

/**
 * 3️⃣ GET /api/activity-logs/user/:userId - Log của 1 user cụ thể
 */
const getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { storeId, page = 1, limit = 20, sort = "-createdAt" } = req.query;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "User ID không hợp lệ" });
    }

    // Kiểm tra quyền: chỉ manager hoặc chính user đó mới xem được
    if (req.user._id.toString() !== userId && req.user.role !== "MANAGER") {
      return res.status(403).json({
        success: false,
        message: "Không có quyền xem nhật ký người khác",
      });
    }

    const match = { user: new mongoose.Types.ObjectId(userId) };
    if (storeId) match.store = new mongoose.Types.ObjectId(storeId);

    const currentPage = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (currentPage - 1) * pageSize;

    // 🚀 Dùng $facet để tối ưu
    const pipeline = [
      { $match: match },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { createdAt: sort === "-createdAt" ? -1 : 1 } },
            { $skip: skip },
            { $limit: pageSize },
            {
              $lookup: {
                from: "stores",
                localField: "store",
                foreignField: "_id",
                as: "storeDetail",
                pipeline: [{ $project: { name: 1 } }],
              },
            },
            {
              $unwind: {
                path: "$storeDetail",
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
    ];

    const result = await ActivityLog.aggregate(pipeline);
    const total = result[0]?.metadata[0]?.total || 0;
    const logs = result[0]?.data || [];

    res.json({
      success: true,
      message: "Lấy nhật ký user thành công",
      data: logs,
      pagination: {
        current: currentPage,
        pageSize: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        hasMore: currentPage * pageSize < total,
      },
    });
  } catch (err) {
    console.error("Lỗi getUserActivity:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi lấy nhật ký user" });
  }
};

/**
 * 4️⃣ GET /api/activity-logs/entity/:entity - Lịch sử thay đổi của 1 entity nào đó
 */
const getEntityActivity = async (req, res) => {
  try {
    const { entity } = req.params;
    const {
      page = 1,
      limit = 20,
      sort = "-createdAt",
      storeId,
      action, // optional: create/update/delete
      userId, // optional: lọc theo người dùng
    } = req.query;

    const filter = { entity };
    if (storeId) filter.store = new mongoose.Types.ObjectId(storeId);
    if (action) filter.action = action;
    if (userId) filter.user = new mongoose.Types.ObjectId(userId);

    const currentPage = parseInt(page);
    const pageSize = parseInt(limit);
    const skip = (currentPage - 1) * pageSize;

    // 🚀 Dùng $facet để tối ưu
    const pipeline = [
      { $match: filter },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { createdAt: sort === "-createdAt" ? -1 : 1 } },
            { $skip: skip },
            { $limit: pageSize },
            {
              $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "userDetail",
                pipeline: [{ $project: { fullName: 1, email: 1, role: 1 } }],
              },
            },
            {
              $lookup: {
                from: "stores",
                localField: "store",
                foreignField: "_id",
                as: "storeDetail",
                pipeline: [{ $project: { name: 1 } }],
              },
            },
            {
              $unwind: {
                path: "$userDetail",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $unwind: {
                path: "$storeDetail",
                preserveNullAndEmptyArrays: true,
              },
            },
          ],
        },
      },
    ];

    const result = await ActivityLog.aggregate(pipeline);
    const total = result[0]?.metadata[0]?.total || 0;
    const logs = result[0]?.data || [];

    res.status(200).json({
      success: true,
      message: `Lấy toàn bộ log của entity "${entity}" thành công`,
      data: logs,
      pagination: {
        total,
        current: currentPage,
        pageSize: pageSize,
        totalPages: Math.ceil(total / pageSize),
        hasMore: currentPage * pageSize < total,
      },
    });
  } catch (error) {
    console.error("Lỗi getLogsByEntity:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi lấy log theo entity",
    });
  }
};

/**
 * 5️⃣ GET /api/activity-logs/stats - Thống kê nhanh
 * Query: dateFrom, dateTo, storeId
 */
const getActivityStats = async (req, res) => {
  try {
    const { dateFrom, dateTo, storeId } = req.query;

    const match = {};
    if (dateFrom)
      match.createdAt = { ...match.createdAt, $gte: new Date(dateFrom) };
    if (dateTo)
      match.createdAt = { ...match.createdAt, $lte: new Date(dateTo) };
    if (storeId) match.store = new mongoose.Types.ObjectId(storeId);

    // Thống kê cơ bản
    const stats = await ActivityLog.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          byAction: { $push: "$action" },
          byEntity: { $push: "$entity" },
          byUser: { $addToSet: "$userName" },
        },
      },
      {
        $project: {
          totalLogs: 1,
          byAction: { $ifNull: ["$byAction", []] },
          byEntity: { $ifNull: ["$byEntity", []] },
          byUser: { $ifNull: ["$byUser", []] },
        },
      },
      {
        $addFields: {
          uniqueUsers: { $size: "$byUser" },
          actionCounts: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: ["$byAction", []] },
                as: "action",
                in: {
                  k: "$$action",
                  v: {
                    $size: {
                      $filter: {
                        input: "$byAction",
                        as: "a",
                        cond: { $eq: ["$$a", "$$action"] },
                      },
                    },
                  },
                },
              },
            },
          },
          entityCounts: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: ["$byEntity", []] },
                as: "ent",
                in: {
                  k: "$$ent",
                  v: {
                    $size: {
                      $filter: {
                        input: "$byEntity",
                        as: "e",
                        cond: { $eq: ["$$e", "$$ent"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    ]);

    const recentLogs = await ActivityLog.find(match)
      .populate("user", "fullName")
      .populate("store", "name")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    res.json({
      success: true,
      message: "Thống kê nhật ký thành công",
      data: {
        stats: stats[0] || { totalLogs: 0, uniqueUsers: 0 },
        recentLogs,
      },
    });
  } catch (err) {
    console.error("Lỗi getActivityStats:", err);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server khi lấy thống kê" });
  }
};

module.exports = {
  getActivityLogs,
  getActivityLogDetail,
  getUserActivity,
  getEntityActivity,
  getActivityStats,
};
