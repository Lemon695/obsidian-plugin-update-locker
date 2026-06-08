import type { PluginModule } from '../../core/types';
import type PluginLockerPlugin from '../../main';
import { t } from '../../i18n/locale';

export class CompatibilityModule implements PluginModule {
	id = 'compatibility';
	name = t('COMPATIBILITY_MODULE_NAME');
	description = t('COMPATIBILITY_MODULE_DESC');

	constructor(private readonly plugin: PluginLockerPlugin) {}

	async onload(): Promise<void> {}
	onunload(): void {}

	/**
	 * 比较版本号 (v1 >= v2)
	 */
	isVersionGreaterOrEqual(v1: string, v2: string): boolean {
		const parts1 = v1.split('.').map(Number);
		const parts2 = v2.split('.').map(Number);
		for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
			const n1 = parts1[i] || 0;
			const n2 = parts2[i] || 0;
			if (n1 > n2) return true;
			if (n1 < n2) return false;
		}
		return true;
	}

	checkCompatibility(minAppVersion?: string): { compatible: boolean, current: string } {
		const currentVersion = this.plugin.app.version || '0.0.0';
		if (!minAppVersion) return { compatible: true, current: currentVersion };
		
		const isCompatible = this.isVersionGreaterOrEqual(currentVersion, minAppVersion);
		return { compatible: isCompatible, current: currentVersion };
	}

	renderSettings(containerEl: HTMLElement): void {
		containerEl.createEl('p', { text: this.description });
	}
}
