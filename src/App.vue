<template>
  <header class="page-header">
    <!--<div class="tab-list">-->
    <!--  <div class="tab gallery" @click="showModal = true">画廊</div>-->
    <!--  <div class="tab settings">设置</div>-->
    <!--</div>-->
  </header>
  <button id="enable-audio" style="position: fixed; top: 10px; left: 50%; z-index: 1000;" @click="enableAudio">
    启用音频
  </button>
  <ModalGallery
    v-model="showModal"
    :items="galleryItems"
    @confirm="handleConfirm"
  />
  <ChatBox />
  <div class="page-container">
    <div id="live2d-cvs"></div>
  </div>
</template>

<script setup lang="ts">
/**
 * Copyright(c) Live2D Inc. 版权所有。
 *
 * 使用此源代码受Live2D开源软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

import {LAppMotionSyncDelegate} from './lappmotionsyncdelegate';
import {onMounted, onUnmounted} from "vue";
import {ref} from 'vue'
import ModalGallery from './ModalGallery.vue'
import ChatBox from './ChatBox.vue'
import {TTSAudioBufferProvider} from "@/lappinputdevice.ts";

const showModal = ref(false)
const galleryItems = ref({
  people: [
    {id: 1, title: '人物1', imageUrl: '...'},
    // 更多人物数据...
  ],
  background: [
    {id: 1, title: '背景1', imageUrl: '...'},
    // 更多背景数据...
  ]
})

const handleConfirm = ({type, item}) => {
  console.log('选中的内容:', type, item)
}

const enableAudio = async () => {
  const ttsProvider = TTSAudioBufferProvider.getInstance();
  await ttsProvider.initialize();
  // 触发一次虚拟播放以解除浏览器限制
  const silentAudio = ttsProvider.createSilentAudio(0.1);
  const silentElement = new Audio(silentAudio);
  await silentElement.play();
  console.log('音频功能已启用');
}

onMounted(() => {
  // 确认是否为安全上下文。
  // 参考: https://developer.mozilla.org/zh-CN/docs/Web/Security/Secure_Contexts
  if (!window.isSecureContext) {
    // 若不是安全上下文，则通过弹窗提示部分功能可能无法正常工作，并返回。
    alert('非安全上下文，部分功能可能无法正常工作。');

    // 显示此连接下AudioWorklet可能无法工作的信息。
    document.body.innerHTML =
      '此连接下`AudioWorklet`可能无法正常工作。';
    return;
  }

  // 初始化WebGL并创建应用实例
  if (!LAppMotionSyncDelegate.getInstance().initialize()) {
    return;
  }

  LAppMotionSyncDelegate.getInstance().run();
});

onUnmounted(() => {
  LAppMotionSyncDelegate.releaseInstance()
});
</script>

<style lang="scss">
.page-header {
  position: absolute;
  top: 50%;
  left: 0;
  color: #fff;
  z-index: 2;
}

#live2d-cvs {
  width: 100%;
  height: 100%;

  & > canvas {
    display: block;
  }
}
</style>
