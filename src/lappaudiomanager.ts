/**
 * Copyright(c) Live2D Inc. 版权所有。
 *
 * 使用此源代码受Live2D开源软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

import { csmVector } from '@framework/type/csmvector';
import { CubismMotionSync } from '@motionsyncframework/live2dcubismmotionsync';
import {
  AudioInfo,
  LAppMotionSyncAudioManager
} from './lappmotionsyncaudiomanager';
import { LAppMotionSyncModel } from './lappmotionsyncmodel';
import {LAppPal} from "@/SampleSrc/lapppal.ts";

export class LAppAudioManager {
  /**
   * 从路径加载音频文件
   *
   * @param path 文件路径
   */
  public loadFile(
    path: string,
    index: number,
    model: LAppMotionSyncModel,
    motionSync: CubismMotionSync
  ): void {
    this._soundBufferContext
      .getAudioManager()
      .createAudioFromFile(
        path,
        index,
        model,
        motionSync,
        null,
        (
          audioInfo: AudioInfo,
          index: number,
          model: LAppMotionSyncModel,
          motionSync: CubismMotionSync
        ): void => {
          LAppPal.printMessage("[APP]音频文件已加载：", path);
          this._soundBufferContext
            .getBuffers()
            .set(index, new csmVector<number>());
        }
      );
  }

  /**
   * 更新
   */
  public update(): void {}

  /**
   * 从容器头部删除元素并将其他元素前移
   *
   * @param buffer 要修改的缓冲区
   * @param size 删除的元素数量
   * @returns 修改后的缓冲区
   */
  public spliceBegin(
    buffer: csmVector<number>,
    size: number
  ): csmVector<number> {
    if (!buffer?.begin() || buffer?._size <= size) {
      return buffer; // 超出删除范围
    }

    // 删除操作
    buffer._ptr.splice(0, size);
    buffer._size -= size;

    return buffer;
  }

  /**
   * 从头部删除指定数量的数据
   *
   * @param index 要删除数据的缓冲区索引
   * @param size 删除的数据元素数量
   */
  public removeDataArrayByIndex(index: number, size: number) {
    let buffer = this._soundBufferContext.getBuffers().at(index);

    if (size < buffer.getSize()) {
      // 截取中间部分作为缓冲区
      buffer = this.spliceBegin(buffer, size);
    }
  }

  /**
   * 判断指定索引的音频上下文是否处于暂停状态
   *
   * @param index 指定的索引
   * @returns 音频上下文是否处于暂停状态？
   */
  public isSuspendedContextByIndex(index: number): boolean {
    const audioContext = this.getSoundBufferContext()
      .getAudioManager()
      ._audios.at(index).audioContext;

    return audioContext.state == 'suspended';
  }

  /**
   * 使用索引播放音频
   *
   * @param index 索引
   */
  public playByIndex(index: number): void {
    if (this.isPlayByIndex(index)) {
      return;
    }

    const audioContext = this.getSoundBufferContext()
      .getAudioManager()
      ._audios.at(index).audioContext;

    // 如果仍处于暂停状态，则将其设置为运行状态
    if (this.isSuspendedContextByIndex(index)) {
      audioContext.resume().then(() => {
        this._soundBufferContext.getAudioManager().playByIndex(index);
      });
    } else {
      this._soundBufferContext.getAudioManager().playByIndex(index);
    }
  }

  /**
   * 使用索引停止音频播放
   *
   * @param index 索引
   */
  public stopByIndex(index: number): void {
    if (!this.isPlayByIndex(index)) {
      return;
    }

    this._soundBufferContext.getAudioManager().stopByIndex(index);

    // 清空缓冲区内容
    const buffer = this._soundBufferContext.getBuffers().at(index);
    buffer.clear();
  }

  /**
   * 使用索引判断音频是否正在播放
   *
   * @param index 索引
   * @returns 是否正在播放？
   */
  public isPlayByIndex(index: number): boolean {
    return this._soundBufferContext.getAudioManager().isPlayByIndex(index);
  }

  public getSoundBufferContext(): SoundBufferContext {
    return this._soundBufferContext;
  }

  public constructor() {
    this._soundBufferContext = new SoundBufferContext();
  }

  public release() {
    if (this._soundBufferContext) {
      this._soundBufferContext.release();
      this._soundBufferContext = void 0;
    }
  }

  private _soundBufferContext: SoundBufferContext;
}

export class SoundBufferContext {
  public getBuffers(): csmVector<csmVector<number>> {
    return this._buffers;
  }

  public getAudioManager(): LAppMotionSyncAudioManager {
    return this._audioManager;
  }

  public constructor(
    buffers?: csmVector<csmVector<number>>,
    audioManager?: LAppMotionSyncAudioManager
  ) {
    this._buffers = buffers ? buffers : new csmVector<csmVector<number>>();
    this._audioManager = audioManager
      ? audioManager
      : new LAppMotionSyncAudioManager();
  }

  public release() {
    if (this._buffers != null) {
      this._buffers.clear();
      this._buffers = void 0;
    }

    if (this._audioManager != null) {
      this._audioManager.release();
      this._audioManager = void 0;
    }
  }

  private _buffers: csmVector<csmVector<number>>;
  private _audioManager: LAppMotionSyncAudioManager;
}
