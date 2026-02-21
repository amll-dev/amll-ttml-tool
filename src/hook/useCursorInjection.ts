import { useCallback, useEffect, useRef } from 'react';

export const useCursorInjection = () => {
  const lastInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const lastCursorPosRef = useRef<number>(0);

  useEffect(() => {
    const trackInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && target.type !== 'color') {
        lastInputRef.current = target;
        lastCursorPosRef.current = target.selectionStart ?? 0;
      }
    };

    window.addEventListener('mouseup', trackInput);
    window.addEventListener('keyup', trackInput);

    return () => {
      window.removeEventListener('mouseup', trackInput);
      window.removeEventListener('keyup', trackInput);
    };
  }, []);

  const insertAtCursor = useCallback((textToInsert: string) => {
    const input = lastInputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const originalValue = input.value;
    let newValue: string;
    let newCursorPos: number;

    if (end > start && textToInsert.startsWith('#')) {
      const selectedText = originalValue.substring(start, end);
      newValue = originalValue.substring(0, start) + `{${selectedText}${textToInsert}}` + originalValue.substring(end);
      newCursorPos = end + textToInsert.length + 2;
    } else {
      newValue = originalValue.substring(0, start) + textToInsert + originalValue.substring(end);
      newCursorPos = start + textToInsert.length;
    }

    const prototype = input.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, newValue);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  }, []);

  const wrapSelection = useCallback((before: string, after: string) => {
    const input = lastInputRef.current;
    if (!input) return;

    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? start;
    const originalValue = input.value;
    let newValue: string;
    let newCursorPos: number;

    if (start !== end) {
      const selectedText = originalValue.substring(start, end);
      newValue = originalValue.substring(0, start) + before + selectedText + after + originalValue.substring(end);
      newCursorPos = end + before.length + after.length;
    } else {
      newValue = originalValue.substring(0, start) + before + after + originalValue.substring(end);
      newCursorPos = start + before.length;
    }

    const prototype = input.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(input, newValue);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    setTimeout(() => {
      input.focus();
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  }, []);

  return { insertAtCursor, wrapSelection };
};

export default useCursorInjection;