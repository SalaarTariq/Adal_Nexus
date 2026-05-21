'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  content: string;
  className?: string;
}

// Defaults to safe rendering: react-markdown does not allow raw HTML by default
// (no rehype-raw plugin), so user-provided <script> / onclick attributes are
// stripped automatically. We keep GFM for tables, task lists, strikethrough.
export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        'prose prose-sm max-w-none text-gray-700',
        'prose-headings:font-serif prose-headings:text-gray-900',
        'prose-a:text-indigo-600 hover:prose-a:underline',
        'prose-code:rounded prose-code:bg-gray-100 prose-code:px-1 prose-code:py-0.5',
        'prose-pre:bg-gray-900 prose-pre:text-gray-100',
        'prose-blockquote:border-l-indigo-300 prose-blockquote:text-gray-600',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => (
            <a {...props} target="_blank" rel="noopener noreferrer nofollow ugc" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
