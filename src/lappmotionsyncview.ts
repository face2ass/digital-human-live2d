/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { CubismViewMatrix } from '@framework/math/cubismviewmatrix';
import * as LAppDefine from './SampleSrc/lappdefine';
import * as LAppMotionSyncDefine from './lappmotionsyncdefine';
import { LAppMotionSyncSprite } from './lappmotionsyncsprite';
import { TextureInfo } from './SampleSrc/lapptexturemanager';
import { LAppPal } from './SampleSrc/lapppal';
import { TouchManager } from './SampleSrc/touchmanager';
import { LAppMotionSyncSubdelegate } from './lappmotionsyncsubdelegate';

/**
 * 绘制类。
 */
export class LAppMotionSyncView {
  /**
   * 构造函数
   */
  public constructor() {
    this._programId = null;
    this._back = null;
    this._gear = null;
    this._fastForward = null;

    // 触摸相关的事件管理
    this._touchManager = new TouchManager();

    // 用于将设备坐标转换为屏幕坐标
    this._deviceToScreen = new CubismMatrix44();

    // 用于进行画面显示的缩放和移动转换的矩阵
    this._viewMatrix = new CubismViewMatrix();
  }

  /**
   * 初始化。
   */
  public initialize(subdelegate: LAppMotionSyncSubdelegate): void {
    this._subdelegate = subdelegate;
    const { width, height } = subdelegate.getCanvas();

    const ratio: number = width / height;
    const left: number = -ratio;
    const right: number = ratio;
    const bottom: number = LAppDefine.ViewLogicalLeft;
    const top: number = LAppDefine.ViewLogicalRight;

    // 对应设备的屏幕范围。X轴左端、X轴右端、Y轴下端、Y轴上端
    this._viewMatrix.setScreenRect(left, right, bottom, top);
    this._viewMatrix.scale(LAppDefine.ViewScale, LAppDefine.ViewScale);

    this._deviceToScreen.loadIdentity();
    if (width > height) {
      const screenW: number = Math.abs(right - left);
      this._deviceToScreen.scaleRelative(screenW / width, -screenW / width);
    } else {
      const screenH: number = Math.abs(top - bottom);
      this._deviceToScreen.scaleRelative(screenH / height, -screenH / height);
    }
    this._deviceToScreen.translateRelative(-width * 0.5, -height * 0.5);

    // 显示范围的设置
    this._viewMatrix.setMaxScale(LAppDefine.ViewMaxScale); // 最大缩放率
    this._viewMatrix.setMinScale(LAppDefine.ViewMinScale); // 最小缩放率

    // 可显示的最大范围
    this._viewMatrix.setMaxScreenRect(
      LAppDefine.ViewLogicalMaxLeft,
      LAppDefine.ViewLogicalMaxRight,
      LAppDefine.ViewLogicalMaxBottom,
      LAppDefine.ViewLogicalMaxTop
    );
  }

  /**
   * 释放资源
   */
  public release(): void {
    this._viewMatrix = null;
    this._touchManager = null;
    this._deviceToScreen = null;

    this._fastForward.release();
    this._fastForward = null;

    this._gear.release();
    this._gear = null;

    this._back.release();
    this._back = null;

    this._subdelegate.getGlManager().getGl().deleteProgram(this._programId);
    this._programId = null;
  }

  /**
   * 绘制。
   */
  public render(): void {
    this._subdelegate.getGlManager().getGl().useProgram(this._programId);

    if (this._back) {
      this._back.render(this._programId);
    }
    if (this._gear) {
      this._gear.render(this._programId);
    }
    if (this._fastForward) {
      this._fastForward.render(this._programId);
    }

    this._subdelegate.getGlManager().getGl().flush();

    const lapplive2dmanager = this._subdelegate.getLive2DManager();
    if (lapplive2dmanager != null) {
      lapplive2dmanager.setViewMatrix(this._viewMatrix);

      lapplive2dmanager.onUpdate();
    }
  }

  /**
   * 进行图像的初始化。
   */
  public initializeSprite(): void {
    const width: number = this._subdelegate.getCanvas().width;
    const height: number = this._subdelegate.getCanvas().height;
    const textureManager = this._subdelegate.getTextureManager();

    const resourcesPath = LAppDefine.ResourcesPath;

    let imageName = '';

    // 背景图像初始化
    imageName = LAppDefine.BackImageName;

    // 由于是异步操作，创建回调函数
    const initBackGroundTexture = (textureInfo: TextureInfo): void => {
      const x: number = width * 0.5;
      const y: number = height * 0.5;

      const fwidth = textureInfo.width * 2.0;
      const fheight = height * 0.95;
      this._back = new LAppMotionSyncSprite(
        x,
        y,
        fwidth,
        fheight,
        textureInfo.id
      );
      this._back.setMotionSyncSubdelegate(this._subdelegate);
    };

    textureManager.createTextureFromPngFile(
      resourcesPath + imageName,
      false,
      initBackGroundTexture
    );

    // 齿轮图像初始化
    imageName = LAppDefine.GearImageName;
    const initGearTexture = (textureInfo: TextureInfo): void => {
      const x = width - textureInfo.width * 0.5;
      const y = height - textureInfo.height * 0.5;
      const fwidth = textureInfo.width;
      const fheight = textureInfo.height;
      this._gear = new LAppMotionSyncSprite(
        x,
        y,
        fwidth,
        fheight,
        textureInfo.id
      );
      this._gear.setMotionSyncSubdelegate(this._subdelegate);
    };

    textureManager.createTextureFromPngFile(
      resourcesPath + imageName,
      false,
      initGearTexture
    );

    // 音频跳转图像初始化
    imageName = LAppMotionSyncDefine.FastForwardImageName;
    const initFastForwardTexture = (textureInfo: TextureInfo): void => {
      const x = textureInfo.width * 0.5;
      const y = height - textureInfo.height * 0.5;
      const fwidth = textureInfo.width;
      const fheight = textureInfo.height;
      this._fastForward = new LAppMotionSyncSprite(
        x,
        y,
        fwidth,
        fheight,
        textureInfo.id
      );
      this._fastForward.setMotionSyncSubdelegate(this._subdelegate);
    };

    textureManager.createTextureFromPngFile(
      resourcesPath + imageName,
      false,
      initFastForwardTexture
    );

    // 创建着色器
    if (this._programId == null) {
      this._programId = this._subdelegate.createShader();
    }
  }

  /**
   * 触摸开始时被调用。
   *
   * @param pointX 屏幕X坐标
   * @param pointY 屏幕Y坐标
   */
  public onTouchesBegan(pointX: number, pointY: number): void {
    this._touchManager.touchesBegan(
      pointX * window.devicePixelRatio,
      pointY * window.devicePixelRatio
    );
  }

  /**
   * 触摸移动时被调用。
   *
   * @param pointX 屏幕X坐标
   * @param pointY 屏幕Y坐标
   */
  public onTouchesMoved(pointX: number, pointY: number): void {
    const posX = pointX * window.devicePixelRatio;
    const posY = pointY * window.devicePixelRatio;

    const lapplive2dmanager = this._subdelegate.getLive2DManager();

    const viewX: number = this.transformViewX(this._touchManager.getX());
    const viewY: number = this.transformViewY(this._touchManager.getY());

    this._touchManager.touchesMoved(posX, posY);

    lapplive2dmanager.onDrag(viewX, viewY);
  }

  /**
   * 触摸结束时被调用。
   *
   * @param pointX 屏幕X坐标
   * @param pointY 屏幕Y坐标
   */
  public onTouchesEnded(pointX: number, pointY: number): void {
    // 触摸结束
    const posX = pointX * window.devicePixelRatio;
    const posY = pointY * window.devicePixelRatio;

    const lapplive2dmanager = this._subdelegate.getLive2DManager();

    // 单指点击
    const x: number = this.transformViewX(posX);
    const y: number = this.transformViewY(posY);

    if (LAppDefine.DebugTouchLogEnable) {
      LAppPal.printMessage(`[APP]touchesEnded x: ${x} y: ${y}`);
    }
    lapplive2dmanager.onTap(x, y);

    // 是否点击了齿轮
    if (this._gear.isHit(posX, posY)) {
      lapplive2dmanager.nextScene();
    }

    // 是否点击了音频跳转
    if (this._fastForward.isHit(posX, posY)) {
      lapplive2dmanager.changeNextIndexSound();
    }
  }

  /**
   * 将X坐标转换为视图坐标。
   *
   * @param deviceX 设备X坐标
   */
  public transformViewX(deviceX: number): number {
    const screenX: number = this._deviceToScreen.transformX(deviceX); // 获取逻辑坐标转换后的坐标。
    return this._viewMatrix.invertTransformX(screenX); // 缩放、移动后的数值。
  }

  /**
   * 将Y坐标转换为视图坐标。
   *
   * @param deviceY 设备Y坐标
   */
  public transformViewY(deviceY: number): number {
    const screenY: number = this._deviceToScreen.transformY(deviceY); // 获取逻辑坐标转换后的坐标。
    return this._viewMatrix.invertTransformY(screenY);
  }

  /**
   * 将X坐标转换为屏幕坐标。
   * @param deviceX 设备X坐标
   */
  public transformScreenX(deviceX: number): number {
    return this._deviceToScreen.transformX(deviceX);
  }

  /**
   * 将Y坐标转换为屏幕坐标。
   *
   * @param deviceY 设备Y坐标
   */
  public transformScreenY(deviceY: number): number {
    return this._deviceToScreen.transformY(deviceY);
  }

  _touchManager: TouchManager; // 触摸管理器
  _deviceToScreen: CubismMatrix44; // 设备到屏幕的转换矩阵
  _viewMatrix: CubismViewMatrix; // 视图矩阵
  _programId: WebGLProgram; // 着色器ID
  _back: LAppMotionSyncSprite; // 背景图像
  _gear: LAppMotionSyncSprite; // 齿轮图像
  _fastForward: LAppMotionSyncSprite; ///< 快进图像
  _changeModel: boolean; // 模型切换标志
  _isClick: boolean; // 点击中
  private _subdelegate: LAppMotionSyncSubdelegate;
}
