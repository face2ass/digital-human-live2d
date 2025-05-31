/**
 * Copyright(c) Live2D Inc. 版权所有。
 *
 * 使用此源代码受Live2D开源软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

import {csmVector} from '@framework/type/csmvector';

import {type LAppResponseObject} from './lappmotionsyncaudiomanager';
import {CubismLogError} from '@framework/utils/cubismdebug';
import {type ILAppAudioBufferProvider} from './lappiaudiobufferprovider';
import {base64ToArrayBuffer} from './utils/comm';

export let s_instance: LAppInputDevice = null;

/**
 * 用于存储来自 AudioWorklet 数据的缓冲区类
 *
 * 仅在 LAppInputDevice 内部使用
 */
class AudioBuffer {
  private _buffer: Float32Array;
  private _size: number;
  private _head: number;

  public constructor(size: number) {
    this._buffer = new Float32Array(size);
    this._size = 0;
    this._head = 0;
  }

  public get size(): number {
    return this._size;
  }

  /**
   * 在缓冲区末尾添加一个值
   * @param value 要添加的值
   */
  public addLast(value: number): void {
    this._buffer[this._head] = value;
    this._size = Math.min(this._size + 1, this._buffer.length);
    this._head++;
    if (this._head >= this._buffer.length) {
      this._head = 0;
    }
  }

  /**
   * 将缓冲区内容转换为 csmVector<number> 类型
   * @returns 包含缓冲区内容的 csmVector<number> 实例
   */
  public toVector(): csmVector<number> {
    const result = new csmVector<number>(this._size);
    let p: number = this._head - this._size;
    if (p < 0) {
      p += this._buffer.length;
    }
    for (let i = 0; i < this._size; i++) {
      result.pushBack(this._buffer[p]);
      p++;
      if (p >= this._buffer.length) {
        p = 0;
      }
    }
    return result;
  }

  /**
   * 清空缓冲区
   */
  public clear(): void {
    this._size = 0;
    this._head = 0;
  }
}

/**
 * 应用程序的音频输入设备类，实现了 ILAppAudioBufferProvider 接口
 */
export class LAppInputDevice implements ILAppAudioBufferProvider {
  /**
   * 返回类的实例（单例模式）。
   * 若实例尚未创建，则在内部创建实例。
   *
   * @return 类的实例
   */
  public static getInstance(): LAppInputDevice {
    if (s_instance == null) {
      s_instance = new LAppInputDevice();
    }

    return s_instance;
  }

  private _source: MediaStreamAudioSourceNode;
  private _context: AudioContext;
  private _buffer: AudioBuffer;
  private _lockId: string;
  private _isInitialized: boolean = false;

  /**
   * 检查设备是否已初始化
   * @returns 设备已初始化返回 true，否则返回 false
   */
  public isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * 异步初始化音频输入设备
   * @returns 初始化成功返回 true，失败返回 false
   */
  public async initialize(): Promise<boolean> {
    // 注意：锁 API 会与工作线程或其他标签页共享。请尽量确保用于锁的名称不与其他名称重复。
    await navigator.locks.request(this._lockId, async lock => {
      if (this.isInitialized()) {
        return true;
      }
      console.log('■初始化音频输入设备')
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audios = devices.filter(
        (value, index, array) => value.kind === 'audioinput'
      );
      if (audios.length == 0) {
        CubismLogError('未找到音频输入设备。');
        return false;
      }
      const constraints: MediaStreamConstraints = {
        audio: {deviceId: audios[0].deviceId}
      };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (error) {
        if (typeof error === 'object') {
          if ('message' in error) {
            console.error(error.message);
          }
        }
        return false;
      }
      const tracks = stream.getAudioTracks();
      if (tracks.length == 0) {
        return false;
      }
      const settings: MediaTrackSettings = tracks[0].getSettings();
      const isSampleRateSupported: boolean = 'sampleRate' in settings;
      // 注意：部分浏览器不提供 sampleRate，因此暂时设为 48000
      const sampleRate = isSampleRateSupported ? settings.sampleRate : 48000;
      // 留出一定余量（30fps），创建约 2 帧大小的缓冲区
      // 注意：由于 `requestAnimationFrame()` 回调调用的时间间隔取决于显示器刷新率，
      // 理论上应设置与该刷新率对应的 fps 值，但由于没有获取该值的 API，
      // 假设刷新率基本不会低于 30Hz，因此设为 30。
      const frameRate: number = 30; // 最低预期刷新率
      const amount: number = 2; // 2 帧的量
      this._buffer = new AudioBuffer(
        Math.trunc((sampleRate / frameRate) * amount)
      );
      // 注意：目前没有办法知道 AudioContext 支持的 sampleRate，因此未指定创建
      this._context = new AudioContext();
      this._source = this._context.createMediaStreamSource(
        new MediaStream([tracks[0]])
      );
      await this._context.audioWorklet.addModule(
        './lappaudioworkletprocessor.js'
      );
      const audioWorkletNode = new AudioWorkletNode(
        this._context,
        'lappaudioworkletprocessor'
      );
      this._source.connect(audioWorkletNode);
      audioWorkletNode.connect(this._context.destination); // 连接至音频输出设备
      audioWorkletNode.port.onmessage = this.onMessage.bind(this);

      this._isInitialized = true;
    });

    return true;
  }

  /**
   * 获取音频缓冲区
   * @returns 包含音频数据的 csmVector<number> 实例
   */
  public getBuffer(): csmVector<number> {
    return this._buffer.toVector();
  }

  /**
   * 重置音频缓冲区
   */
  public reset(): void {
    this._buffer.clear();
  }

  /**
   * 处理来自 AudioWorkletNode 的消息
   * @param e 消息事件对象
   */
  private onMessage(e: MessageEvent<any>) {
    // 原类型为 any，因此在此定义。
    const data: LAppResponseObject = e.data;

    // 从 WorkletProcessor 模块获取数据
    if (data.eventType === 'data' && data.audioBuffer) {
      console.log('■音频片段处理', data.audioBuffer.length)
      for (let i = 0; i < data.audioBuffer.length; i++) {
        this._buffer.addLast(data.audioBuffer[i]);
      }
    }
  }

  /**
   * 更新方法，当前未实现
   */
  public update(): void {
    throw new Error('方法未实现。');
  }

  /**
   * 释放资源方法，当前未实现
   */
  public release(): void {
    throw new Error('方法未实现。');
  }

  /**
   * 构造函数
   */
  public constructor() {
    // 注意：为避免异步初始化处理被重复执行，使用锁 API 时的键
    // 由于锁 API 仅接受字符串，因此生成 UUID。
    this._lockId = crypto.randomUUID();
    this._buffer = new AudioBuffer(0);
  }
}

/**
 * 用于处理TTS音频的提供器，实现ILAppAudioBufferProvider接口
 * 支持按顺序播放音频片段
 */
export class TTSAudioBufferProvider implements ILAppAudioBufferProvider {
  private static _instance: TTSAudioBufferProvider;
  private _context: AudioContext;
  private _buffer: AudioBuffer;
  private _workletNode: AudioWorkletNode | null = null;
  private _source: MediaStreamAudioSourceNode | null = null;
  private _mediaStream: MediaStream | null = null;
  private _isInitialized: boolean = false;
  private _lockId: string;

  // 音频队列管理
  private _audioQueue: {index: number, base64Data: string, sessionId: string}[] = [];
  private _currentPlayingIndex: number = -1;
  private _isPlaying: boolean = false;
  private _nextExpectedIndex: number = 0; // 下一个期望播放的索引
  private _endIndex: number = -1; // 队列里的最后一个索引

  // 添加轮次管理
  private _currentSessionId: string | null = null;
  private _sessionCounter: number = 0;

  private _userInteracted: boolean = false;

  public static getInstance(): TTSAudioBufferProvider {
    if (!TTSAudioBufferProvider._instance) {
      TTSAudioBufferProvider._instance = new TTSAudioBufferProvider();
    }
    return TTSAudioBufferProvider._instance;
  }

  public isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * 异步初始化音频上下文和AudioWorklet
   */
  public async initialize(): Promise<boolean> {
    if (this.isInitialized()) return true;

    // 等待用户交互
    if (!this._userInteracted) {
      console.log('等待用户交互...');
      await new Promise<void>((resolve) => {
        const handler = () => {
          console.log('用户交互检测到');
          document.removeEventListener('click', handler);
          document.removeEventListener('touchstart', handler);
          document.removeEventListener('keydown', handler);
          this._userInteracted = true;
          resolve();
        };

        document.addEventListener('click', handler);
        document.addEventListener('touchstart', handler);
        document.addEventListener('keydown', handler);
      });
    }

    try {
      this._context = new (window.AudioContext || (window as any).webkitAudioContext)();

      // 恢复上下文状态
      if (this._context.state === 'suspended') {
        console.log('尝试恢复音频上下文...');
        await this._context.resume();
        console.log('音频上下文已恢复');
      }

      // 加载AudioWorklet处理器
      await this._context.audioWorklet.addModule(
        './lappaudioworkletprocessor.js' // 使用与麦克风相同的处理器
      );

      // 初始化缓冲区（与麦克风实现保持一致）
      const sampleRate = this._context.sampleRate;
      const frameRate = 30; // 与麦克风实现相同的假设
      const amount = 2; // 2帧的量
      this._buffer = new AudioBuffer(Math.trunc((sampleRate / frameRate) * amount));

      this._isInitialized = true;
      return true;
    } catch (error) {
      console.error('TTSAudioBufferProvider初始化失败:', error);
      return false;
    }
  }

  public createSilentAudio(duration: number = 0.2): string {
    // 创建一个短暂的静音音频（200ms）
    const sampleRate = 44100; // 采样率
    const channels = 1; // 单声道
    const samples = Math.floor(duration * sampleRate);

    // 创建 WAV 文件头
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    // RIFF 头
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + samples * 2, true); // 文件大小
    view.setUint32(8, 0x57415645, false); // "WAVE"

    // fmt 子块
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true); // 子块大小
    view.setUint16(20, 1, true); // PCM 格式
    view.setUint16(22, channels, true); // 声道数
    view.setUint32(24, sampleRate, true); // 采样率
    view.setUint32(28, sampleRate * channels * 2, true); // 字节率
    view.setUint16(32, channels * 2, true); // 块对齐
    view.setUint16(34, 16, true); // 位深度

    // data 子块
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, samples * 2, true); // 数据大小

    // 创建静音数据（所有值为0）
    const data = new Int16Array(samples);

    // 合并头和静音数据
    const wavData = new Uint8Array(header.byteLength + data.byteLength);
    wavData.set(new Uint8Array(header), 0);
    wavData.set(new Uint8Array(data.buffer), 44);

    // 转换为 Base64
    let binary = '';
    for (let i = 0; i < wavData.length; i++) {
      binary += String.fromCharCode(wavData[i]);
    }

    return `data:audio/wav;base64,${window.btoa(binary)}`;
  }

  /**
   * 开始新的一轮对话
   */
  public startNewSession(): string {
    // 生成唯一会话ID
    const sessionId = `session-${Date.now()}-${this._sessionCounter++}`;
    this._currentSessionId = sessionId;

    // 重置播放状态
    this._nextExpectedIndex = 0;
    this._audioQueue = [];
    this._currentPlayingIndex = -1;
    this._isPlaying = false;
    this.reset();

    console.log(`开始新会话: ${sessionId}`);
    return sessionId;
  }

  /**
   * 检查是否属于当前会话
   */
  private _isCurrentSession(sessionId: string): boolean {
    return sessionId === this._currentSessionId;
  }

  /**
   * 将音频片段添加到播放队列
   * @param base64Data Base64编码的WAV音频数据
   * @param index 音频片段的索引（从0开始）
   * @param sessionId 会话ID
   */
  public async loadAndPlay(base64Data: string, index: number, sessionId: string): Promise<void> {
    if (!this.isInitialized()) {
      await this.initialize();
    }
    if (!this._isCurrentSession(sessionId)) {
      console.warn(`音频片段 ${index} 属于过期会话，已忽略`);
      return;
    }

    // 将音频片段添加到队列
    this._audioQueue.push({index, base64Data, sessionId});

    // 对队列按索引排序
    this._audioQueue.sort((a, b) => a.index - b.index);

    // 尝试播放队列中的下一个片段
    this._playNextIfPossible();
  }

  /**
   * 尝试播放队列中的下一个音频片段
   */
  private _playNextIfPossible(): void {
    console.log('■尝试播放下一个音频，当前播放状态:', this._isPlaying, '队列长度:', this._audioQueue.length);
    // 如果正在播放，则等待
    if (this._isPlaying) return;

    // 如果队列为空，则返回
    if (this._audioQueue.length === 0) return;

    // 找到下一个应该播放的片段（索引最小的）
    const nextAudio = this._audioQueue[0];

    // 检查会话是否有效
    if (!this._isCurrentSession(nextAudio.sessionId)) {
      console.warn(`忽略过期会话的音频: ${nextAudio.index}`);
      this._audioQueue.shift();
      this._playNextIfPossible();
      return;
    }

    // 确保按顺序播放
    if (nextAudio.index !== this._nextExpectedIndex) {
      console.log(`等待索引${this._nextExpectedIndex}的音频，当前队列索引:`, this._audioQueue.map(a => a.index));
      return;
    }

    // 从队列中移除
    this._audioQueue.shift();

    // 播放音频
    this._playAudio(nextAudio.base64Data, nextAudio.index, nextAudio.sessionId);
  }

  /**
   * 实际播放音频
   * @param base64Data Base64编码的音频数据
   * @param index 音频片段的索引
   * @param sessionId 会话ID
   */
  private async _playAudio(base64Data: string, index: number, sessionId: string): Promise<void> {
    // 捕获当前会话ID
    const currentSessionId = sessionId;

    // 停止当前播放
    this.stopPlayback();

    try {
      // 更新播放状态
      this._currentPlayingIndex = index;
      this._isPlaying = true;

      // 创建虚拟媒体流
      this._mediaStream = await this.createVirtualMediaStream(new Blob([base64ToArrayBuffer(base64Data)], {type: 'audio/wav'}), currentSessionId);

      // 创建音频源节点
      this._source = this._context.createMediaStreamSource(this._mediaStream);

      // 创建AudioWorklet节点
      this._workletNode = new AudioWorkletNode(
        this._context,
        'lappaudioworkletprocessor' // 使用与麦克风相同的处理器名称
      );

      // 设置消息处理
      this._workletNode.port.onmessage = this.onMessage.bind(this);

      // 连接节点
      this._source.connect(this._workletNode);
      this._workletNode.connect(this._context.destination); // 连接至音频输出设备

    } catch (error) {
      console.error(`播放索引${index}的音频失败:`, error);
      this._isPlaying = false;
      this._playNextIfPossible(); // 尝试播放下一个
    }
  }

  /**
   * 创建虚拟媒体流来模拟麦克风输入
   * @param audioBlob 音频Blob对象
   * @returns 虚拟媒体流
   * @param sessionId 会话ID
   */
  private async createVirtualMediaStream(audioBlob: Blob, sessionId: string): Promise<MediaStream> {
    // 确保上下文处于运行状态
    if (this._context.state === 'suspended') {
      console.log('尝试恢复音频上下文...');
      try {
        await this._context.resume();
        console.log('音频上下文已恢复');
      } catch (error) {
        console.error('恢复音频上下文失败:', error);
      }
    }

    // 创建音频元素
    const audioElement = new Audio();
    audioElement.src = URL.createObjectURL(audioBlob);
    audioElement.controls = false;

    // 创建MediaStream目的地
    const mediaStreamDestination = this._context.createMediaStreamDestination();

    // 创建MediaElementSource节点
    const sourceNode = this._context.createMediaElementSource(audioElement);
    sourceNode.connect(mediaStreamDestination);

    // 播放静音结尾
    const silentAudio = this.createSilentAudio();

    // 捕获当前会话ID
    const currentSessionId = sessionId;

    // 监听播放结束
    audioElement.onended = async () => {
      // 检查会话是否过期
      if (!this._isCurrentSession(currentSessionId)) {
        console.log(`音频片段 ${this._currentPlayingIndex} 播放中止（会话已过期）`);
        return;
      }

      // 创建并播放短暂的静音音频
      const silentElement = new Audio(silentAudio);
      const silentSource = this._context.createMediaElementSource(silentElement);
      silentSource.connect(mediaStreamDestination);

      await silentElement.play();

      // 静音结束后才真正结束
      silentElement.onended = () => {
        console.log('■播放结束:', currentSessionId, this._currentPlayingIndex)
        // 再次检查会话
        if (!this._isCurrentSession(currentSessionId)) {
          console.log(`静音结尾播放中止（会话已过期）`);
          return;
        }

        console.log(`■onended：`, this._currentPlayingIndex, this._endIndex);
        this._isPlaying = false;
        this._nextExpectedIndex = this._currentPlayingIndex + 1;
        this.stopPlayback();
        this._playNextIfPossible();
      };
    };// 监听播放错误
    audioElement.onerror = (event) => {
      console.error('音频播放错误:', event);
    };

    console.log('■开始播放音频片段:', this._currentPlayingIndex)
    await audioElement.play();
    console.log('■播放成功:', mediaStreamDestination)
    return mediaStreamDestination.stream;
  }

  /**
   * 处理来自AudioWorkletNode的消息
   * @param e 消息事件对象
   */
  private onMessage(e: MessageEvent<any>) {
    // 与麦克风实现相同的处理逻辑
    const data: LAppResponseObject = e.data;

    if (data.eventType === 'data' && data.audioBuffer) {
      console.log('■音频片段处理', data.audioBuffer.length)
      for (let i = 0; i < data.audioBuffer.length; i++) {
        this._buffer.addLast(data.audioBuffer[i]);
      }
    }
  }

  /**
   * 停止当前播放
   */
  public stopPlayback(): void {
    if (this._workletNode) {
      this._workletNode.port.onmessage = null;
      this._workletNode.disconnect();
      this._workletNode = null;
    }

    if (this._source) {
      this._source.disconnect();
      this._source = null;
    }

    if (this._mediaStream) {
      this._mediaStream.getTracks().forEach(track => track.stop());
      this._mediaStream = null;
    }

    this._isPlaying = false;
  }

  /**
   * 获取当前音频缓冲区
   */
  public getBuffer(): csmVector<number> {
    return this._buffer.toVector();
  }

  /**
   * 重置音频缓冲区
   */
  public reset(): void {
    this._buffer.clear();
  }

  /**
   * 更新方法（保留以兼容接口）
   */
  public update(): void {
    // 无需额外更新逻辑，数据通过AudioWorklet实时接收
  }

  public setEndIndex(endIndex: number): void {
    console.log('■设置结束索引:', endIndex)
    this._endIndex = endIndex;
  }

  /**
   * 释放资源
   */
  public release(): void {
    this.stopPlayback();
    this._audioQueue = [];
    this._currentPlayingIndex = -1;
    this._nextExpectedIndex = 0;
    this._endIndex = -1;

    if (this._context) {
      this._context.close().catch(e => console.error('释放AudioContext失败:', e));
    }
    this._isInitialized = false;
    console.log('■资源释放完成')
  }

  /**
   * 获取当前播放状态
   */
  public isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * 获取下一个期望的音频索引
   */
  public getNextExpectedIndex(): number {
    return this._nextExpectedIndex;
  }

  /**
   * 获取队列中的音频数量
   */
  public getQueueLength(): number {
    return this._audioQueue.length;
  }

  public constructor() {
    this._lockId = crypto.randomUUID();
    // 初始化缓冲区占位符，实际在initialize中初始化
    this._buffer = new AudioBuffer(0);
  }
}

