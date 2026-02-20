// Stub for $app/navigation — replaced by vi.mock() in component tests.
export const goto = async (_url: string): Promise<void> => {};
export const beforeNavigate = (_callback: () => void) => {};
export const afterNavigate = (_callback: () => void) => {};
export const onNavigate = (_callback: () => void) => {};
export const invalidate = async (_url: string): Promise<void> => {};
export const invalidateAll = async (): Promise<void> => {};
export const pushState = (_url: string, _state: unknown): void => {};
export const replaceState = (_url: string, _state: unknown): void => {};
