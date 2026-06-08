export const LOCKER_LOCALES = {
	LOCKER_MODULE_NAME: {
		en: "Locker",
		zh: "插件锁定",
	},
	LOCKER_MODULE_DESC: {
		en: "Prevent specific plugins from being updated by spoofing version numbers.",
		zh: "通过欺骗版本号防止特定插件被更新。",
	},
	SEARCH_PLUGINS: {
		en: "Search plugins",
		zh: "搜索插件",
	},
	SEARCH_PLACEHOLDER: {
		en: "Type to search...",
		zh: "输入以搜索...",
	},
	GROUP_BY_STATUS: {
		en: "Group by status",
		zh: "按状态分组",
	},
	SORT_BY: {
		en: "Sort by",
		zh: "排序方式",
	},
	SORT_NAME: {
		en: "Name",
		zh: "名称",
	},
	SORT_STATUS: {
		en: "Status",
		zh: "状态",
	},
	NO_MATCHING_PLUGINS: {
		en: "No matching plugins found",
		zh: "未找到匹配的插件",
	},
	LOCKED: {
		en: "Locked",
		zh: "已锁定",
	},
	UNLOCKED: {
		en: "Unlocked",
		zh: "未锁定",
	},
	LOCKED_VERSION_DESC: {
		en: "Locked version: {{updatedVersion}} (original: {{originalVersion}})",
		zh: "锁定版本: {{updatedVersion}} (原始版本: {{originalVersion}})",
	},
	CURRENT_VERSION_DESC: {
		en: "Current version: {{version}}",
		zh: "当前版本: {{version}}",
	},
	OPERATION_IN_PROGRESS: {
		en: "Operation in progress, please wait...",
		zh: "操作进行中，请稍候...",
	},
	PLUGIN_LOCKED_ALREADY: {
		en: "Plugin {{pluginId}} version already locked",
		zh: "插件 {{pluginId}} 的版本已被锁定",
	},
	UNLOCKED_NOTICE: {
		en: "Unlocked: {{pluginId}}",
		zh: "已解锁: {{pluginId}}",
	},
	LOCKED_NOTICE: {
		en: "Locked: {{pluginId}}",
		zh: "已锁定: {{pluginId}}",
	},
	FAILED_TOGGLE: {
		en: "Failed to toggle lock for {{pluginId}}",
		zh: "切换 {{pluginId}} 锁定状态失败",
	},
	LOCK_ALL: {
		en: "Lock all visible",
		zh: "全部锁定 (当前可见)",
	},
	UNLOCK_ALL: {
		en: "Unlock all visible",
		zh: "全部解锁 (当前可见)",
	},
	BATCH_COMPLETE: {
		en: "Batch operation complete: {{count}} plugins affected",
		zh: "批量操作完成: {{count}} 个插件受影响",
	},
	CONFLICTS_DETECTED: {
		en: "{{count}} plugin version conflicts detected",
		zh: "检测到 {{count}} 个插件版本号冲突",
	},
	CONFLICT_MISMATCH: {
		en: "Version mismatch: Settings says locked, but file says {{version}}",
		zh: "版本不匹配: 设置显示锁定，但物理文件版本为 {{version}}",
	},
	CONFLICT_ORPHAN: {
		en: "Orphan lock: Version starts with 9999. but not in settings",
		zh: "孤儿锁定: 版本号以 9999. 开头，但不在设置中",
	},
	FIX_CONFLICT: {
		en: "Fix conflict",
		zh: "修复冲突",
	},
	AUTO_CHECK_CONFLICTS: {
		en: "Auto-check conflicts on startup",
		zh: "启动时自动检查冲突",
	},
	MANUAL_SCAN: {
		en: "Manual scan conflicts",
		zh: "手动扫描冲突",
	},
	LOCKED_GROUP_LABEL: {
		en: "Locked ({{count}})",
		zh: "已锁定 ({{count}})",
	},
	UNLOCKED_GROUP_LABEL: {
		en: "Unlocked ({{count}})",
		zh: "未锁定 ({{count}})",
	},
	NEW_RELEASE_AVAILABLE: {
		en: "New release: {{version}}",
		zh: "新版本: {{version}}",
	},
	SNAPSHOT_TOOLTIP: {
		en: "Last snapshot: v{{version}} ({{date}})",
		zh: "最近快照: v{{version}} ({{date}})",
	},
};
