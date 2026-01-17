import {storage} from '../tools/storage';

export type SwiftDebugEvent = {
	time: number;
	host?: string;
	ruleId?: string;
	ruleHost?: string;
	target?: string;
	action: 'no-rules' | 'no-rule' | 'match' | 'connect' | 'disconnect' | 'skip' | 'error';
	detail?: string;
};

export const swiftDebugItem = storage.item<{value: SwiftDebugEvent}>('swift-debug');
