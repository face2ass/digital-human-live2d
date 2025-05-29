/**
 * Copyright(c) Live2D Inc. 版权所有。
 *
 * 使用此源代码受Live2D开源软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { csmVector } from '@framework/type/csmvector';

import * as LAppDefine from './SampleSrc/lappdefine';
import * as LAppMotionSyncDefine from './lappmotionsyncdefine';
import { LAppMotionSyncModel } from './lappmotionsyncmodel';
import { LAppPal } from './SampleSrc/lapppal';
import { LAppMotionSyncSubdelegate } from './lappmotionsyncsubdelegate';
import {LAppInputDevice, TTSAudioBufferProvider} from './lappinputdevice';

/**
 * 在示例应用中管理 CubismModel 的类
 * 负责模型的创建与销毁、处理点击事件以及切换模型。
 */
export class LAppMotionSyncLive2DManager {
  /**
   * 释放当前场景中所有的模型
   */
  public releaseAllModel(): void {
    for (let i = 0; i < this._models.getSize(); i++) {
      // 释放模型
      // 同时在内部释放音频缓冲区
      this._models.at(i).release();
      this._models.set(i, null);
    }
    this._models.clear();
  }

  /**
   * 处理屏幕拖动事件
   *
   * @param x 屏幕X坐标
   * @param y 屏幕Y坐标
   */
  public onDrag(x: number, y: number): void {
    const model: LAppMotionSyncModel = this._models.at(0);
    if (model) {
      model.setDragging(x, y);
    }
  }

  /**
   * 处理屏幕点击事件
   *
   * @param x 屏幕X坐标
   * @param y 屏幕Y坐标
   */
  public onTap(x: number, y: number): void {
    LAppPal.printMessage(`[APP]点击位置: {x: ${x.toFixed(2)} y: ${y.toFixed(2)}}`);

    const model: LAppMotionSyncModel = this._models.at(0);

    if (model.hitTest(LAppDefine.HitAreaNameHead, x, y)) {
      LAppPal.printMessage(`[APP]点击头部 ${LAppDefine.HitAreaNameHead}`);
      model.setRandomExpression();
    } else if (model.hitTest(LAppDefine.HitAreaNameBody, x, y)) {
      LAppPal.printMessage(`[APP]点击身体 ${LAppDefine.HitAreaNameBody}`);
      model.startRandomMotion(
        LAppDefine.MotionGroupTapBody,
        LAppDefine.PriorityNormal,
        this.finishedMotion,
        this.beganMotion
      );
    }
  }

  /**
   * 更新画面时的处理
   * 执行模型更新和绘制
   */
  public onUpdate(): void {
    const { width, height } = this._subdelegate.getCanvas();

    const projection: CubismMatrix44 = new CubismMatrix44();
    const model: LAppMotionSyncModel = this._models.at(0);
    let modelScale: number = 1.0;

    if (navigator.userAgent.includes('Mobile')) {
      modelScale = 0.5;
    }

    if (model.getModel()) {
      if (model.getModel().getCanvasWidth() > 1.0 && width < height) {
        // 当横向较长的模型在纵向窗口中显示时，根据模型宽度计算缩放比例
        model.getModelMatrix().setWidth(2.0);
        projection.scale(modelScale, (width / height) * modelScale);
      } else {
        projection.scale((height / width) * modelScale, modelScale);
      }

      // 若有需要，在此处进行矩阵乘法运算
      if (this._viewMatrix != null) {
        projection.multiplyByMatrix(this._viewMatrix);
      }
    }

    model.update();
    model.draw(projection); // 由于是引用传递，projection 会发生变化。
  }

  /**
   * 切换到下一个音频
   */
  public changeNextIndexSound() {
    const model = this._models.at(0);

    if (!model.isSuspendedCurrentSoundContext()) {
      model.stopCurrentSound();

      // 更新索引
      model._soundIndex =
        (model._soundIndex + 1) % model._soundFileList.getSize();
    }
    model.playCurrentSound();
  }

  /**
   * 切换到下一个场景
   * 在示例应用程序中执行模型集的切换
   */
  public nextScene(): void {
    const no: number = (this._sceneIndex + 1) % LAppMotionSyncDefine.ModelDirSize;
    this.changeScene(no);
  }

  /**
   * 切换场景
   * 在示例应用程序中执行模型集的切换
   * @param index 模型的索引
   */
  private changeScene(index: number): void {
    this._sceneIndex = index;
    LAppPal.printMessage(`[APP]模型索引: ${this._sceneIndex}`);

    // 根据 ModelDir[] 中保存的目录名
    // 确定 model3.json 的路径。
    // 需保证目录名和 model3.json 的名称一致。
    const model: string = LAppMotionSyncDefine.ModelDir[index];
    const modelPath: string = LAppMotionSyncDefine.ResourcesPath + model + '/';
    let modelJsonName: string = LAppMotionSyncDefine.ModelDir[index];
    modelJsonName += '.model3.json';

    this.releaseAllModel();
    const instance = new LAppMotionSyncModel();
    instance.setSubdelegate(this._subdelegate);
    instance.loadAssets(modelPath, modelJsonName);
    // TODO 设置麦克风为输入设备
    // if (this._subdelegate._useMicrophone) {
    //   instance.setProvider(LAppInputDevice.getInstance());
    // }
    instance.setProvider(TTSAudioBufferProvider.getInstance());
    this._models.pushBack(instance);
    LAppPal.printMessage(`[APP]切换场景: `, modelJsonName);
  }

  public setViewMatrix(m: CubismMatrix44) {
    for (let i = 0; i < 16; i++) {
      this._viewMatrix.getArray()[i] = m.getArray()[i];
    }
  }

  /**
   * 添加模型
   */
  public addModel(sceneIndex: number = 0): void {
    this._sceneIndex = sceneIndex;
    this.changeScene(this._sceneIndex);
  }

  /**
   * 构造函数
   */
  public constructor() {
    this._viewMatrix = new CubismMatrix44();
    this._models = new csmVector<LAppMotionSyncModel>();
    this._sceneIndex = 0;
  }

  /**
   * 释放资源
   */
  public release(): void {}

  /**
   * 初始化
   * @param subdelegate
   */
  public initialize(subdelegate: LAppMotionSyncSubdelegate): void {
    this._subdelegate = subdelegate;
    this.changeScene(this._sceneIndex);
  }

  /**
   * 自身所属的子委托
   */
  _subdelegate: LAppMotionSyncSubdelegate;

  _viewMatrix: CubismMatrix44; // 用于模型绘制的视图矩阵
  _models: csmVector<LAppMotionSyncModel>; // 模型实例的容器
  _sceneIndex: number; // 要显示的场景的索引值

  // 动作播放开始的回调函数
  beganMotion = (self): void => {
    LAppPal.printMessage('[APP]动作开始:', self);
  };
  // 动作播放结束的回调函数
  finishedMotion = (self): void => {
    LAppPal.printMessage('[APP]动作结束:', self);
  };
}
