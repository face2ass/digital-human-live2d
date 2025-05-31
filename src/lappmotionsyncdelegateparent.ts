/**
 * Copyright(c) Live2D Inc. 版权所有。
 *
 * 使用此源代码受Live2D开源软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

import { CubismFramework, Option } from '@framework/live2dcubismframework';
import { csmVector } from '@framework/type/csmvector';

import * as LAppDefine from './SampleSrc/lappdefine';
import * as LAppMotionSyncDefine from './lappmotionsyncdefine';
import { LAppPal } from './SampleSrc/lapppal';
import {
  CubismMotionSync,
  MotionSyncOption
} from '@motionsyncframework/live2dcubismmotionsync';
import { LAppMotionSyncSubdelegate } from './lappmotionsyncsubdelegate';
import { CubismLogError } from '@framework/utils/cubismdebug';
import {LAppInputDevice, TTSAudioBufferProvider} from './lappinputdevice';
import { type ILAppAudioBufferProvider } from './lappiaudiobufferprovider';
import {s_instance} from "./SampleSrc/lappdelegate.ts";

/**
 * 应用程序类。
 * 负责管理Cubism SDK。
 */

export abstract class LAppMotionSyncDelegateParent {
  /**
   * 鼠标按下时调用。
   */
  private onMouseBegan(e: MouseEvent): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointBegan(e.pageX, e.pageY);
    }
  }

  /**
   * 指针移动时调用。
   */
  private onMouseMoved(e: MouseEvent): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointMoved(e.pageX, e.pageY);
    }
  }

  /**
   * 鼠标松开时调用。
   */
  private onMouseEnded(e: MouseEvent): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointEnded(e.pageX, e.pageY);
    }
  }

  /**
   * 触摸按下时调用。
   */
  private onTouchBegan(e: TouchEvent): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointBegan(e.touches[0].pageX, e.touches[0].pageY);
    }
  }

  /**
   * 触摸移动时调用。
   */
  private onTouchMoved(e: TouchEvent): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointMoved(e.touches[0].pageX, e.touches[0].pageY);
    }
  }

  /**
   * 触摸松开时调用。
   */
  private onTouchEnded(e: TouchEvent): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointEnded(e.touches[0].pageX, e.touches[0].pageY);
    }
  }

  /**
   * 触摸取消时调用。
   */
  private onTouchCancel(e: TouchEvent): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onTouchCancel(e.touches[0].pageX, e.touches[0].pageY);
    }
  }

  /**
   * 调整画布大小并重新初始化视图。
   */
  public onResize(): void {
    for (let i = 0; i < this._subdelegates.getSize(); i++) {
      this._subdelegates.at(i).onResize();
    }
  }

  /**
   * 释放资源。
   */
  public release(): void {
    this.releaseEventListener();
    this.releaseSubdelegates();

    // 释放Cubism SDK
    CubismFramework.dispose();
    CubismMotionSync.dispose();

    this._cubismOption = null;
    this._cubismMotionSyncOption = null;
  }

  /**
   * 执行处理。
   */
  public abstract run(): void;

  /**
   * 移除事件监听器。
   */
  private releaseEventListener(): void {
    if (this.touchCancelEventListener != null) {
      document.removeEventListener(
        'pointerdown',
        this.touchCancelEventListener
      );
      this.touchCancelEventListener = null;
    }
    document.removeEventListener('pointerdown', this.pointEndedEventListener);
    this.pointEndedEventListener = null;
    document.removeEventListener('pointerdown', this.pointMovedEventListener);
    this.pointMovedEventListener = null;
    document.removeEventListener('pointerdown', this.pointBeganEventListener);
    this.pointBeganEventListener = null;
  }

  /**
   * 释放子委托。
   */
  private releaseSubdelegates(): void {
    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().release();
    }

    this._subdelegates.clear();
    this._subdelegates = null;
  }

  /**
   * 初始化应用所需资源。
   */
  public initialize(): boolean {
    // 初始化Cubism SDK
    this.initializeCubism();

    this.initializeSubdelegates();
    this.initializeEventListener();

    // TODO 初始化输入设备
    // LAppInputDevice.getInstance().initialize();
    TTSAudioBufferProvider.getInstance().initialize();

    return true;
  }

  /**
   * 设置事件监听器。
   */
  private initializeEventListener(): void {
    const supportTouch: boolean = 'touchcancel' in document;
    const ele = this._canvases.at(0) // TODO LAppDefine.CanvasNum是1
    if (supportTouch) {
      this.pointBeganEventListener = this.onTouchBegan.bind(this);
      this.pointMovedEventListener = this.onTouchMoved.bind(this);
      this.pointEndedEventListener = this.onTouchEnded.bind(this);
      this.touchCancelEventListener = this.onTouchCancel.bind(this);

      // 注册触摸相关回调函数
      ele.addEventListener('touchdown', this.pointBeganEventListener, {
        passive: true
      });
      ele.addEventListener('touchmove', this.pointMovedEventListener, {
        passive: true
      });
      ele.addEventListener('touchup', this.pointEndedEventListener, {
        passive: true
      });
      ele.addEventListener('touchcancel', this.touchCancelEventListener, {
        passive: true
      });
    } else {
      // 注册鼠标相关回调函数
      this.pointBeganEventListener = this.onMouseBegan.bind(this);
      this.pointMovedEventListener = this.onMouseMoved.bind(this);
      this.pointEndedEventListener = this.onMouseEnded.bind(this);

      ele.addEventListener('mousedown', this.pointBeganEventListener, {
        passive: true
      });
      ele.addEventListener('mousemove', this.pointMovedEventListener, {
        passive: true
      });
      ele.addEventListener('mouseup', this.pointEndedEventListener, {
        passive: true
      });
    }
  }

  /**
   * 创建并配置画布，初始化子委托。
   */
  private initializeSubdelegates(): void {
    let width: number = 100;
    let height: number = 100;
    if (LAppDefine.CanvasNum > 3) {
      const widthunit: number = Math.ceil(Math.sqrt(LAppDefine.CanvasNum));
      const heightUnit = Math.ceil(LAppDefine.CanvasNum / widthunit);
      width = 100.0 / widthunit;
      height = 100.0 / heightUnit;
    } else {
      width = 100.0 / LAppDefine.CanvasNum;
    }

    this._canvases.prepareCapacity(LAppDefine.CanvasNum);
    this._subdelegates.prepareCapacity(LAppDefine.CanvasNum);
    for (let i = 0; i < LAppDefine.CanvasNum; i++) {
      const canvas = document.createElement('canvas');
      this._canvases.pushBack(canvas);
      canvas.style.width = `${width}vw`;
      canvas.style.height = `${height}vh`;

      // 将画布添加到DOM中
      document.querySelector(this._cvsWrapSelector).appendChild(canvas);
    }

    for (let i = 0; i < this._canvases.getSize(); i++) {
      const subdelegate = new LAppMotionSyncSubdelegate();
      subdelegate._useMicrophone =
        i == LAppMotionSyncDefine.UseMicrophoneCanvas;
      subdelegate.initialize(this._canvases.at(i));
      this._subdelegates.pushBack(subdelegate);
    }

    for (let i = 0; i < LAppDefine.CanvasNum; i++) {
      if (this._subdelegates.at(i).isContextLost()) {
        CubismLogError(
          `索引为 ${i} 的画布上下文丢失，可能是因为达到了 WebGLRenderingContext 的获取限制。`
        );
      }
    }
  }

  /**
   * 私有构造函数
   */
  protected constructor() {
    this._cubismOption = new Option();
    this._cubismMotionSyncOption = new MotionSyncOption();
    this._subdelegates = new csmVector<LAppMotionSyncSubdelegate>();
    this._canvases = new csmVector<HTMLCanvasElement>();
  }

  /**
   * 初始化Cubism SDK
   */
  public initializeCubism(): void {
    LAppPal.updateTime();

    // 设置Cubism
    this._cubismOption.logFunction = LAppPal.printMessage;
    this._cubismOption.loggingLevel = LAppDefine.CubismLoggingLevel;
    CubismFramework.startUp(this._cubismOption);

    // 设置动作同步
    this._cubismMotionSyncOption.logFunction = LAppPal.printMessage;
    this._cubismMotionSyncOption.loggingLevel = LAppDefine.CubismLoggingLevel;
    CubismMotionSync.startUp(this._cubismMotionSyncOption);

    // 初始化Cubism
    CubismFramework.initialize();
    CubismMotionSync.initialize();
  }

  /**
   * Cubism SDK 选项
   */
  private _cubismOption: Option;

  /**
   * Cubism SDK 动作同步选项
   */
  private _cubismMotionSyncOption: MotionSyncOption;

  /**
   * 操作对象的画布元素
   */
  private _canvases: csmVector<HTMLCanvasElement>;

  /**
   * 子委托
   */
  protected _subdelegates: csmVector<LAppMotionSyncSubdelegate>;

  /**
   * 提供音频数据的实例
   */
  protected _audioBufferProvider: ILAppAudioBufferProvider;

  _cvsWrapSelector: string = "#live2d-cvs";

  /**
   * 已注册的事件监听器函数对象
   */
  private pointBeganEventListener: (
    this: Document,
    ev: MouseEvent | TouchEvent
  ) => void;

  /**
   * 已注册的事件监听器函数对象
   */
  private pointMovedEventListener: (
    this: Document,
    ev: MouseEvent | TouchEvent
  ) => void;

  /**
   * 已注册的事件监听器函数对象
   */
  private pointEndedEventListener: (
    this: Document,
    ev: MouseEvent | TouchEvent
  ) => void;

  /**
   * 已注册的事件监听器函数对象
   */
  private touchCancelEventListener: (
    this: Document,
    ev: MouseEvent | TouchEvent
  ) => void;
}
