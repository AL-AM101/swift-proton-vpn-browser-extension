import {
	buildSwiftHostLabel,
	getSwiftUrlParts,
	matchSwiftRule,
	normalizeSwiftPath,
	parseSwiftUrlInput,
	selectSwiftRule,
} from '../swiftRuleMatching';
import type {SwiftRule} from '../swiftRules';

describe('swiftRuleMatching', () => {
	test('normalizeSwiftPath handles root and prefixes', () => {
		expect(normalizeSwiftPath('/')).toBeUndefined();
		expect(normalizeSwiftPath('docs')).toBe('/docs');
		expect(normalizeSwiftPath('/docs')).toBe('/docs');
		expect(normalizeSwiftPath('')).toBeUndefined();
	});

	test('parseSwiftUrlInput extracts host and optional path', () => {
		expect(parseSwiftUrlInput('example.com/docs')).toEqual({host: 'example.com', path: '/docs'});
		expect(parseSwiftUrlInput('https://www.Example.com/')).toEqual({host: 'example.com', path: undefined});
	});

	test('getSwiftUrlParts preserves root path', () => {
		expect(getSwiftUrlParts('https://www.example.com')).toEqual({host: 'example.com', path: '/'});
	});

	test('matchSwiftRule respects subdomains and path prefix', () => {
		const exactRule: SwiftRule = {
			id: '1',
			host: 'example.com',
			includeSubdomains: false,
			targetType: 'server',
			targetId: '1',
			targetLabel: 'S1',
		};
		const wildcardRule: SwiftRule = {
			id: '2',
			host: 'example.com',
			includeSubdomains: true,
			targetType: 'server',
			targetId: '2',
			targetLabel: 'S2',
		};
		const pathRule: SwiftRule = {
			id: '3',
			host: 'example.com',
			path: '/docs',
			includeSubdomains: false,
			targetType: 'server',
			targetId: '3',
			targetLabel: 'S3',
		};

		expect(matchSwiftRule({host: 'example.com', path: '/'}, exactRule)).toBe(true);
		expect(matchSwiftRule({host: 'sub.example.com', path: '/'}, exactRule)).toBe(false);
		expect(matchSwiftRule({host: 'sub.example.com', path: '/docs'}, wildcardRule)).toBe(true);
		expect(matchSwiftRule({host: 'example.com', path: '/docs/intro'}, pathRule)).toBe(true);
		expect(matchSwiftRule({host: 'example.com', path: '/blog'}, pathRule)).toBe(false);
	});

	test('selectSwiftRule uses order and supports tab switches', () => {
		const rules: SwiftRule[] = [
			{
				id: 'base',
				host: 'example.com',
				includeSubdomains: false,
				targetType: 'server',
				targetId: '1',
				targetLabel: 'S1',
			},
			{
				id: 'docs',
				host: 'example.com',
				path: '/docs',
				includeSubdomains: false,
				targetType: 'server',
				targetId: '2',
				targetLabel: 'S2',
			},
		];

		const first = selectSwiftRule(rules, getSwiftUrlParts('https://example.com/docs')!);
		expect(first.matchingRules).toHaveLength(2);
		expect(first.rule?.id).toBe('base');

		const none = selectSwiftRule(rules, getSwiftUrlParts('https://other.com')!);
		expect(none.rule).toBeUndefined();

		const again = selectSwiftRule(rules, getSwiftUrlParts('https://example.com/docs')!);
		expect(again.rule?.id).toBe('base');
	});

	test('buildSwiftHostLabel hides root path', () => {
		expect(buildSwiftHostLabel('example.com')).toBe('example.com');
		expect(buildSwiftHostLabel('example.com', '/docs')).toBe('example.com/docs');
	});
});
