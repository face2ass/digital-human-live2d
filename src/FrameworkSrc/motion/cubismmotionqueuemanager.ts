/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { ACubismMotion } from './acubismmotion';
import { CubismMotionQueueEntry } from './cubismmotionqueueentry';
import { csmVector, iterator } from '../type/csmvector';
import { CubismModel } from '../model/cubismmodel';
import { csmString } from '../type/csmstring';

/**
 * 动画播放的管理
 *
 * 动画播放管理类。用于播放 CubismMotion 动画等 ACubismMotion 的子类。
 *
 * @note 播放过程中若调用 StartMotion() 启动另一个动画，会平滑过渡到新动画，旧动画则会中断。
 *       例如，将表情动画、身体动画等分开制作成动画时，若要同时播放多个动画，需使用多个 CubismMotionQueueManager 实例。
 */
export class CubismMotionQueueManager {
  /**
   * 构造函数
   */
  public constructor() {
    this._userTimeSeconds = 0.0;
    this._eventCallBack = null;
    this._eventCustomData = null;
    this._motions = new csmVector<CubismMotionQueueEntry>();
  }

  /**
   * 析构函数
   */
  public release(): void {
    for (let i = 0; i < this._motions.getSize(); ++i) {
      if (this._motions.at(i)) {
        this._motions.at(i).release();
        this._motions.set(i, null);
      }
    }

    this._motions = null;
  }

  /**
   * 指定动画的启动
   *
   * 启动指定的动画。若已有同类型的动画正在播放，则给现有动画设置结束标志，并开始淡出。
   *
   * @param   motion          要启动的动画
   * @param   autoDelete      若播放结束后删除动画实例，则为 true
   * @param   userTimeSeconds Deprecated: 累计的时间增量值[秒]，函数内未使用，不建议使用。
   * @return                      返回启动动画的识别编号。用于在 IsFinished() 中判断单个动画是否结束。无法启动时返回「-1」
   */
  public startMotion(
    motion: ACubismMotion,
    autoDelete: boolean,
    userTimeSeconds?: number
  ): CubismMotionQueueEntryHandle {
    if (motion == null) {
      return InvalidMotionQueueEntryHandleValue;
    }

    let motionQueueEntry: CubismMotionQueueEntry = null;

    // 若已有动画在播放，则设置结束标志
    for (let i = 0; i < this._motions.getSize(); ++i) {
      motionQueueEntry = this._motions.at(i);
      if (motionQueueEntry == null) {
        continue;
      }

      motionQueueEntry.setFadeOut(motionQueueEntry._motion.getFadeOutTime()); // 淡出设置
    }

    motionQueueEntry = new CubismMotionQueueEntry(); // 结束时销毁
    motionQueueEntry._autoDelete = autoDelete;
    motionQueueEntry._motion = motion;

    this._motions.pushBack(motionQueueEntry);

    return motionQueueEntry._motionQueueEntryHandle;
  }

  /**
   * 确认所有动画是否结束
   * @return true  所有动画均已结束
   * @return false 存在未结束的动画
   */
  public isFinished(): boolean {
    // ------- 执行处理 -------
    // 若已有动画在播放，则设置结束标志

    for (
      let ite: iterator<CubismMotionQueueEntry> = this._motions.begin();
      ite.notEqual(this._motions.end());

    ) {
      let motionQueueEntry: CubismMotionQueueEntry = ite.ptr();

      if (motionQueueEntry == null) {
        ite = this._motions.erase(ite); // 删除
        continue;
      }

      const motion: ACubismMotion = motionQueueEntry._motion;

      if (motion == null) {
        motionQueueEntry.release();
        motionQueueEntry = null;
        ite = this._motions.erase(ite); // 删除
        continue;
        // ... 已有代码 ...
      }

      // ----- 若有已结束的处理则删除 ------
      if (!motionQueueEntry.isFinished()) {
        return false;
      } else {
        ite.preIncrement();
      }
    }

    return true;
  }

  /**
   * 确认指定动画是否结束
   * @param motionQueueEntryNumber 动画的识别编号
   * @return true  动画已结束
   * @return false 动画未结束
   */
  public isFinishedByHandle(
    motionQueueEntryNumber: CubismMotionQueueEntryHandle
  ): boolean {
    for (
      let ite: iterator<CubismMotionQueueEntry> = this._motions.begin();
      ite.notEqual(this._motions.end());
      ite.increment()
    ) {
      const motionQueueEntry: CubismMotionQueueEntry = ite.ptr();

      if (motionQueueEntry == null) {
        continue;
      }

      if (
        motionQueueEntry._motionQueueEntryHandle == motionQueueEntryNumber &&
        !motionQueueEntry.isFinished()
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * 停止所有动画
   */
  public stopAllMotions(): void {
    // ------- 执行处理 -------
    // 若已有动画在播放，则设置结束标志

    for (
      let ite: iterator<CubismMotionQueueEntry> = this._motions.begin();
      ite.notEqual(this._motions.end());

    ) {
      let motionQueueEntry: CubismMotionQueueEntry = ite.ptr();

      if (motionQueueEntry == null) {
        ite = this._motions.erase(ite);

        continue;
      }

      // ----- 若有已结束的处理则删除 ------
      motionQueueEntry.release();
      motionQueueEntry = null;
      ite = this._motions.erase(ite); // 删除
    }
  }

  /**
   * @brief 获取 CubismMotionQueueEntry 数组
   *
   * 获取 CubismMotionQueueEntry 数组。
   *
   * @return  CubismMotionQueueEntry 数组的指针
   * @retval  NULL   未找到
   */
  public getCubismMotionQueueEntries(): csmVector<CubismMotionQueueEntry> {
    return this._motions;
  }

  /**
   * 获取指定的 CubismMotionQueueEntry
   *
   * @param   motionQueueEntryNumber  动画的识别编号
   * @return  指定的 CubismMotionQueueEntry
   * @return  null   未找到
   */
  public getCubismMotionQueueEntry(
    motionQueueEntryNumber: any
  ): CubismMotionQueueEntry {
    //------- 执行处理 -------
    for (
      let ite: iterator<CubismMotionQueueEntry> = this._motions.begin();
      ite.notEqual(this._motions.end());
      ite.preIncrement()
    ) {
      const motionQueueEntry: CubismMotionQueueEntry = ite.ptr();

      if (motionQueueEntry == null) {
        continue;
      }

      if (motionQueueEntry._motionQueueEntryHandle == motionQueueEntryNumber) {
        return motionQueueEntry;
      }
    }

    return null;
  }

  /**
   * 注册接收事件的回调函数
   *
   * @param callback 回调函数
   * @param customData 回调时返回的数据
   */
  public setEventCallback(
    callback: CubismMotionEventFunction,
    customData: any = null
  ): void {
    this._eventCallBack = callback;
    this._eventCustomData = customData;
  }

  /**
   * 更新动画，并将参数值反映到模型上。
   *
   * @param   model   目标模型
   * @param   userTimeSeconds   累计的时间增量值[秒]
   * @return  true    已将参数值反映到模型上
   * @return  false   未将参数值反映到模型上（动画无变化）
   */
  public doUpdateMotion(model: CubismModel, userTimeSeconds: number): boolean {
    let updated = false;

    // ------- 执行处理 --------
    // 若已有动画在播放，则设置结束标志

    for (
      let ite: iterator<CubismMotionQueueEntry> = this._motions.begin();
      ite.notEqual(this._motions.end());

    ) {
      let motionQueueEntry: CubismMotionQueueEntry = ite.ptr();

      if (motionQueueEntry == null) {
        ite = this._motions.erase(ite); // 删除
        continue;
      }

      const motion: ACubismMotion = motionQueueEntry._motion;

      if (motion == null) {
        motionQueueEntry.release();
        motionQueueEntry = null;
        ite = this._motions.erase(ite); // 删除

        continue;
      }

      // ------ 反映值 ------
      motion.updateParameters(model, motionQueueEntry, userTimeSeconds);
      updated = true;

      // ------ 检查用户触发事件 ----
      const firedList: csmVector<csmString> = motion.getFiredEvent(
        motionQueueEntry.getLastCheckEventSeconds() -
        motionQueueEntry.getStartTime(),
        userTimeSeconds - motionQueueEntry.getStartTime()
      );

      for (let i = 0; i < firedList.getSize(); ++i) {
        this._eventCallBack(this, firedList.at(i), this._eventCustomData);
      }

      motionQueueEntry.setLastCheckEventSeconds(userTimeSeconds);

      // ------ 若有已结束的处理则删除 ------
      if (motionQueueEntry.isFinished()) {
        motionQueueEntry.release();
        motionQueueEntry = null;
        ite = this._motions.erase(ite); // 删除
      } else {
        if (motionQueueEntry.isTriggeredFadeOut()) {
          motionQueueEntry.startFadeOut(
            motionQueueEntry.getFadeOutSeconds(),
            userTimeSeconds
          );
        }
        ite.preIncrement();
      }
    }

    return updated;
  }
  _userTimeSeconds: number; // 累计的时间增量值[秒]

  _motions: csmVector<CubismMotionQueueEntry>; // 动画
  _eventCallBack: CubismMotionEventFunction; // 回调函数
  _eventCustomData: any; // 回调时返回的数据
}

/**
 * 定义事件回调函数
 *
 * 可注册到事件回调中的函数类型信息
 * @param caller        触发事件播放的 CubismMotionQueueManager
 * @param eventValue    触发事件的字符串数据
 * @param customData   注册时指定的回调返回数据
 */
export interface CubismMotionEventFunction {
  (
    caller: CubismMotionQueueManager,
    eventValue: csmString,
    customData: any
  ): void;
}

/**
 * 动画的识别编号
 *
 * 动画识别编号的定义
 */
export declare type CubismMotionQueueEntryHandle = any;
export const InvalidMotionQueueEntryHandleValue: CubismMotionQueueEntryHandle =
  -1;

// Namespace definition for compatibility.
import * as $ from './cubismmotionqueuemanager';
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const CubismMotionQueueManager = $.CubismMotionQueueManager;
  export type CubismMotionQueueManager = $.CubismMotionQueueManager;
  export const InvalidMotionQueueEntryHandleValue =
    $.InvalidMotionQueueEntryHandleValue;
  export type CubismMotionQueueEntryHandle = $.CubismMotionQueueEntryHandle;
  export type CubismMotionEventFunction = $.CubismMotionEventFunction;
}