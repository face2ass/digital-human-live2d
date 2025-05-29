// src/stores/chat.ts
import {defineStore} from 'pinia'
import {ref} from 'vue'
import http from '@/utils/http'
import {Comm} from "@/utils/comm";
import {TTSAudioBufferProvider} from "@/lappinputdevice.ts";

interface Message {
  id: string
  content: string
  time: string
  isOwn: boolean
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let conversationId = ''
  // 在对话开始时生成会话ID
  let ttsSessionId = '';

  http.request({
    method: 'post',
    url: '/adh/agent/v0/conversation_id',
    data: {
      engine: 'DifyAgent',
      settings: {
        DIFY_API_URL: "https://api.dify.ai/v1",
        DIFY_API_KEY: "app-amY6Nu9xgLrqdk7tR0q9ooBT",
        DIFY_API_USER: "adh",
      },
      streaming: true,
    },
    headers: {
      "Content-Type": "application/json",
    },
  }).then(response => {
    conversationId = response.data.data
    localStorage.setItem('conversationId', conversationId)
    console.log('■conversationId：', conversationId)
  })

  const getTimeString = () => {
    const date = new Date()
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }

  async function sendMessage(content: string) {
    isLoading.value = true
    error.value = null

    try {
      // 添加用户消息
      messages.value.push({
        id: Date.now().toString(),
        content,
        time: getTimeString(),
        isOwn: true
      })

      // 初始化并播放TTS音频
      const ttsProvider = TTSAudioBufferProvider.getInstance();
      ttsSessionId = ttsProvider.startNewSession();

      const response = await fetch('http://localhost:8000/adh/agent/v0/infer', {
        method: "POST",
        body: JSON.stringify({
          data: content,
          engine: 'DifyAgent',
          streaming: true,
          settings: {
            DIFY_API_URL: "https://api.dify.ai/v1",
            DIFY_API_KEY: "app-amY6Nu9xgLrqdk7tR0q9ooBT",
            DIFY_API_USER: "adh",
            conversation_id: conversationId
          }
        }),
        headers: {
          "Content-Type": "application/json",
        },
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder("utf-8");

      // 添加系统回复
      messages.value.push({
        id: Date.now().toString(),
        content: '思考中。。。',
        time: getTimeString(),
        isOwn: false
      })

      // 在外部作用域定义句子索引
      let sentenceIndex = 0;
      let audioText = '';
      let responseText = "";

      const callbackProcessing = (data: string) => {
        responseText += data;
        messages.value[messages.value.length - 1].content = responseText;
        // 按照标点符号断句处理
        audioText += data;
        // 断句判断符号
        // let punc = ["。", ".", "！", "!", "？", "?", "；", ";", "，", ",", "(", ")", "（", "）"];
        let punc = ["。", ".", "？", "?", "；", ";", "，", ","];
        // 找到最后一个包含这些符号的位置
        let lastPuncIndex = -1;
        for (let i = 0; i < punc.length; i++) {
          let index = audioText.lastIndexOf(punc[i]);
          if (index > lastPuncIndex) {
            // 防止需要连续的符号断句
            let firstPart = audioText.slice(0, index + 1);
            if (firstPart.split("(").length - firstPart.split(")").length != 0) {
              break;
            }
            if (firstPart.split("[").length - firstPart.split("]").length != 0) {
              break;
            }
            lastPuncIndex = index;
            break;
          }
        }
        if (lastPuncIndex !== -1) {
          // 处理第一个句子
          let currentSentence = audioText.slice(0, lastPuncIndex + 1);
          // 收集剩余部分用于下一次处理
          audioText = audioText.substring(lastPuncIndex + 1);

          // 发送TTS请求（捕获当前索引值）
          const currentIndex = sentenceIndex;
          Comm.getInstance().tts(currentSentence, {
            DIFY_API_URL: "https://api.dify.ai/v1",
            DIFY_API_KEY: "app-amY6Nu9xgLrqdk7tR0q9ooBT",
            DIFY_API_USER: "adh",
            conversation_id: conversationId
          }).then(
            (data: string) => {
              if (data) {
                ttsProvider.loadAndPlay(data, currentIndex, ttsSessionId);
              }
            }
          )
          // 递增句子索引
          sentenceIndex++;
        }
      }

      const callbackEnd = () => {
        // 处理剩余文本
        console.log("■剩余文本：", audioText, audioText.trim().length)
        const currentIndex = sentenceIndex;
        if (audioText.trim().length > 0) {
          Comm.getInstance().tts(audioText, {
            DIFY_API_URL: "https://api.dify.ai/v1",
            DIFY_API_KEY: "app-amY6Nu9xgLrqdk7tR0q9ooBT",
            DIFY_API_USER: "adh",
            conversation_id: conversationId
          }).then((data: string) => {
            if (data) {
              ttsProvider.loadAndPlay(data, currentIndex, ttsSessionId);
              ttsProvider.setEndIndex(currentIndex);
            }
          });
          sentenceIndex++;
        } else {
          ttsProvider.setEndIndex(currentIndex - 1);
        }
      }


      let chunkIndex = 0;
      while (true) {
        const {value, done} = await reader.read();
        if (done) {
          callbackEnd();
          break;
        }
        const chunk = decoder.decode(value, {stream: true});
        callbackProcessing(chunk);
        chunkIndex++;
      }
      reader.releaseLock();


    } catch (err) {
      error.value = '发送消息失败，请稍后重试'
      console.error('API Error:', err)
    } finally {
      isLoading.value = false
    }
  }

  return {
    messages,
    isLoading,
    error,
    sendMessage
  }
})