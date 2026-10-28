import { useEffect } from 'react';

/** Sets the tab title to "<title> · LectureLens" while the component is mounted. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · LectureLens` : 'LectureLens';
    return () => {
      document.title = previous;
    };
  }, [title]);
}
