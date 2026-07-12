import { useEffect, useState } from "react";

/** Measure verse Y positions inside the reader article for aligned margin notes. */
export function useVerseAnchors(articleRef, revision) {
  const [state, setState] = useState({ anchors: {}, height: 0 });

  useEffect(() => {
    const article = articleRef.current;
    if (!article) return;

    const measure = () => {
      const anchors = {};
      const articleTop = article.getBoundingClientRect().top;
      for (const el of article.querySelectorAll(".rd-vtext")) {
        const key = `${el.dataset.ch}:${el.dataset.v}`;
        anchors[key] = el.getBoundingClientRect().top - articleTop;
      }
      setState({ anchors, height: article.offsetHeight });
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(article);
    window.addEventListener("resize", measure);
    document.fonts?.ready?.then(measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [articleRef, revision]);

  return state;
}
