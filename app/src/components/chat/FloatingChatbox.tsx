import React, { useCallback, useEffect, useState } from "react";
import { css } from "@emotion/react";

import {
  Button,
  Icon,
  Icons,
  Input,
  TextField,
} from "@phoenix/components";

import { ChatMessage, ChatSidebar } from "./ChatSidebar";

const floatingChatboxContainerCSS = css`
  position: fixed;
  bottom: var(--ac-global-dimension-size-300);
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  width: 100%;
  max-width: 500px;
  padding: 0 var(--ac-global-dimension-size-200);
  box-sizing: border-box;
`;

const floatingChatboxCSS = css`
  background-color: var(--ac-global-color-grey-50);
  border: 1px solid var(--ac-global-color-grey-300);
  border-radius: var(--ac-global-dimension-size-150);
  box-shadow: var(--px-overlay-box-shadow);
  padding: var(--ac-global-dimension-size-100);
  display: flex;
  align-items: center;
  gap: var(--ac-global-dimension-size-100);
  cursor: pointer;
  transition: box-shadow 0.2s ease;
  &:hover {
    box-shadow: 0px 12px 24px var(--px-overlay-shadow-color);
  }
`;

const inputWrapperCSS = css`
  flex: 1;
  position: relative;
`;

const keyboardShortcutCSS = css`
  position: absolute;
  right: var(--ac-global-dimension-size-100);
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: var(--ac-global-dimension-size-50);
  color: var(--ac-global-text-color-500);
  font-size: var(--ac-global-font-size-xs);
  pointer-events: none;
`;

const keyCSS = css`
  background-color: var(--ac-global-color-grey-200);
  border: 1px solid var(--ac-global-color-grey-300);
  border-radius: var(--ac-global-dimension-size-50);
  padding: 2px 6px;
  font-size: 11px;
  font-family: inherit;
`;

interface FloatingChatboxProps {
  onSendMessage?: (message: string) => Promise<string> | string;
  placeholder?: string;
  isVisible?: boolean;
}

export function FloatingChatbox({
  onSendMessage,
  placeholder = "Ask a question...",
  isVisible = true,
}: FloatingChatboxProps) {
  const [message, setMessage] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const handleOpenSidebar = () => {
    setIsSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleSendMessage = useCallback(
    async (text: string) => {
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setMessage("");
      setIsSending(true);

      try {
        let response: string;
        if (onSendMessage) {
          const result = onSendMessage(text);
          response =
            result instanceof Promise ? await result : result;
        } else {
          // Demo response if no handler provided
          await new Promise((resolve) => setTimeout(resolve, 1000));
          response = `You asked: "${text}"\n\nThis is a demo response. Connect an AI backend to get real answers.`;
        }

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response,
          timestamp: new Date(),
          searchIndicator: text.includes("?")
            ? `Found results for ${text.split(" ").slice(0, 3).join(" ")}`
            : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "Sorry, there was an error processing your request.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsSending(false);
      }
    },
    [onSendMessage]
  );

  const handleSend = () => {
    if (message.trim()) {
      handleOpenSidebar();
      handleSendMessage(message.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputFocus = () => {
    handleOpenSidebar();
  };

  // Keyboard shortcut to open sidebar (Cmd+I / Ctrl+I)
  useEffect(() => {
    const handleKeyboardShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        handleOpenSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () => window.removeEventListener("keydown", handleKeyboardShortcut);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <>
      {!isSidebarOpen && (
        <div css={floatingChatboxContainerCSS}>
          <div css={floatingChatboxCSS} onClick={handleInputFocus}>
            <div css={inputWrapperCSS}>
              <TextField
                size="M"
                value={message}
                onChange={setMessage}
                onKeyDown={handleKeyDown}
                aria-label="Chat input"
                onFocus={handleInputFocus}
              >
                <Input placeholder={placeholder} />
              </TextField>
              {!message && (
                <div css={keyboardShortcutCSS}>
                  <span css={keyCSS}>⌘I</span>
                </div>
              )}
            </div>
            <Button
              size="M"
              variant="primary"
              isDisabled={!message.trim()}
              onPress={handleSend}
              aria-label="Send"
              leadingVisual={<Icon svg={<Icons.PaperPlaneOutline />} />}
            />
          </div>
        </div>
      )}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
        messages={messages}
        onSendMessage={handleSendMessage}
        isSending={isSending}
        onClearChat={handleClearChat}
      />
    </>
  );
}
