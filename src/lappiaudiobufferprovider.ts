/**
 * Copyright(c) Live2D Inc. 版权所有。
 *
 * 使用此源代码受 Live2D 开源软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

import { csmVector } from '@framework/type/csmvector';

export interface ILAppAudioBufferProvider {
  /**
   * 获取音频缓冲区
   */
  getBuffer(): csmVector<number>;
}
