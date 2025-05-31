<!-- src/components/ChatWindow.vue -->
<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { useChatStore } from '@/stores/chat'

const chatStore = useChatStore()
const inputText = ref('')
const messagesEnd = ref<HTMLElement>()

const scrollToBottom = async () => {
  await nextTick()
  if (messagesEnd.value) {
    messagesEnd.value.scrollIntoView({ behavior: 'smooth' })
  }
}

const handleSend = async () => {
  if (!inputText.value.trim() || chatStore.isLoading) return

  await chatStore.sendMessage(inputText.value.trim())
  inputText.value = ''
  await scrollToBottom()
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}

onMounted(() => {
  scrollToBottom()
})
</script>

<template>
  <div id="chat-app">
    <div class="messages-wrapper">
      <div
        v-for="message in chatStore.messages"
        :key="message.id"
        class="message-bubble"
        :class="{ 'own-message': message.isOwn }"
      >
        <div class="message-content">
          {{ message.content }}
        </div>
        <div class="message-time">
          {{ message.time }}
        </div>
      </div>
      <div ref="messagesEnd"></div>
    </div>

    <div class="input-area">
      <textarea
        v-model="inputText"
        placeholder="输入消息..."
        @keydown="handleKeyPress"
        :disabled="chatStore.isLoading"
        class="message-input"
      ></textarea>
      <button
        @click="handleSend"
        :disabled="!inputText.trim() || chatStore.isLoading"
        class="send-button"
      >
        {{ chatStore.isLoading ? '发送中...' : '发送' }}
      </button>
    </div>

    <div v-if="chatStore.error" class="error-message">
      {{ chatStore.error }}
    </div>
  </div>
</template>

<style lang="scss">
#chat-app {
  position: absolute;
  top: 40px;
  left: 0;
  bottom: 0;
  width: 350px;
  display: flex;
  flex-direction: column;
  pointer-events: none;
  background-color: rgba(255, 255, 255, 0.3);

  > .messages-wrapper {
    flex: 1;
    overflow-y: auto;
    padding: 0 10px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    scrollbar-width: thin;
    scrollbar-color: #c1c1c1 transparent;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }

    > .message-bubble {
      max-width: 70%;
      padding: 12px 16px;
      border-radius: 12px;
      background-color: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(2px);
      position: relative;
      align-self: flex-start;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
      pointer-events: none;

      &.own-message {
        align-self: flex-end;
        background-color: rgba(24, 144, 255, 0.95);
        color: white;
      }

      > .message-content {
        font-size: 14px;
        word-break: break-word;
        line-height: 20px;
      }

      > .message-time {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.7);
        margin-top: 4px;
        margin-bottom: -10px;
        text-align: right;
      }

      &:not(.own-message) > .message-time {
        color: rgba(0, 0, 0, 0.5);
      }
    }
  }

  > .input-area {
    pointer-events: auto;
    display: flex;
    border-top: 1px solid rgba(224, 224, 224, 0.5);
    padding: 15px;
    background-color: rgba(255, 255, 255, 0.95);
    gap: 10px;

    > .message-input {
      flex: 1;
      padding: 10px;
      border: 1px solid rgba(224, 224, 224, 0.5);
      border-radius: 4px;
      resize: none;
      min-height: 40px;
      max-height: 120px;
      background: rgba(255, 255, 255, 0.8);
      transition: all 0.2s;

      &:focus {
        outline: none;
        border-color: #1890ff;
        box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
        background: white;
      }

      &:disabled {
        background: rgba(245, 245, 245, 0.8);
      }
    }

    > .send-button {
      padding: 0 20px;
      height: 40px;
      border: none;
      border-radius: 4px;
      background-color: #1890ff;
      color: white;
      cursor: pointer;
      transition: all 0.2s;

      &:hover:not(:disabled) {
        background-color: #40a9ff;
      }

      &:disabled {
        background-color: rgba(186, 231, 255, 0.7);
        cursor: not-allowed;
      }
    }
  }

  > .error-message {
    padding: 10px;
    background: #ffebee;
    color: #ff5252;
    text-align: center;
    font-size: 14px;
  }
}
</style>