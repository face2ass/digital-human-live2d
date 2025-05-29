/**
 * Copyright(c) Live2D Inc. 版权所有。
 *
 * 使用此源代码受Live2D开源软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

import { LAppMotionSyncDelegateParent } from './lappmotionsyncdelegateparent';
import { LAppPal } from './SampleSrc/lapppal';
import { LAppInputDevice } from './lappinputdevice';

export let s_instance: LAppMotionSyncDelegate = null;

/**
 * 应用程序类。
 * 负责管理Cubism SDK。
 */
export class LAppMotionSyncDelegate extends LAppMotionSyncDelegateParent {
  /**
   * 返回类的实例（单例模式）。
   * 若实例尚未创建，则在内部创建实例。
   *
   * @return 类的实例
   */
  public static getInstance(): LAppMotionSyncDelegate {
    if (s_instance == null) {
      s_instance = new LAppMotionSyncDelegate();
    }

    return s_instance;
  }

  /**
   * 释放类的实例（单例模式）。
   */
  public static releaseInstance(): void {
    if (s_instance != null) {
      s_instance.release();
    }

    s_instance = null;
  }

  /**
   * 执行处理。
   */
  public run(): void {
    // 主循环
    const loop = (): void => {
      // 检查实例是否存在
      if (s_instance == null) {
        return;
      }

      // 更新时间
      LAppPal.updateTime();

      for (let i = 0; i < this._subdelegates.getSize(); i++) {
        this._subdelegates.at(i).update();
      }

      // 所有子委托都接收缓冲区后，清空缓冲区
      LAppInputDevice.getInstance().reset();

      // 递归调用以实现循环
      requestAnimationFrame(loop);
    };
    loop();
  }
}
