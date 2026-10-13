import React from 'react';

interface FormattedMessageProps {
  content: string;
  className?: string;
  isUser?: boolean;
}

export const FormattedMessage: React.FC<FormattedMessageProps> = ({
  content,
  className = '',
  isUser = false,
}) => {
  if (!content) return null;

  // Split by newline to respect paragraphs
  const lines = content.split('\n');

  return (
    <div className={`space-y-1 leading-relaxed ${className}`}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lineIdx} className="h-0.5" />;
        }

        // Check if line is a markdown table separator or row (| :--- | or | Month | Sales |)
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          // If it's a markdown table separator row like | :--- | :--- |, skip
          if (/^\|(\s*[:\-]+\s*\|)+$/.test(trimmed)) {
            return null;
          }
          const cells = trimmed
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());
          return (
            <div
              key={lineIdx}
              className="flex items-center gap-2 py-0.5 text-[11px] text-slate-700 font-mono"
            >
              {cells.map((cell, cIdx) => (
                <span
                  key={cIdx}
                  className={`flex-1 truncate ${
                    cIdx === 0 ? 'font-medium text-slate-800' : 'text-right'
                  }`}
                >
                  <ParseInlineTokens text={cell} isUser={isUser} />
                </span>
              ))}
            </div>
          );
        }

        // Check if line is a bullet item
        const isBullet =
          trimmed.startsWith('* ') ||
          trimmed.startsWith('- ') ||
          trimmed.startsWith('• ');
        const cleanLine = isBullet ? trimmed.replace(/^[\*\-•]\s+/, '') : line;

        if (isBullet) {
          return (
            <div
              key={lineIdx}
              className={`flex items-start gap-1.5 text-[11.5px] pl-0.5 ${
                isUser ? 'text-white' : 'text-slate-700'
              }`}
            >
              <span
                className={`font-bold leading-none mt-1 select-none ${
                  isUser ? 'text-white/80' : 'text-indigo-500'
                }`}
              >
                •
              </span>
              <div className="flex-1">
                <ParseInlineTokens text={cleanLine} isUser={isUser} />
              </div>
            </div>
          );
        }

        return (
          <p
            key={lineIdx}
            className={`text-[11.5px] m-0 ${
              isUser ? 'text-white' : 'text-slate-700'
            }`}
          >
            <ParseInlineTokens text={cleanLine} isUser={isUser} />
          </p>
        );
      })}
    </div>
  );
};

const ParseInlineTokens: React.FC<{ text: string; isUser: boolean }> = ({
  text,
  isUser,
}) => {
  // Regex to match **bold** tokens
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
          return (
            <strong
              key={idx}
              className={`font-bold ${
                isUser ? 'text-white' : 'text-slate-900'
              }`}
            >
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <React.Fragment key={idx}>{part}</React.Fragment>;
      })}
    </>
  );
};
