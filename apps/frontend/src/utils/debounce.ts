/**
 * Debounces a function call by the specified delay in milliseconds.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
    }, delayMs);
  };
}
