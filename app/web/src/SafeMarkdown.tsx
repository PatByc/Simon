import { useRef, useState, type ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface SafeMarkdownProps {
  children: string;
}

function safeUrlTransform(url: string): string {
  if (url.startsWith("/") || url.startsWith("#")) return url;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
  } catch {
    return "";
  }
  return defaultUrlTransform(url);
}

function CodeBlock({ children }: { children: ReactNode }) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const value = preRef.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(value.replace(/\n$/, ""));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="code-block">
      <button type="button" onClick={() => void copy()} aria-label={copied ? "Code copied" : "Copy code"} title={copied ? "Copied" : "Copy code"}>
        {copied ? "Copied" : "Copy"}
      </button>
      <pre ref={preRef}>{children}</pre>
    </div>
  );
}

export function SafeMarkdown({ children }: SafeMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      urlTransform={safeUrlTransform}
      components={{
        a: ({ href, children: label }) => (
          <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer noopener">
            {label}
          </a>
        ),
        img: ({ alt }) => <span className="blocked-image">[Image blocked{alt ? `: ${alt}` : ""}]</span>,
        pre: ({ children: code }) => <CodeBlock>{code}</CodeBlock>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
