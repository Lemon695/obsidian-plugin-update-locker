import type { PluginModule } from './types';
import type PluginLockerPlugin from '../main';

/**
 * ModuleManager 核心管理器
 * 负责模块的注册、生命周期控制及状态同步
 */
export class ModuleManager {
	/** 所有已注册的模块，按 ID 索引 */
	private readonly registry: Map<string, PluginModule> = new Map();

	/** 当前已成功加载的模块 ID 集合 */
	private readonly loaded: Set<string> = new Set();

	constructor(private readonly plugin: PluginLockerPlugin) {}

	/** 注册模块，必须在 onload 之前调用 */
	register(module: PluginModule): void {
		if (this.registry.has(module.id)) {
			console.warn(`Module '${module.id}' is already registered.`);
			return;
		}
		this.registry.set(module.id, module);
	}

	/** 加载所有在设置中启用的模块 */
	async loadAll(): Promise<void> {
		for (const [id, module] of this.registry) {
			if (this.isEnabled(id)) {
				await this.loadModule(module);
			}
		}
	}

	/** 卸载所有当前已加载的模块 */
	onunload(): void {
		for (const id of [...this.loaded]) {
			this.unloadModule(id);
		}
	}

	/** 判断模块是否在设置中启用 */
	isEnabled(id: string): boolean {
		const value = this.plugin.settings.moduleEnabled[id];
		// 默认启用（若未定义状态）
		return value !== false;
	}

	/** 返回所有已注册模块（用于设置面板显示） */
	getAll(): PluginModule[] {
		return [...this.registry.values()];
	}

	/** 手动开启模块 */
	async enableModule(id: string): Promise<void> {
		const module = this.registry.get(id);
		if (!module) return;

		this.plugin.settings.moduleEnabled[id] = true;
		await this.plugin.saveSettings();

		if (!this.loaded.has(id)) {
			await this.loadModule(module);
		}
	}

	/** 手动关闭模块 */
	async disableModule(id: string): Promise<void> {
		const module = this.registry.get(id);
		if (!module) return;

		this.plugin.settings.moduleEnabled[id] = false;
		await this.plugin.saveSettings();

		if (this.loaded.has(id)) {
			this.unloadModule(id);
		}
	}

	private async loadModule(module: PluginModule): Promise<void> {
		try {
			await module.onload();
			this.loaded.add(module.id);
			console.debug(`[Locker] Loaded module: ${module.id}`);
		} catch (e) {
			console.error(`[Locker] Failed to load module '${module.id}':`, e);
		}
	}

	private unloadModule(id: string): void {
		const module = this.registry.get(id);
		if (!module || !this.loaded.has(id)) return;

		try {
			module.onunload();
			this.loaded.delete(id);
			console.debug(`[Locker] Unloaded module: ${id}`);
		} catch (e) {
			console.error(`[Locker] Failed to unload module '${id}':`, e);
		}
	}
}
