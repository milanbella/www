export function getGlobalThis() {
	if (typeof globalThis !== 'undefined') {
		return globalThis;
	}
	if (typeof self !== 'undefined') {
		return self;
	}
	if (typeof window !== 'undefined') {
		return window;
	}
	if (typeof global !== 'undefined') {
		return global;
	}
	throw new Error('getGlobalThis(): unable to locate global object');
}
