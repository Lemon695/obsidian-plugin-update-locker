import { App, PluginSettingTab, Setting } from 'obsidian';
import type PluginLockerPlugin from '../main';

/**
 * 动态设置面板
 * 能够自动遍历 ModuleManager 中的模块并渲染其开关和专属设置
 */
export class PluginLockerSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: PluginLockerPlugin) {
		super(app, plugin);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 遍历所有已注册模块
		for (const module of this.plugin.moduleManager.getAll()) {
			// 模块主开关
			new Setting(containerEl)
				.setName(module.name)
				.setDesc(module.description)
				.setHeading()
				.addToggle(toggle => {
					toggle
						.setValue(this.plugin.moduleManager.isEnabled(module.id))
						.onChange(async (value) => {
							if (value) {
								await this.plugin.moduleManager.enableModule(module.id);
							} else {
								await this.plugin.moduleManager.disableModule(module.id);
							}
							// 刷新面板以显示/隐藏子设置项
							// eslint-disable-next-line @typescript-eslint/no-deprecated
						this.display();
						});
				});

			// 若模块已启用，渲染其子设置项
			if (this.plugin.moduleManager.isEnabled(module.id)) {
				const moduleContainer = containerEl.createDiv({ cls: 'pul-module-settings' });
				module.renderSettings(moduleContainer);
			}
		}
	}
}
