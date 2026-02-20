import { describe, test, expect } from 'vitest';
import { cn } from '$lib/utils';

describe('cn()', () => {
	test('merges multiple class strings', () => {
		expect(cn('foo', 'bar')).toBe('foo bar');
	});

	test('ignores falsy values', () => {
		expect(cn('foo', false, undefined, null, '')).toBe('foo');
	});

	test('deduplicates conflicting tailwind classes (last wins)', () => {
		expect(cn('px-2', 'px-4')).toBe('px-4');
		expect(cn('text-sm', 'text-lg')).toBe('text-lg');
	});

	test('returns empty string with no args', () => {
		expect(cn()).toBe('');
	});

	test('handles conditional object syntax', () => {
		expect(cn('base', { active: true, disabled: false })).toBe('base active');
	});

	test('handles array inputs', () => {
		expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
	});
});
