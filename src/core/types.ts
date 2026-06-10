import { PluginManifest } from 'obsidian';

/**
 * PluginModule 接口规范
 * 每个功能模块必须实现此接口
 */
export interface PluginModule {
	/** 模块唯一 ID */
	id: string;
	/** 模块名称（用于设置面板显示） */
	name: string;
	/** 模块描述 */
	description: string;
	
	/** 插件加载时调用 */
	onload(): Promise<void>;
	/** 插件卸载或模块禁用时调用 */
	onunload(): void;
	
	/** 渲染该模块在设置面板中的专属配置项 */
	renderSettings(containerEl: HTMLElement): void;
}

export interface PluginLockInfo {
	pluginId: string;
	originalVersion: string;
	updatedVersion: string;
}

export interface SnapshotInfo {
	pluginId: string;
	version: string;
	timestamp: number;
}

export enum ConflictType {
	NONE = "NONE",
	VERSION_MISMATCH = "VERSION_MISMATCH",
	ORPHAN_LOCK = "ORPHAN_LOCK",
}

export interface ConflictInfo {
	pluginId: string;
	type: ConflictType;
	actualVersion: string;
	expectedVersion?: string;
}

export interface PluginLockerSettings {
	lockedPlugins: PluginLockInfo[];
	snapshots: SnapshotInfo[];
	autoCheckConflicts: boolean;
	/** 记录每个模块的开启/关闭状态 */
	moduleEnabled: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: PluginLockerSettings = {
	lockedPlugins: [],
	snapshots: [],
	autoCheckConflicts: true,
	moduleEnabled: {
		"locker": true,
		"snapshot": true
	},
};

export interface PluginSystem {
	manifests: Record<string, PluginManifest>;
}

declare module 'obsidian' {
	interface App {
		plugins: PluginSystem;
		version: string;
	}
	export function getLanguage(): string;
}
