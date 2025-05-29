/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismModel } from '../model/cubismmodel';
import { ACubismMotion } from './acubismmotion';
import {
  type CubismMotionQueueEntryHandle,
  CubismMotionQueueManager
} from './cubismmotionqueuemanager';

/**
 * 动画的管理
 *
 * 进行动画管理的类
 */
export class CubismMotionManager extends CubismMotionQueueManager {
  /**
   * 构造函数
   */
  public constructor() {
    super();
    this._currentPriority = 0;
    this._reservePriority = 0;
  }

  /**
   * 获取正在播放的动画的优先级
   * @return  动画的优先级
   */
  public getCurrentPriority(): number {
    return this._currentPriority;
  }

  /**
   * 获取预约中的动画的优先级。
   * @return  动画的优先级
   */
  public getReservePriority(): number {
    return this._reservePriority;
  }

  /**
   * 设置预约中的动画的优先级。
   * @param   val     优先级
   */
  public setReservePriority(val: number): void {
    this._reservePriority = val;
  }

  /**
   * 设置优先级并开始播放动画。
   *
   * @param motion          动画
   * @param autoDelete      如果播放结束后删除动画的实例则为true
   * @param priority        优先级
   * @return                返回开始播放的动画的识别编号。用于判断单个动画是否结束的IsFinished()的参数。无法开始时为「-1」
   */
  public startMotionPriority(
    motion: ACubismMotion,
    autoDelete: boolean,
    priority: number
  ): CubismMotionQueueEntryHandle {
    if (priority == this._reservePriority) {
      this._reservePriority = 0; // 取消预约
    }

    this._currentPriority = priority; // 设置正在播放的动画的优先级

    return super.startMotion(motion, autoDelete);
  }

  /**
   * 更新动画，并将参数值反映到模型上。
   *
   * @param model   目标模型
   * @param deltaTimeSeconds    时间增量[秒]
   * @return  true    已更新
   * @return  false   未更新
   */
  public updateMotion(model: CubismModel, deltaTimeSeconds: number): boolean {
    this._userTimeSeconds += deltaTimeSeconds;

    const updated: boolean = super.doUpdateMotion(model, this._userTimeSeconds);

    if (this.isFinished()) {
      this._currentPriority = 0; // 解除正在播放的动画的优先级
    }

    return updated;
  }

  /**
   * 预约动画。
   *
   * @param   priority    优先级
   * @return  true    预约成功
   * @return  false   预约失败
   */
  public reserveMotion(priority: number): boolean {
    if (priority <= this._reservePriority || priority <= this._currentPriority) {
      return false;
    }

    this._reservePriority = priority;

    return true;
  }

  _currentPriority: number; // 当前正在播放的动画的优先级
  _reservePriority: number; // 计划播放的动画的优先级。播放中时为0。这是在另一个线程中加载动画文件时的功能。
}

// Namespace definition for compatibility.
import * as $ from './cubismmotionmanager';
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const CubismMotionManager = $.CubismMotionManager;
  export type CubismMotionManager = $.CubismMotionManager;
}
