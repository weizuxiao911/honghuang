import React, { useMemo } from 'react';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: false,
});

const RENDERER = new marked.Renderer();
const originalLink = RENDERER.link.bind(RENDERER);
RENDERER.link = function (href: any, title: any, text: any) {
  const h = typeof href === 'string' ? href : (href as any)?.href;
  const t = typeof title === 'string' ? title : (title as any)?.title;
  const out = originalLink.call(this, href, title, text);
  if (typeof h === 'string' && !/^(https?:|mailto:|#)/i.test(h)) return out;
  return out.replace(/^<a /, `<a target="_blank" rel="noreferrer noopener" ${t ? `title="${t}" ` : ''}`);
};

export const Markdown: React.FC<{ content: string; streaming?: boolean }> = ({ content, streaming }) => {
  const html = useMemo(() => {
    try {
      return marked.parse(content || '', { renderer: RENDERER, async: false }) as string;
    } catch {
      return String(content || '');
    }
  }, [content]);

  return (
    <div
      className={`tc-md${streaming ? ' tc-md--streaming' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
