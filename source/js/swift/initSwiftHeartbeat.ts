'use background';
import {triggerPromise} from '../tools/triggerPromise';
import {swiftHeartbeatItem} from './swiftHeartbeat';

const HEARTBEAT_ALARM = 'swift-heartbeat';
const HEARTBEAT_INTERVAL_MINUTES = 1;

export const initSwiftHeartbeat = (): void => {
	global.browser || ((global as any).browser = chrome);

	const tick = () => {
		triggerPromise(swiftHeartbeatItem.set({value: {time: Date.now()}}));
	};

	tick();

	if (chrome?.alarms) {
		chrome.alarms.create(HEARTBEAT_ALARM, {periodInMinutes: HEARTBEAT_INTERVAL_MINUTES});
		chrome.alarms.onAlarm.addListener(alarm => {
			if (alarm.name === HEARTBEAT_ALARM) {
				tick();
			}
		});
	} else {
		setInterval(tick, HEARTBEAT_INTERVAL_MINUTES * 60 * 1000);
	}
};
