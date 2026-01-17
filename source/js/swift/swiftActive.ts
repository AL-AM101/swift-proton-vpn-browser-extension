import {storage} from '../tools/storage';
import type {SwiftTargetType} from './swiftRules';

export type SwiftActiveRule = {
	ruleId: string;
	host: string;
	path?: string;
	targetType: SwiftTargetType;
	targetId: string;
	targetLabel: string;
	time: number;
};

export const swiftActiveRuleItem = storage.item<{value: SwiftActiveRule | null}>('swift-active-rule');
