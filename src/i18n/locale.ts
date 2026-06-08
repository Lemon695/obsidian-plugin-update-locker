import { getLanguage } from "obsidian";
import { CORE_LOCALES } from "./core/settings";
import { LOCKER_LOCALES } from "./modules/locker";
import { SNAPSHOT_LOCALES } from "./modules/snapshot";
import { CHANGELOG_LOCALES } from "./modules/changelog";
import { COMPATIBILITY_LOCALES } from "./modules/compatibility";
import { SYNC_LOCALES } from "./modules/sync";

const ALL_LOCALES = {
	...CORE_LOCALES,
	...LOCKER_LOCALES,
	...SNAPSHOT_LOCALES,
	...CHANGELOG_LOCALES,
	...COMPATIBILITY_LOCALES,
	...SYNC_LOCALES,
};

export function t(key: keyof typeof ALL_LOCALES, vars?: Record<string, string>): string {
	const lang = getLanguage();
	const isZh = lang === "zh" || lang === "zh-CN";
	let text = isZh ? ALL_LOCALES[key].zh : ALL_LOCALES[key].en;

	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			text = text.replace(`{{${k}}}`, v);
		}
	}

	return text;
}
