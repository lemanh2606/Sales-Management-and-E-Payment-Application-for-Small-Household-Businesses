// src/utils/debounce.ts
type AnyFn = (...args: any[]) => any;

export type DebouncedFn<T extends AnyFn> = ((...args: Parameters<T>) => void) & {
    cancel: () => void;
    flush: () => void;
};

export default function debounce<T extends AnyFn>(fn: T, wait = 300): DebouncedFn<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;

    const debounced = ((...args: Parameters<T>) => {
        lastArgs = args;

        if (timer) clearTimeout(timer);

        timer = setTimeout(() => {
            timer = null;
            if (lastArgs) fn(...lastArgs);
            lastArgs = null;
        }, wait);
    }) as DebouncedFn<T>;

    debounced.cancel = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        lastArgs = null;
    };

    debounced.flush = () => {
        if (!timer) return;
        clearTimeout(timer);
        timer = null;
        if (lastArgs) fn(...lastArgs);
        lastArgs = null;
    };

    return debounced;
}
