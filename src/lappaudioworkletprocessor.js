/**
 * Copyright(c) Live2D Inc. 版权所有。
 *
 * 使用此源代码受Live2D开源软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

/**
 * 音频工作线程处理器
 */
class LAppAudioWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.useChannel = 0;
  }

  process(inputs, outputs, parameters) {
    const channel = this.useChannel % inputs[0].length;
    const input = inputs[0][channel];
    if (input == undefined || input == null) {
      return true;
    }

    // 追加到后面
    const audioBuffer = Float32Array.from([...input]);

    this.port.postMessage({
      eventType: "data",
      audioBuffer: audioBuffer,
    });

    let inputArray = inputs[0];
    let output = outputs[0];
    for (let currentChannel = 0; currentChannel < inputArray.length; ++currentChannel) {
      let inputChannel = inputArray[currentChannel];
      let outputChannel = output[currentChannel];
      for (let i = 0; i < inputChannel.length; ++i){
        outputChannel[i] = inputChannel[i];
      }
    }

    return true;
  }
}

registerProcessor('lappaudioworkletprocessor', LAppAudioWorkletProcessor);
