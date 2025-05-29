/**
 * Copyright(c) Live2D Inc. 版权所有。
 *
 * 使用此源代码受Live2D开源软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

import { csmVector, iterator } from '@framework/type/csmvector';
import * as LAppMotionSyncDefine from './lappmotionsyncdefine';
import { CubismMotionSync } from '@motionsyncframework/live2dcubismmotionsync';
import { LAppMotionSyncModel } from './lappmotionsyncmodel';
import { LAppWavFileHandler } from './SampleSrc/lappwavfilehandler';
import { CubismLogError } from '@framework/utils/cubismdebug';

/**
 * WorkletProcessor模块用的类型定义
 */
export interface LAppResponseObject {
  eventType: string;
  audioBuffer: Float32Array;
}

/**
 * 音频管理类
 * 负责音频加载和管理的类。
 */
export class LAppMotionSyncAudioManager {
  /**
   * 构造函数
   */
  constructor() {
    this._audios = new csmVector<AudioInfo>();
  }

  /**
   * 释放资源。
   */
  public release(): void {
    for (
      let ite: iterator<AudioInfo> = this._audios.begin();
      ite.notEqual(this._audios.end());
      ite.preIncrement()
    ) {
      if (!ite.ptr()) {
        continue;
      }

      if (ite.ptr().source) {
        ite.ptr().source.disconnect();
      }
      if (ite.ptr().audioContext) {
        ite.ptr().audioContext.close();
      }
    }
    this._audios = null;
  }

  /**
   * 音频加载
   *
   * @param fileName 要加载的音频文件路径名
   * @param audioContext 音频上下文
   * @return 音频信息，加载失败时返回null
   */
  public createAudioFromFile(
    fileName: string,
    index: number,
    model: LAppMotionSyncModel,
    motionSync: CubismMotionSync,
    audioContext: AudioContext,
    callback: (
      audioInfo: AudioInfo,
      callbackIndex: number,
      model: LAppMotionSyncModel,
      motionSync: CubismMotionSync
    ) => void
  ): void {
    if (this._audios && this._audios.at(index) != null) {
      // 查找已加载的音频
      for (
        let ite: iterator<AudioInfo> = this._audios.begin();
        ite.notEqual(this._audios.end());
        ite.preIncrement()
      ) {
        if (
          ite.ptr().filePath == fileName &&
          ite.ptr().audioContext == audioContext &&
          audioContext != null
        ) {
          // 第二次及以后会使用缓存（无等待时间）
          // 在WebKit中，要再次调用同一个Image的onload，需要重新实例化
          // 详情：https://stackoverflow.com/a/5024181
          ite.ptr().audio = new Audio();
          ite
            .ptr()
            .audio.addEventListener(
              'load',
              (): void => callback(ite.ptr(), index, model, motionSync),
              {
                passive: true
              }
            );
          ite.ptr().audio.src = fileName;
          ite.ptr().audioContext = audioContext;
          return;
        }
      }
    }

    // 创建音频上下文
    const newAudioContext = new AudioContext({
      sampleRate: LAppMotionSyncDefine.SamplesPerSec
    });

    newAudioContext.suspend();

    // 创建嵌入音频元素
    const audio = new Audio(fileName);

    // 嵌入音频元素的初始设置
    audio.preload = 'auto';

    // 创建音源节点
    const source = newAudioContext.createMediaElementSource(audio);

    // 添加AudioWorklet用的模块
    // 连接各个节点
    source.connect(newAudioContext.destination);

    const audioInfo: AudioInfo = new AudioInfo();
    if (audioInfo != null && this._audios != null) {
      audioInfo.filePath = fileName;
      audioInfo.audioContext = newAudioContext;
      audioInfo.audio = audio;
      audioInfo.source = source;
      audioInfo.isPlay = false;
      audioInfo.previousSamplePosition = 0;
      audioInfo.audioElapsedTime = 0;

      // 创建WavFileHandler
      const wavhandler = new LAppWavFileHandler();

      // 加载Wav文件
      wavhandler.loadWavFile(fileName).then(result => {
        if (!result) {
          CubismLogError("无法加载wav文件。文件名: " + fileName + "。");
          return;
        }
        audioInfo.wavhandler = wavhandler;
        audioInfo.audioSamples = audioInfo.wavhandler.getPcmDataChannel(0);
        this._audios.set(index, audioInfo);

        callback(audioInfo, index, model, motionSync);
      });
    }
    audio.src = fileName;

    // 播放结束时标记为未播放。
    audio.onended = function () {
      audioInfo.isPlay = false;

      // 播放结束时重置播放时间。
      audioInfo.previousSamplePosition = 0;
      audioInfo.audioElapsedTime = 0;
    };
  }

  /**
   * 释放音频
   *
   * 释放数组中存在的所有音频。
   */
  public clearAudios(): void {
    for (let i = 0; i < this._audios.getSize(); i++) {
      this._audios.at(i).source.disconnect();
      this._audios.at(i).audioContext.close();
      this._audios.set(i, null);
    }

    this._audios.clear();
  }

  /**
   * 释放音频
   *
   * 释放指定音频上下文的音频。
   * @param audioContext 要释放的音频上下文
   */
  public releaseAudioByAudioContext(audioContext: AudioContext): void {
    for (let i = 0; i < this._audios.getSize(); i++) {
      if (this._audios.at(i).audioContext != audioContext) {
        continue;
      }
      this._audios.at(i).source.disconnect();
      this._audios.at(i).audioContext.close();
      this._audios.set(i, null);
      this._audios.remove(i);
      break;
    }
  }

  /**
   * 释放音频
   *
   * 释放指定名称的音频。
   * @param fileName 要释放的音频文件路径
   */
  public releaseAudioByFilePath(fileName: string): void {
    for (let i = 0; i < this._audios.getSize(); i++) {
      if (this._audios.at(i).filePath != fileName) {
        continue;
      }
      this._audios.at(i).source.disconnect();
      this._audios.at(i).audioContext.close();
      this._audios.set(i, null);
      this._audios.remove(i);
      break;
    }
  }

  /**
   * 获取是否正在播放
   *
   * @param filePath 音频文件路径
   * @returns 指定名称的音频是否正在播放？
   */
  public isPlayByFilePath(filePath: string): boolean {
    for (let i = 0; i < this._audios.getSize(); i++) {
      if (this._audios.at(i).filePath != filePath) {
        continue;
      }

      return this.isPlayByIndex(i);
    }

    return false;
  }

  /**
   * 播放指定文件路径的音频
   *
   * @param filePath 音频文件路径
   */
  public playByFilePath(filePath: string): void {
    for (let i = 0; i < this._audios.getSize(); i++) {
      if (this._audios.at(i).filePath != filePath) {
        continue;
      }

      this.playByIndex(i);
      break;
    }
  }

  /**
   * 停止播放指定文件路径的音频
   *
   * @param filePath 音频文件路径
   */
  public stopByFilePath(filePath: string): void {
    for (let i = 0; i < this._audios.getSize(); i++) {
      if (this._audios.at(i).filePath != filePath) {
        continue;
      }

      this.stopByIndex(i);
      break;
    }
  }

  /**
   * 暂停播放指定文件路径的音频
   *
   * @param filePath 音频文件路径
   */
  public pauseByFilePath(filePath: string): void {
    for (let i = 0; i < this._audios.getSize(); i++) {
      if (this._audios.at(i).filePath != filePath) {
        continue;
      }

      this.pauseByIndex(i);
      break;
    }
  }

  /**
   * 获取是否正在播放
   *
   * @param index 索引
   * @returns 指定索引的音频是否正在播放？
   */
  public isPlayByIndex(index: number): boolean {
    if (
      this._audios == null ||
      !(index < this._audios.getSize()) ||
      this._audios.at(index) == null
    ) {
      return false;
    }

    return this._audios.at(index).isPlay;
  }

  /**
   * 播放指定索引的音频
   *
   * @param index 索引
   */
  public playByIndex(index: number): void {
    if (!(index < this._audios.getSize()) || this._audios.at(index) == null) {
      return;
    }

    const audioInfo = this._audios.at(index);

    audioInfo.audio.play().then(() => {
      audioInfo.isPlay = true;

      // 以秒为单位获取当前帧的时间
      // 注意：根据浏览器或浏览器设置，performance.now() 的精度可能不同
      const currentAudioTime = performance.now() / 1000; // 转换为秒。

      // 如果上一帧的时间早于当前时间，则视为同一时间
      if (currentAudioTime < audioInfo.audioContextPreviousTime) {
        audioInfo.audioContextPreviousTime = currentAudioTime;
      }
      audioInfo.audioContextPreviousTime = currentAudioTime;
    });
  }

  /**
   * 停止播放指定索引的音频
   *
   * @param index 索引
   */
  public stopByIndex(index: number): void {
    if (!(index < this._audios.getSize()) || this._audios.at(index) == null) {
      return;
    }

    const audioInfo = this._audios.at(index);
    audioInfo.audio.load();
    audioInfo.isPlay = false;

    // 重置播放位置
    audioInfo.previousSamplePosition = 0;
    audioInfo.audioElapsedTime = 0;
  }

  /**
   * 暂停播放指定索引的音频
   *
   * @param index 索引
   */
  public pauseByIndex(index: number): void {
    if (!(index < this._audios.getSize()) || this._audios.at(index) == null) {
      return;
    }

    const audioInfo = this._audios.at(index);
    audioInfo.audio.pause();
    audioInfo.isPlay = false;
  }

  _audios: csmVector<AudioInfo>;
  _eBuffers: number[] = [];
}

/**
 * 音频信息结构体
 */
export class AudioInfo {
  audio: HTMLAudioElement; // 嵌入音频元素
  audioContext: AudioContext = null; // 音频上下文
  source: MediaElementAudioSourceNode = null; // 音源节点
  filePath: string; // 文件名
  isPlay: boolean; // 是否正在播放？
  audioContextPreviousTime: number = 0; // 最后一次调用音频上下文的时间
  wavhandler: LAppWavFileHandler = null; // WavFileHandler的实例
  audioSamples: Float32Array = null; // 音频数据
  audioElapsedTime: number = 0; // 已播放的时间
  previousSamplePosition: number = 0; // 上一次的样本数
}
