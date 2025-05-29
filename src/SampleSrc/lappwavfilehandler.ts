/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */
/** @deprecated 该变量因 getInstance() 方法已被弃用而不再推荐使用 */
export let s_instance: LAppWavFileHandler = null;

export class LAppWavFileHandler {
  // 添加音频上下文相关属性
  private _audioContext: AudioContext;
  private _audioSource: AudioBufferSourceNode;

  /**
   * 获取类的单例实例
   * 如果实例未创建，将在内部创建新实例
   *
   * @return 类的实例
   * @deprecated 不再推荐使用单例模式，请改用 new LAppWavFileHandler()
   */
  public static getInstance(): LAppWavFileHandler {
    if (s_instance == null) {
      s_instance = new LAppWavFileHandler();
    }

    return s_instance;
  }

  /**
   * 释放类的单例实例
   *
   * @deprecated 该方法因 getInstance() 被弃用而不再推荐使用
   */
  public static releaseInstance(): void {
    if (s_instance != null) {
      s_instance = void 0;
    }

    s_instance = null;
  }

  public update(deltaTimeSeconds: number) {
    let goalOffset: number;
    let rms: number;

    // 数据加载前/文件结束时不更新
    if (
      this._pcmData == null ||
      this._sampleOffset >= this._wavFileInfo._samplesPerChannel
    ) {
      this._lastRms = 0.0;
      return false;
    }

    // 保持经过时间后状态
    this._userTimeSeconds += deltaTimeSeconds;
    goalOffset = Math.floor(
      this._userTimeSeconds * this._wavFileInfo._samplingRate
    );
    if (goalOffset > this._wavFileInfo._samplesPerChannel) {
      goalOffset = this._wavFileInfo._samplesPerChannel;
    }

    // RMS计测
    rms = 0.0;
    for (
      let channelCount = 0;
      channelCount < this._wavFileInfo._numberOfChannels;
      channelCount++
    ) {
      for (
        let sampleCount = this._sampleOffset;
        sampleCount < goalOffset;
        sampleCount++
      ) {
        const pcm = this._pcmData[channelCount][sampleCount];
        rms += pcm * pcm;
      }
    }
    rms = Math.sqrt(
      rms /
        (this._wavFileInfo._numberOfChannels *
          (goalOffset - this._sampleOffset))
    );

    this._lastRms = rms;
    this._sampleOffset = goalOffset;
    return true;
  }

  public start(filePath: string): void {
    // 创建音频上下文（兼容旧浏览器）
    this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // 初始化采样位参照位置
    this._sampleOffset = 0;
    this._userTimeSeconds = 0.0;

    // 重置RMS值
    this._lastRms = 0.0;

    this.loadWavFile(filePath).then(success => {
      if (success) {
        // 加载成功后播放音频
        this.playAudio();
      }
    });
  }

  private playAudio(): void {
    if (!this._audioContext || !this._pcmData) return;

    // 创建音频缓冲区
    const audioBuffer = this._audioContext.createBuffer(
      this._wavFileInfo._numberOfChannels,
      this._wavFileInfo._samplesPerChannel,
      this._wavFileInfo._samplingRate
    );

    // 填充PCM数据
    for (let channel = 0; channel < this._wavFileInfo._numberOfChannels; channel++) {
      audioBuffer.getChannelData(channel).set(this._pcmData[channel]);
    }

    // 创建音频源并播放
    this._audioSource = this._audioContext.createBufferSource();
    this._audioSource.buffer = audioBuffer;
    this._audioSource.connect(this._audioContext.destination);
    this._audioSource.start(0);
  }

  public stop(): void {
    if (this._audioSource) {
      this._audioSource.stop();
      this._audioSource.disconnect();
    }
  }

  public getRms(): number {
    return this._lastRms;
  }

  public loadWavFile(fileData: string | ArrayBuffer): Promise<boolean> {
    return new Promise(resolveValue => {
      let ret = false;

      if (this._pcmData != null) {
        this.releasePcmData();
      }

      // 文件加载
      const asyncFileLoad = async () => {
        if (fileData instanceof ArrayBuffer) {
          return fileData;
        } else {
          let data = await fetch(fileData);
          return data.arrayBuffer();
        }
      };

      const asyncWavFileManager = async () => {
        this._byteReader._fileByte = await asyncFileLoad();
        this._byteReader._fileDataView = new DataView(
          this._byteReader._fileByte
        );
        this._byteReader._fileSize = this._byteReader._fileByte.byteLength;
        this._byteReader._readOffset = 0;

        // 文件加载失败或文件大小不足以容纳开头的签名"RIFF"，则失败
        if (
          this._byteReader._fileByte == null ||
          this._byteReader._fileSize < 4
        ) {
          resolveValue(false);
          return;
        }

        // 文件名
        this._wavFileInfo._fileName = fileData;

        try {
          // 签名 "RIFF"
          if (!this._byteReader.getCheckSignature('RIFF')) {
            ret = false;
            throw new Error('找不到签名 "RIFF".');
          }
          // 文件大小-8（跳过读取）
          this._byteReader.get32LittleEndian();
          // 签名 "WAVE"
          if (!this._byteReader.getCheckSignature('WAVE')) {
            ret = false;
            throw new Error('找不到签名 "WAVE".');
          }
          // 签名 "fmt "
          if (!this._byteReader.getCheckSignature('fmt ')) {
            ret = false;
            throw new Error('找不到签名 "fmt".');
          }
          // fmt块大小
          const fmtChunkSize = this._byteReader.get32LittleEndian();
          // 只接受格式ID为1（线性PCM）的文件
          if (this._byteReader.get16LittleEndian() != 1) {
            ret = false;
            throw new Error('文件不是线性PCM格式。');
          }
          // 获取声道数（单声道/立体声）
          this._wavFileInfo._numberOfChannels =
            this._byteReader.get16LittleEndian();
          // 采样率（如44100Hz）
          this._wavFileInfo._samplingRate =
            this._byteReader.get32LittleEndian();
          // 数据速度[字节/秒]（跳过读取）
          this._byteReader.get32LittleEndian();
          // 块大小（跳过读取）
          this._byteReader.get16LittleEndian();
          // 位深度（16bit/24bit等）
          this._wavFileInfo._bitsPerSample =
            this._byteReader.get16LittleEndian();
          // 跳过fmt块的扩展部分
          if (fmtChunkSize > 16) {
            this._byteReader._readOffset += fmtChunkSize - 16;
          }
          // 跳过可能的扩展块（fmt扩展部分）
          // 循环查找"data"块位置
          // 计算总样本数
          while (
            !this._byteReader.getCheckSignature('data') &&
            this._byteReader._readOffset < this._byteReader._fileSize
            ) {
            this._byteReader._readOffset +=
              this._byteReader.get32LittleEndian() + 4;
          }
          // 文件内未出现 "data" 块
          if (this._byteReader._readOffset >= this._byteReader._fileSize) {
            ret = false;
            throw new Error('找不到 "data" 块。');
          }
          // 样本数
          {
            const dataChunkSize = this._byteReader.get32LittleEndian();
            this._wavFileInfo._samplesPerChannel =
              (dataChunkSize * 8) /
              (this._wavFileInfo._bitsPerSample *
                this._wavFileInfo._numberOfChannels);
          }
          // 分配内存
          this._pcmData = new Array(this._wavFileInfo._numberOfChannels);
          for (
            let channelCount = 0;
            channelCount < this._wavFileInfo._numberOfChannels;
            channelCount++
          ) {
            this._pcmData[channelCount] = new Float32Array(
              this._wavFileInfo._samplesPerChannel
            );
          }
          // 获取波形数据
          for (
            let sampleCount = 0;
            sampleCount < this._wavFileInfo._samplesPerChannel;
            sampleCount++
          ) {
            for (
              let channelCount = 0;
              channelCount < this._wavFileInfo._numberOfChannels;
              channelCount++
            ) {
              this._pcmData[channelCount][sampleCount] = this.getPcmSample();
            }
          }

          ret = true;

          resolveValue(ret);
        } catch (e) {
          console.log(e);
        }
      };

      asyncWavFileManager().then(() => {
        resolveValue(ret);
      })
    });
  }

  public getPcmSample(): number {
    let pcm32;

    // 扩展为32位后，再将其缩放到 -1 到 1 的范围
    switch (this._wavFileInfo._bitsPerSample) {
      case 8:
        pcm32 = this._byteReader.get8() - 128;
        pcm32 <<= 24;
        break;
      case 16:
        pcm32 = this._byteReader.get16LittleEndian() << 16;
        break;
      case 24:
        pcm32 = this._byteReader.get24LittleEndian() << 8;
        break;
      default:
        // 不支持的位数
        pcm32 = 0;
        break;
    }

    return pcm32 / 2147483647; //Number.MAX_VALUE;
  }

  /**
   * 从指定声道获取音频样本数组
   *
   * @param usechannel 要使用的声道
   * @returns 指定声道的音频样本数组
   */
  public getPcmDataChannel(usechannel: number): Float32Array {
    // 如果指定的声道数大于数据数组的长度，则返回null。
    if (!this._pcmData || !(usechannel < this._pcmData.length)) {
      return null;
    }

    // 从 _pcmData 中创建一个新的指定声道的 Float32Array。
    return Float32Array.from(this._pcmData[usechannel]);
  }

  /**
   * 获取音频的采样率
   *
   * @returns 音频的采样率
   */
  public getWavSamplingRate(): number {
    if (!this._wavFileInfo || this._wavFileInfo._samplingRate < 1) {
      return null;
    }

    return this._wavFileInfo._samplingRate;
  }

  public releasePcmData(): void {
    for (
      let channelCount = 0;
      channelCount < this._wavFileInfo._numberOfChannels;
      channelCount++
    ) {
      this._pcmData[channelCount] = null;
    }
    delete this._pcmData;
    this._pcmData = null;
  }

  constructor() {
    this._pcmData = null;
    this._userTimeSeconds = 0.0;
    this._lastRms = 0.0;
    this._sampleOffset = 0.0;
    this._wavFileInfo = new WavFileInfo();
    this._byteReader = new ByteReader();
  }

  _pcmData: Array<Float32Array>;
  _userTimeSeconds: number;
  _lastRms: number;
  _sampleOffset: number;
  _wavFileInfo: WavFileInfo;
  _byteReader: ByteReader;
  loadFiletoBytes = (arrayBuffer: ArrayBuffer, length: number): void => {
    this._byteReader._fileByte = arrayBuffer;
    this._byteReader._fileDataView = new DataView(this._byteReader._fileByte);
    this._byteReader._fileSize = length;
  };
}

export class WavFileInfo {
  constructor() {
    this._fileName = '';
    this._numberOfChannels = 0;
    this._bitsPerSample = 0;
    this._samplingRate = 0;
    this._samplesPerChannel = 0;
  }

  _fileName: string; ///< 文件名
  _numberOfChannels: number; ///< 声道数
  _bitsPerSample: number; ///< 每个样本的位数
  _samplingRate: number; ///< 采样率
  _samplesPerChannel: number; ///< 每个声道的总样本数
}

export class ByteReader {
  constructor() {
    this._fileByte = null;
    this._fileDataView = null;
    this._fileSize = 0;
    this._readOffset = 0;
  }

  /**
   * @brief 8位读取
   * @return Csm::csmUint8 读取到的8位值
   */
  public get8(): number {
    const ret = this._fileDataView.getUint8(this._readOffset);
    this._readOffset++;
    return ret;
  }

  /**
   * @brief 16位读取（小端字节序）
   * @return Csm::csmUint16 读取到的16位值
   */
  public get16LittleEndian(): number {
    const ret =
      (this._fileDataView.getUint8(this._readOffset + 1) << 8) |
      this._fileDataView.getUint8(this._readOffset);
    this._readOffset += 2;
    return ret;
  }

  /**
   * @brief 24位读取（小端字节序）
   * @return Csm::csmUint32 读取到的24位值（设置在低24位）
   */
  public get24LittleEndian(): number {
    const ret =
      (this._fileDataView.getUint8(this._readOffset + 2) << 16) |
      (this._fileDataView.getUint8(this._readOffset + 1) << 8) |
      this._fileDataView.getUint8(this._readOffset);
    this._readOffset += 3;
    return ret;
  }

  /**
   * @brief 32位读取（小端字节序）
   * @return Csm::csmUint32 读取到的32位值
   */
  public get32LittleEndian(): number {
    const ret =
      (this._fileDataView.getUint8(this._readOffset + 3) << 24) |
      (this._fileDataView.getUint8(this._readOffset + 2) << 16) |
      (this._fileDataView.getUint8(this._readOffset + 1) << 8) |
      this._fileDataView.getUint8(this._readOffset);
    this._readOffset += 4;
    return ret;
  }

  /**
   * @brief 检查签名是否与参考值匹配
   * @param[in] reference 要检查的签名字符串
   * @retval  true    匹配成功
   * @retval  false   匹配失败
   */
  public getCheckSignature(reference: string): boolean {
    const getSignature: Uint8Array = new Uint8Array(4);
    const referenceString: Uint8Array = new TextEncoder().encode(reference);
    if (reference.length != 4) {
      return false;
    }
    for (let signatureOffset = 0; signatureOffset < 4; signatureOffset++) {
      getSignature[signatureOffset] = this.get8();
    }
    return (
      getSignature[0] == referenceString[0] &&
      getSignature[1] == referenceString[1] &&
      getSignature[2] == referenceString[2] &&
      getSignature[3] == referenceString[3]
    );
  }

  _fileByte: ArrayBuffer; ///< 加载的文件字节列
  _fileDataView: DataView;
  _fileSize: number; ///< 文件大小
  _readOffset: number; ///< 文件参照位置
}
