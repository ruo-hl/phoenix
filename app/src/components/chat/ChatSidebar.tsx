import React, { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { css, keyframes } from "@emotion/react";

import {
  Button,
  Flex,
  Icon,
  Icons,
  Input,
  TextField,
  View,
} from "@phoenix/components";
import { markdownCSS } from "@phoenix/components/markdown/styles";

const slideIn = keyframes`
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(100%);
  }
`;

const sidebarOverlayCSS = css`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 1000;
  &[data-closing="true"] {
    animation: fadeOut 200ms ease-out forwards;
  }
  @keyframes fadeOut {
    to {
      opacity: 0;
    }
  }
`;

const sidebarContainerCSS = css`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  min-width: 350px;
  max-width: 80vw;
  background-color: var(--ac-global-color-grey-50);
  border-left: 1px solid var(--ac-global-color-grey-300);
  z-index: 1001;
  display: flex;
  flex-direction: column;
  animation: ${slideIn} 250ms ease-out;
  &[data-closing="true"] {
    animation: ${slideOut} 200ms ease-out forwards;
  }
`;

const resizeHandleCSS = css`
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  cursor: ew-resize;
  background: transparent;
  z-index: 10;
  &::after {
    content: "";
    position: absolute;
    left: 1px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: transparent;
    transition: background-color 0.2s ease;
  }
  &:hover::after,
  &[data-dragging="true"]::after {
    background-color: var(--ac-global-color-primary);
  }
`;

const sidebarHeaderCSS = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ac-global-dimension-size-150)
    var(--ac-global-dimension-size-200);
  border-bottom: 1px solid var(--ac-global-color-grey-200);
  flex-shrink: 0;
`;

const headerTitleCSS = css`
  display: flex;
  align-items: center;
  gap: var(--ac-global-dimension-size-100);
  font-size: var(--ac-global-font-size-m);
  font-weight: 500;
  color: var(--ac-global-text-color-900);
`;

const headerActionsCSS = css`
  display: flex;
  align-items: center;
  gap: var(--ac-global-dimension-size-50);
`;

const messagesContainerCSS = css`
  flex: 1;
  overflow-y: auto;
  padding: var(--ac-global-dimension-size-200);
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-200);
`;

const messageCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--ac-global-dimension-size-50);
`;

const userMessageCSS = css`
  align-self: flex-end;
  max-width: 85%;
  background-color: var(--ac-global-color-grey-800);
  color: var(--ac-global-color-grey-50);
  padding: var(--ac-global-dimension-size-100)
    var(--ac-global-dimension-size-150);
  border-radius: var(--ac-global-dimension-size-150)
    var(--ac-global-dimension-size-150) 0 var(--ac-global-dimension-size-150);
  font-size: var(--ac-global-font-size-s);
  line-height: var(--ac-global-line-height-s);
`;

const assistantMessageCSS = css`
  align-self: flex-start;
  max-width: 100%;
  color: var(--ac-global-text-color-900);
  font-size: var(--ac-global-font-size-s);
  line-height: var(--ac-global-line-height-m);

  ${markdownCSS}

  p {
    margin: 0 0 var(--ac-global-dimension-size-100) 0;
    &:last-child {
      margin-bottom: 0;
    }
  }

  ul,
  ol {
    margin: var(--ac-global-dimension-size-100) 0;
    padding-left: var(--ac-global-dimension-size-200);
  }

  li {
    margin-bottom: var(--ac-global-dimension-size-50);
  }

  code {
    background-color: var(--ac-global-color-grey-200);
    padding: 2px 6px;
    border-radius: var(--ac-global-dimension-size-50);
    font-family: "Geist Mono", monospace;
    font-size: var(--ac-global-font-size-xs);
  }

  pre {
    background-color: var(--ac-global-color-grey-200);
    padding: var(--ac-global-dimension-size-100);
    border-radius: var(--ac-global-dimension-size-100);
    overflow-x: auto;
    code {
      background: none;
      padding: 0;
    }
  }

  strong {
    font-weight: 600;
  }
`;

const searchIndicatorCSS = css`
  display: flex;
  align-items: center;
  gap: var(--ac-global-dimension-size-100);
  color: var(--ac-global-text-color-500);
  font-size: var(--ac-global-font-size-xs);
  padding: var(--ac-global-dimension-size-50) 0;
`;

const inputContainerCSS = css`
  padding: var(--ac-global-dimension-size-150);
  border-top: 1px solid var(--ac-global-color-grey-200);
  flex-shrink: 0;
`;

const collapsibleSectionCSS = css`
  border: 1px solid var(--ac-global-color-grey-300);
  border-radius: var(--ac-global-dimension-size-100);
  margin: var(--ac-global-dimension-size-100) 0;
  overflow: hidden;
`;

const collapsibleHeaderCSS = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ac-global-dimension-size-100) var(--ac-global-dimension-size-150);
  background-color: var(--ac-global-color-grey-100);
  cursor: pointer;
  user-select: none;
  font-size: var(--ac-global-font-size-xs);
  font-weight: 500;
  color: var(--ac-global-text-color-700);
  &:hover {
    background-color: var(--ac-global-color-grey-200);
  }
`;

const collapsibleContentCSS = css`
  padding: var(--ac-global-dimension-size-100);
  background-color: var(--ac-global-color-grey-50);
  max-height: 400px;
  overflow-y: auto;
`;

const chevronCSS = css`
  transition: transform 0.2s ease;
  &[data-expanded="true"] {
    transform: rotate(90deg);
  }
`;

const inputWrapperCSS = css`
  display: flex;
  align-items: center;
  gap: var(--ac-global-dimension-size-100);
  background-color: var(--ac-global-color-grey-100);
  border: 1px solid var(--ac-global-color-grey-300);
  border-radius: var(--ac-global-dimension-size-150);
  padding: var(--ac-global-dimension-size-50)
    var(--ac-global-dimension-size-100);
`;

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  searchIndicator?: string;
}

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isSending?: boolean;
  onClearChat?: () => void;
}

// Collapsible section for code output
function CollapsibleSection({
  title,
  children,
  defaultExpanded = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div css={collapsibleSectionCSS}>
      <div css={collapsibleHeaderCSS} onClick={() => setIsExpanded(!isExpanded)}>
        <span>{title}</span>
        <span css={chevronCSS} data-expanded={isExpanded}>
          ▶
        </span>
      </div>
      {isExpanded && <div css={collapsibleContentCSS}>{children}</div>}
    </div>
  );
}

// Parse message content to separate analysis from code output
function parseMessageContent(content: string): {
  analysis: string;
  codeOutputs: { title: string; content: string }[];
} {
  const parts = content.split(/---+/);
  const analysis = parts[0]?.trim() || "";
  const codeOutputs: { title: string; content: string }[] = [];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    if (part) {
      // Extract title if it starts with **Title:**
      const titleMatch = part.match(/^\*\*([^*]+)\*\*:?\s*/);
      const title = titleMatch ? titleMatch[1] : `Output ${i}`;
      const outputContent = titleMatch ? part.replace(titleMatch[0], "") : part;
      codeOutputs.push({ title, content: outputContent.trim() });
    }
  }

  return { analysis, codeOutputs };
}

export function ChatSidebar({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isSending = false,
  onClearChat,
}: ChatSidebarProps) {
  const [inputValue, setInputValue] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(500);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen && !isClosing) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, isClosing]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle resize drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      const clampedWidth = Math.max(350, Math.min(newWidth, window.innerWidth * 0.8));
      setSidebarWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 200);
  };

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen && !isClosing) {
    return null;
  }

  // Render message content with collapsible code outputs
  const renderMessageContent = (content: string) => {
    const { analysis, codeOutputs } = parseMessageContent(content);

    return (
      <>
        {analysis && (
          <Markdown remarkPlugins={[remarkGfm]}>
            {analysis}
          </Markdown>
        )}
        {codeOutputs.map((output, index) => (
          <CollapsibleSection
            key={index}
            title={output.title}
            defaultExpanded={false}
          >
            <Markdown remarkPlugins={[remarkGfm]}>
              {output.content}
            </Markdown>
          </CollapsibleSection>
        ))}
      </>
    );
  };

  return (
    <>
      <div
        css={sidebarOverlayCSS}
        data-closing={isClosing}
        onClick={handleClose}
      />
      <div
        ref={sidebarRef}
        css={sidebarContainerCSS}
        style={{ width: sidebarWidth }}
        data-closing={isClosing}
      >
        {/* Resize handle */}
        <div
          css={resizeHandleCSS}
          data-dragging={isDragging}
          onMouseDown={handleMouseDown}
        />

        <div css={sidebarHeaderCSS}>
          <div css={headerTitleCSS}>
            <Icon svg={<Icons.BulbOutline />} />
            <span>Assistant</span>
          </div>
          <div css={headerActionsCSS}>
            {onClearChat && (
              <Button
                size="S"
                variant="quiet"
                onPress={onClearChat}
                aria-label="Clear chat"
                leadingVisual={<Icon svg={<Icons.TrashOutline />} />}
              />
            )}
            <Button
              size="S"
              variant="quiet"
              onPress={handleClose}
              aria-label="Close"
              leadingVisual={<Icon svg={<Icons.CloseOutline />} />}
            />
          </div>
        </div>

        <div css={messagesContainerCSS}>
          {messages.map((message) => (
            <div key={message.id} css={messageCSS}>
              {message.searchIndicator && (
                <div css={searchIndicatorCSS}>
                  <Icon svg={<Icons.SearchOutline />} />
                  <span>{message.searchIndicator}</span>
                </div>
              )}
              {message.role === "user" ? (
                <div css={userMessageCSS}>{message.content}</div>
              ) : (
                <div css={assistantMessageCSS}>
                  {message.content ? (
                    renderMessageContent(message.content)
                  ) : (
                    isSending && (
                      <Flex alignItems="center" gap="size-100">
                        <Icon svg={<Icons.LoadingOutline />} />
                        <span>Analyzing...</span>
                      </Flex>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div css={inputContainerCSS}>
          <div css={inputWrapperCSS}>
            <div css={css`flex: 1;`}>
              <TextField
                size="M"
                value={inputValue}
                onChange={setInputValue}
                onKeyDown={handleKeyDown}
                aria-label="Message input"
                isDisabled={isSending}
              >
                <Input ref={inputRef} placeholder="Ask a question..." />
              </TextField>
            </div>
            <Button
              size="M"
              variant="primary"
              isDisabled={!inputValue.trim() || isSending}
              onPress={handleSend}
              aria-label="Send"
              leadingVisual={<Icon svg={<Icons.PaperPlaneOutline />} />}
            />
          </div>
        </div>
      </div>
    </>
  );
}
