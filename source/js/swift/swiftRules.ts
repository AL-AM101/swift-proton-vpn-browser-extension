import {storage} from '../tools/storage';

export type SwiftTargetType = 'server' | 'country';

export type SwiftRule = {
	id: string;
	host: string;
	path?: string;
	includeSubdomains: boolean;
	enabled?: boolean;
	targetType: SwiftTargetType;
	targetId: string;
	targetLabel: string;
};

export const swiftRulesItem = storage.item<{value: SwiftRule[]}>('swift-rules');
export const swiftEnabledItem = storage.item<{value: boolean}>('swift-enabled');
export const swiftDisconnectOnUnmatchedItem = storage.item<{value: boolean}>('swift-disconnect-on-unmatched');
