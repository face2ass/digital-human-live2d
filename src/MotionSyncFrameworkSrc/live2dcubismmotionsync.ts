/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LogLevel } from '@framework/live2dcubismframework';
import { CubismModel } from '@framework/model/cubismmodel';
import { csmVector } from '@framework/type/csmvector';
import {
  CSM_ASSERT,
  CubismLogInfo,
  CubismLogWarning
} from '@framework/utils/cubismdebug';
import { CubismMath } from '@framework/math/cubismmath';
import {
  CubismMotionSyncData,
  CubismMotionSyncDataSetting
} from './cubismmotionsyncdata';
import { CubismMotionSyncEngineAnalysisResult } from './cubismmotionsyncengineanalysisresult';
import { CubismMotionSyncEngineController } from './cubismmotionsyncenginecontroller';
import { CubismMotionSyncEngineCri } from './cubismmotionsyncenginecri';
import { CubismMotionSyncProcessorCRI } from './cubismmotionsyncprocessorcri';
import { EngineType } from './cubismmotionsyncutil';
import { ICubismMotionSyncEngine } from './icubismmotionsyncengine';
import { ICubismMotionSyncProcessor } from './icubismmotionsyncprocessor';

// 初始化文件作用域的变量

let s_isStarted = false;
let s_isInitialized = false;
let s_option: MotionSyncOption = null;
let s_engineConfigCriData: MotionSyncEngineConfigCriData = null;
const s_engineConfigStructSize = 2;

export class CubismMotionSync {
  /**
   * 使 Cubism MotionSync Framework 的 API 可用。
   * 在执行 API 前必须先执行此函数。
   * 一旦准备完成，之后再次执行该函数，内部处理会被跳过。
   *
   * @param    option      MotionSyncLogOption 类的实例
   *
   * @return   准备处理完成则返回 true。
   */
  public static startUp(option: MotionSyncOption = null): boolean {
    if (s_isStarted) {
      CubismLogInfo('CubismMotionSyncFramework.startUp() is already done.');
      return s_isStarted;
    }

    s_option = option;

    if (s_option != null) {
      Live2DCubismMotionSyncCore.Logging.csmMotionSyncSetLogFunction(
        s_option.logFunction
      );
    }

    s_isStarted = true;

    CubismLogInfo('CubismMotionSyncFramework.startUp() is complete.');
    return s_isStarted;
  }

  /**
   * 检查 Cubism MotionSync Framework 是否已启动。
   *
   * @return 如果 Framework 已启动则返回 true。
   */
  public static isStarted(): boolean {
    return s_isStarted;
  }

  /**
   * 清除 StartUp() 初始化的 Cubism MotionSync Framework 的各参数。
   * 请在重新使用已调用 Dispose() 的 Cubism MotionSync Framework 时使用。
   */
  public static cleanUp(): void {
    s_isStarted = false;
    s_isInitialized = false;
    s_option = null;
  }

  /**
   * 初始化 Cubism MotionSync Framework 内的资源，使模型进入可显示状态。
   * 若要再次调用 Initialize()，必须先执行 Dispose()。
   */
  public static initialize(): void {
    CSM_ASSERT(s_isStarted);
    if (!s_isStarted) {
      CubismLogWarning('CubismMotionSyncFramework is not started.');
      return;
    }

    // --- 通过 s_isInitialized 防止重复初始化 ---
    // 避免连续进行资源分配。
    // 若要再次调用 Initialize()，必须先执行 Dispose()。
    if (s_isInitialized) {
      CubismLogWarning(
        'CubismMotionSyncFramework.initialize() skipped, already initialized.'
      );
      return;
    }

    s_isInitialized = true;

    CubismLogInfo('CubismMotionSyncFramework.initialize() is complete.');
  }

  /**
   * 释放 Cubism MotionSync Framework 内的所有资源。
   * 不过，对于外部分配的资源不会进行释放。
   * 需在外部进行适当的销毁处理。
   */
  public static dispose(): void {
    CSM_ASSERT(s_isStarted);
    if (!s_isStarted) {
      CubismLogWarning('CubismMotionSyncFramework is not started.');
      return;
    }

    // --- 通过 s_isInitialized 防止未初始化就释放资源 ---
    // 若要调用 dispose()，必须先执行 initialize()。
    if (!s_isInitialized) {
      // false... 资源未分配的情况
      CubismLogWarning(
        'CubismMotionSyncFramework.dispose() skipped, not initialized.'
      );
      return;
    }

    s_isInitialized = false;

    CubismLogInfo('CubismMotionSyncFramework.dispose() is complete.');
  }

  /**
   * Cubism MotionSync Framework 的 API 是否准备好可供使用。
   * @return 如果 API 准备好可供使用则返回 true。
   */
  public static isStarted(): boolean {
    return s_isStarted;
  }

  /**
   * Cubism MotionSync Framework 的资源是否已经完成初始化。
   * @return 如果资源分配完成则返回 true。
   */
  public static isInitialized(): boolean {
    return s_isInitialized;
  }

  public static create(
    model: CubismModel,
    buffer: ArrayBuffer,
    size: number,
    samplePerSec: number
  ): CubismMotionSync {
    if (!CubismMotionSync.isInitialized()) {
      return;
    }

    const data: CubismMotionSyncData = CubismMotionSyncData.create(
      model,
      buffer,
      size
    );

    if (!data) {
      return null;
    }

    const processorList: csmVector<ICubismMotionSyncProcessor> =
      new csmVector<ICubismMotionSyncProcessor>();

    for (let index = 0; index < data.getSettingCount(); index++) {
      let processor: ICubismMotionSyncProcessor = null;
      const engineType: EngineType = data.getSetting(index).analysisType;
      switch (engineType) {
        case EngineType.EngineType_Cri:
          processor = this.InitializeEngineCri(
            engineType,
            data,
            index,
            samplePerSec
          );
          break;
        default:
          CubismLogWarning(
            '[CubismMotionSync.Create] Index{0}: Can not create processor because `AnalysisType` is unknown.',
            index
          );
          break;
      }

      if (processor != null) {
        processorList.pushBack(processor);
      }
    }

    return new CubismMotionSync(model, data, processorList);
  }

  private static InitializeEngineCri(
    engineType: EngineType,
    data: CubismMotionSyncData,
    index: number,
    samplePerSec: number
  ): CubismMotionSyncProcessorCRI {
    let engine: ICubismMotionSyncEngine =
      CubismMotionSyncEngineController.getEngine(engineType);

    if (s_option.engineConfig != null) {
      s_engineConfigCriData = new MotionSyncEngineConfigCriData();
      s_engineConfigCriData.engineConfigBuffer = new Int32Array(
        s_engineConfigStructSize
      );
      s_engineConfigCriData.engineConfigPtr =
        Live2DCubismMotionSyncCore.ToPointer.Malloc(
          s_engineConfigCriData.engineConfigBuffer.length *
          s_engineConfigCriData.engineConfigBuffer.BYTES_PER_ELEMENT
        );
      Live2DCubismMotionSyncCore.ToPointer.ConvertEngineConfigCriToInt32Array(
        s_engineConfigCriData.engineConfigBuffer,
        s_engineConfigCriData.engineConfigPtr,
        s_option.engineConfig.Allocator,
        s_option.engineConfig.Deallocator
      );
    }

    const configPtr: number =
      s_engineConfigCriData != null ? s_engineConfigCriData.engineConfigPtr : 0;
    if (!engine) {
      engine = CubismMotionSyncEngineController.initializeEngine(configPtr);
    }

    let processor: CubismMotionSyncProcessorCRI = null;
    if (engine) {
      processor = (engine as CubismMotionSyncEngineCri).CreateProcessor(
        data.getSetting(index).cubismParameterList.getSize(),
        data.getMappingInfoList(index),
        samplePerSec
      );
    }

    return processor;
  }

  public static delete(instance: CubismMotionSync): void {
    if (!CubismMotionSync.isInitialized()) {
      return;
    }
    instance = void 0;
    instance = null;
  }

  public setSoundBuffer(
    processIndex: number,
    buffer: csmVector<number>,
    startIndex: number
  ): void {
    if (!CubismMotionSync.isInitialized()) {
      return;
    }
    if (processIndex < this._processorInfoList.getSize()) {
      this._processorInfoList.at(processIndex)._sampleBuffer = buffer;
      this._processorInfoList.at(processIndex)._sampleBufferIndex = startIndex;
    }
  }

  public release(): void {
    if (!CubismMotionSync.isInitialized()) {
      return;
    }
    CubismMotionSyncData.delete(this._data);
    for (let index = 0; index < this._processorInfoList.getSize(); index++) {
      this._processorInfoList.at(index)._processor?.Close();
    }
  }

  public updateParameters(model: CubismModel, deltaTimeSeconds: number) {
    if (!CubismMotionSync.isInitialized()) {
      return;
    }
    // 从设置中更改时间时，经过时间可能会变为负数，因此将经过时间设为 0 进行处理。
    if (deltaTimeSeconds < 0.0) {
      deltaTimeSeconds = 0.0;
    }

    for (
      let processIndex = 0;
      processIndex < this._processorInfoList.getSize();
      processIndex++
    ) {
      this._processorInfoList.at(processIndex)._currentRemainTime +=
        deltaTimeSeconds;

      // 假设可能已更新，每次都进行检查。
      const fps: number = this._processorInfoList.at(processIndex)._sampleRate;
      const processorDeltaTime: number = 1.0 / fps;

      this._processorInfoList.at(processIndex)._lastTotalProcessedCount = 0;

      // 如果未达到指定的帧时间，则不进行分析。
      if (
        this._processorInfoList.at(processIndex)._currentRemainTime <
        processorDeltaTime
      ) {
        for (
          let targetIndex = 0;
          targetIndex <
          this._data.getSetting(processIndex).cubismParameterList.getSize();
          targetIndex++
        ) {
          if (
            isNaN(
              this._processorInfoList
                .at(processIndex)
                ._analysisResult.getValues()[targetIndex]
            ) ||
            this._data
              .getSetting(processIndex)
              .cubismParameterList.at(targetIndex).parameterIndex < 0
          ) {
            continue;
          }

          // 每帧覆盖参数值，防止数据自我替换
          model.setParameterValueByIndex(
            this._data
              .getSetting(processIndex)
              .cubismParameterList.at(targetIndex).parameterIndex,
            this._processorInfoList
              .at(processIndex)
              ._lastDampedList.at(targetIndex)
          );
        }
        continue;
      }

      this.analyze(model, processIndex);

      // 重置计数器。
      this._processorInfoList.at(processIndex)._currentRemainTime =
        CubismMath.mod(
          this._processorInfoList.at(processIndex)._currentRemainTime,
          processorDeltaTime
        );

      for (
        let targetIndex = 0;
        targetIndex <
        this._data.getSetting(processIndex).cubismParameterList.getSize();
        targetIndex++
      ) {
        if (
          isNaN(
            this._processorInfoList
              .at(processIndex)
              ._analysisResult.getValues()[targetIndex]
          ) ||
          this._data
            .getSetting(processIndex)
            .cubismParameterList.at(targetIndex).parameterIndex < 0
        ) {
          continue;
        }
        // 每帧覆盖参数值，防止数据自我替换
        model.setParameterValueByIndex(
          this._data
            .getSetting(processIndex)
            .cubismParameterList.at(targetIndex).parameterIndex,
          this._processorInfoList
            .at(processIndex)
            ._lastDampedList.at(targetIndex)
        );
      }
    }
  }

  private analyze(model: CubismModel, processIndex: number): void {
    if (!CubismMotionSync.isInitialized()) {
      return;
    }
    const processor: ICubismMotionSyncProcessor =
      this._processorInfoList.at(processIndex)._processor;
    const samples: csmVector<number> =
      this._processorInfoList.at(processIndex)._sampleBuffer;
    let beginIndex: number =
      this._processorInfoList.at(processIndex)._sampleBufferIndex;

    if (
      processor == null ||
      this._processorInfoList.at(processIndex)._sampleBuffer == null
    ) {
      return;
    }

    let analysisResult: CubismMotionSyncEngineAnalysisResult = null;

    const blendRatio: number =
      this._processorInfoList.at(processIndex)._blendRatio;
    const smoothing: number =
      this._processorInfoList.at(processIndex)._smoothing;
    const audioLevelEffectRatio: number =
      this._processorInfoList.at(processIndex)._audioLevelEffectRatio;

    const samplesSize = samples.getSize();
    let requireSampleCount = processor.getRequireSampleCount();

    for (let i = 0; i < samplesSize; i += requireSampleCount) {
      if (
        samplesSize == 0 ||
        samplesSize <= beginIndex ||
        samplesSize - beginIndex < processor.getRequireSampleCount()
      ) {
        break;
      }

      switch (processor.getType()) {
        case EngineType.EngineType_Cri:
          analysisResult = (processor as CubismMotionSyncProcessorCRI).Analyze(
            samples,
            beginIndex,
            blendRatio,
            smoothing,
            audioLevelEffectRatio,
            this._processorInfoList.at(processIndex)._analysisResult
          );
          break;
        default:
          break;
      }

      if (!analysisResult) {
        break;
      }

      const processedCount = analysisResult.getProcessedSampleCount();
      beginIndex += processedCount;

      this._processorInfoList.at(processIndex)._lastTotalProcessedCount +=
        processedCount;

      // 将动作同步库计算的内容反映到模型上
      for (
        let targetIndex = 0;
        targetIndex <
        this._data.getSetting(processIndex).cubismParameterList.getSize();
        targetIndex++
      ) {
        let cacheValue: number = analysisResult.getValues()[targetIndex];

        if (isNaN(cacheValue)) {
          continue;
        }

        const smooth: number = this._data
          .getSetting(processIndex)
          .cubismParameterList.at(targetIndex).smooth;
        const damper: number = this._data
          .getSetting(processIndex)
          .cubismParameterList.at(targetIndex).damper;

        // 平滑处理
        cacheValue =
          ((100.0 - smooth) * cacheValue +
            this._processorInfoList
              .at(processIndex)
              ._lastSmoothedList.at(targetIndex) *
            smooth) /
          100.0;
        this._processorInfoList
          .at(processIndex)
          ._lastSmoothedList.set(targetIndex, cacheValue);

        // 阻尼处理
        if (
          Math.abs(
            cacheValue -
            this._processorInfoList
              .at(processIndex)
              ._lastDampedList.at(targetIndex)
          ) < damper
        ) {
          cacheValue = this._processorInfoList
            .at(processIndex)
            ._lastDampedList.at(targetIndex);
        }
        this._processorInfoList
          .at(processIndex)
          ._lastDampedList.set(targetIndex, cacheValue);
      }

      requireSampleCount = processor.getRequireSampleCount();
    }
  }

  public setBlendRatio(processIndex: number, blendRatio: number): void {
    if (!CubismMotionSync.isInitialized()) {
      return;
    }
    if (processIndex < this._processorInfoList.getSize()) {
      this._processorInfoList.at(processIndex)._blendRatio = blendRatio;
    }
  }

  public SetSmoothing(processIndex: number, smoothing: number): void {
    if (!CubismMotionSync.isInitialized()) {
      return;
    }
    if (processIndex < this._processorInfoList.getSize()) {
      this._processorInfoList.at(processIndex)._smoothing = smoothing;
    }
  }

  public SetSampleRate(processIndex: number, sampleRate: number): void {
    if (!CubismMotionSync.isInitialized()) {
      return;
    }
    if (processIndex < this._processorInfoList.getSize()) {
      this._processorInfoList.at(processIndex)._sampleRate = sampleRate;
    }
  }

  public getData(): CubismMotionSyncData {
    return this._data;
  }

  public getLastTotalProcessedCount(processIndex: number): number {
    return this._processorInfoList.at(processIndex)._lastTotalProcessedCount;
  }

  private constructor(
    model: CubismModel,
    data: CubismMotionSyncData,
    processorList: csmVector<ICubismMotionSyncProcessor>
  ) {
    this._data = data;
    this._processorInfoList = new csmVector<CubismProcessorInfo>();

    for (let index = 0; index < processorList?.getSize(); index++) {
      this._processorInfoList.pushBack(
        new CubismProcessorInfo(
          processorList.at(index),
          model,
          data.getSetting(index)
        )
      );
      this._processorInfoList.at(index).init(data.getSetting(index));
    }
  }

  private _processorInfoList: csmVector<CubismProcessorInfo>;
  private _data: CubismMotionSyncData;
}

export class MotionSyncOption {
  engineConfig: MotionSyncEngineConfigCri;
  logFunction: Live2DCubismMotionSyncCore.csmMotionSyncLogFunction; // 日志输出的函数对象
  loggingLevel: LogLevel; // 日志输出级别的设置
}

export class MotionSyncEngineConfigCriData {
  engineConfigBuffer: Int32Array;
  engineConfigPtr: number;
}

export class CubismProcessorInfo {
  public constructor(
    processor: ICubismMotionSyncProcessor,
    model: CubismModel,
    setting: CubismMotionSyncDataSetting
  ) {
    this._processor = processor;
    this._blendRatio = 0.0;
    this._smoothing = 1;
    this._sampleRate = 30.0;
    this._audioLevelEffectRatio = 0.0;
    this._sampleBuffer = null;
    this._sampleBufferIndex = 0;
    this._model = model;
    this._currentRemainTime = 0.0;
    this._lastTotalProcessedCount = 0;

    this.init(setting);
    this._analysisResult = this._processor.createAnalysisResult();
  }

  public init(setting: CubismMotionSyncDataSetting): void {
    this._currentRemainTime = 0.0;
    this._lastSmoothedList = new csmVector<number>();
    this._lastDampedList = new csmVector<number>();

    for (
      let index = 0;
      index < setting.cubismParameterList.getSize();
      index++
    ) {
      let parameterValue: number = 0;

      // 如果参数存在则获取值
      // 注意：为了使列表索引一致，不执行 continue。
      if (setting.cubismParameterList.at(index).parameterIndex >= 0) {
        parameterValue = this._model.getParameterValueByIndex(
          setting.cubismParameterList.at(index).parameterIndex
        );
      }

      this._lastSmoothedList.pushBack(parameterValue);
      this._lastDampedList.pushBack(parameterValue);
    }

    this._blendRatio = setting.blendRatio;
    this._smoothing = setting.smoothing;
    this._sampleRate = setting.sampleRate;

    this._lastTotalProcessedCount = 0;
  }

  _processor: ICubismMotionSyncProcessor;
  _blendRatio: number;
  _smoothing: number;
  _sampleRate: number;
  _audioLevelEffectRatio: number; // 未使用
  _sampleBuffer: csmVector<number>;
  _sampleBufferIndex: number;
  _model: CubismModel;
  _analysisResult: CubismMotionSyncEngineAnalysisResult;
  _currentRemainTime: number;
  _lastSmoothedList: csmVector<number>;
  _lastDampedList: csmVector<number>;
  _lastTotalProcessedCount: number;
}

// 为兼容而定义命名空间
import * as $ from './live2dcubismmotionsync';
import { type MotionSyncEngineConfig_CRI as MotionSyncEngineConfigCri } from './motionsyncconfig_cri';
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismMotionSyncFramework {
  export const CubismMotionSync = $.CubismMotionSync;
  export type CubismMotionSync = $.CubismMotionSync;
}
