/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import * as LAppDefine from "./lappdefine";

/**
 * 抽象化平台相关功能的 Cubism 平台抽象层。
 *
 * 汇总文件读取、时间获取等与平台相关的函数。
 */
export class LAppPal {
  /**
   * 将文件作为字节数据读取
   *
   * @param filePath 要读取的文件路径
   * @return
   * {
   *      buffer,   读取的字节数据
   *      size        文件大小
   * }
   */
  public static loadFileAsBytes(
    filePath: string,
    /** 读取完成后的回调函数，接收字节数组和文件大小作为参数 */
    callback: (arrayBuffer: ArrayBuffer, size: number) => void
  ): void {
    fetch(filePath)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => callback(arrayBuffer, arrayBuffer.byteLength));
  }

  /**
   * 获取增量时间（与上一帧的时间差）
   * @return 增量时间 [ms]
   */
  public static getDeltaTime(): number {
    return this.deltaTime;
  }

  public static updateTime(): void {
    this.currentFrame = Date.now();
    this.deltaTime = (this.currentFrame - this.lastFrame) / 1000;
    this.lastFrame = this.currentFrame;
  }

  /**
   * 输出消息
   */
  public static printMessage(...args): void {
    if (LAppDefine.DebugLogEnable) {
      console.log(...args);
    }
  }

  static lastUpdate = Date.now();

  static currentFrame = 0.0;
  static lastFrame = 0.0;
  static deltaTime = 0.0;
}
