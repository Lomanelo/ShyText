let openChatId: string | null = null;

export function setOpenChatId(chatId: string | null) {
  openChatId = chatId;
}

export function getOpenChatId() {
  return openChatId;
}
