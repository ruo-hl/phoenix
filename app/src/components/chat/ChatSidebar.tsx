import React, { useEffect, useRef, useState } from "react";
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
  width: 450px;
  max-width: 100vw;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  return (
    <>
      <div
        css={sidebarOverlayCSS}
        data-closing={isClosing}
        onClick={handleClose}
      />
      <div css={sidebarContainerCSS} data-closing={isClosing}>
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
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                  </Markdown>
                </div>
              )}
            </div>
          ))}
          {isSending && (
            <div css={messageCSS}>
              <div css={assistantMessageCSS}>
                <Flex alignItems="center" gap="size-100">
                  <Icon svg={<Icons.LoadingOutline />} />
                  <span>Thinking...</span>
                </Flex>
              </div>
            </div>
          )}
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
                <Input placeholder="Ask a question..." />
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
