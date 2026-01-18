import {warn} from '../log/log';
import {getTabs} from './getTabs';
type ScriptInjection<Args extends any[], Result> = chrome.scripting.ScriptInjection<Args, Result>;

export const executeOnTab = async <Args extends any[], Result>(
	tabId: number,
	getFuncAndArgs: () => Partial<ScriptInjection<Args, Result>>,
	getCode: () => string,
) => {
	try {
		const chromeApi = globalThis.chrome as typeof chrome | undefined;
		const browserApi = (globalThis as any).browser as typeof chrome | undefined;
		const executeScript = chromeApi?.scripting?.executeScript || browserApi?.scripting?.executeScript;

		await (executeScript ? executeScript(
			{
				target: {tabId, allFrames: true},
				...getFuncAndArgs(),
			} as ScriptInjection<Args, Result>,
		) : getTabs().executeScript?.(tabId, {
			code: getCode(),
		}));
	} catch (e) {
		warn(e);
	}
};
