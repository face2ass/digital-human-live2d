/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * 使用此源代码受Live2D开源软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

import { CubismDefaultParameterId } from '@framework/cubismdefaultparameterid';
import { CubismModelSettingJson } from '@framework/cubismmodelsettingjson';
import {
  BreathParameterData,
  CubismBreath
} from '@framework/effect/cubismbreath';
import { CubismEyeBlink } from '@framework/effect/cubismeyeblink';
import { ICubismModelSetting } from '@framework/icubismmodelsetting';
import { type CubismIdHandle } from '@framework/id/cubismid';
import { CubismFramework } from '@framework/live2dcubismframework';
import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { CubismUserModel } from '@framework/model/cubismusermodel';
import {
  ACubismMotion,
  type BeganMotionCallback,
  type FinishedMotionCallback
} from '@framework/motion/acubismmotion';
import { CubismMotion } from '@framework/motion/cubismmotion';
import {
  type CubismMotionQueueEntryHandle,
  InvalidMotionQueueEntryHandleValue
} from '@framework/motion/cubismmotionqueuemanager';
import { csmMap } from '@framework/type/csmmap';
import { csmRect } from '@framework/type/csmrectf';
import { csmString } from '@framework/type/csmstring';
import { csmVector } from '@framework/type/csmvector';
import {
  CSM_ASSERT,
  CubismLogError,
  CubismLogInfo
} from '@framework/utils/cubismdebug';

import * as LAppDefine from './SampleSrc/lappdefine';
import * as LAppMotionSyncDefine from './lappmotionsyncdefine';
import { LAppPal } from './SampleSrc/lapppal';
import { TextureInfo } from './SampleSrc/lapptexturemanager';
import { CubismMoc } from '@framework/model/cubismmoc';
import { CubismModelMotionSyncSettingJson } from '@motionsyncframework/cubismmodelmotionsyncsettingjson';
import { LAppAudioManager } from './lappaudiomanager';
import { CubismMotionSync } from '@motionsyncframework/live2dcubismmotionsync';
import { LAppMotionSyncSubdelegate } from './lappmotionsyncsubdelegate';
import { type ILAppAudioBufferProvider } from './lappiaudiobufferprovider';
import {LAppWavFileHandler} from "./SampleSrc/lappwavfilehandler";

enum LoadStep {
  LoadAssets,
  LoadModel,
  WaitLoadModel,
  LoadExpression,
  WaitLoadExpression,
  LoadPhysics,
  WaitLoadPhysics,
  LoadPose,
  WaitLoadPose,
  SetupEyeBlink,
  SetupBreath,
  LoadUserData,
  WaitLoadUserData,
  SetupEyeBlinkIds,
  SetupLipSyncIds,
  SetupLayout,
  LoadMotionSync,
  LoadMotion,
  WaitLoadMotion,
  CompleteInitialize,
  CompleteSetupModel,
  LoadTexture,
  WaitLoadTexture,
  CompleteSetup
}

/**
 * 用户实际使用的模型实现类 <br>
 * 进行模型生成、功能组件生成、更新处理以及渲染调用。
 */
export class LAppMotionSyncModel extends CubismUserModel {
  /**
   * 根据 model3.json 所在目录和文件路径生成模型
   * @param dir 目录
   * @param fileName 文件名
   */
  public loadAssets(dir: string, fileName: string): void {
    this._modelHomeDir = dir;

    fetch(`${this._modelHomeDir}${fileName}`)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => {
        const setting: CubismModelMotionSyncSettingJson =
          new CubismModelMotionSyncSettingJson(
            arrayBuffer,
            arrayBuffer.byteLength
          );

        if (LAppDefine.DebugLogEnable) {
          LAppPal.printMessage(`[APP]模型配置: `, setting);
        }

        // 更新状态
        this._state = LoadStep.LoadModel;

        // 保存结果
        this.setupModel(setting);
      })
      .catch(error => {
        // 读取 model3.json 出错时，由于此时无法进行渲染，因此不进行 setup 操作，捕获错误后不做其他处理
        CubismLogError(`加载文件失败 ${this._modelHomeDir}${fileName}`);
      });
  }

  /**
   * 根据 model3.json 生成模型。
   * 按照 model3.json 的描述进行模型生成、动画、物理运算等组件的生成。
   * 顺序： setupModel -> loadModel -> loadCubismExpression -> loadExpression -> loadPhysics -> loadPose -> loadUserData -> setupEyeBlinkIds-> setupLipSyncIds-> setupLayout ->  loadCubismMotion/loadMotionSync
   *
   * @param setting CubismModelMotionSyncSettingJson 的实例
   */
  private setupModel(setting: CubismModelMotionSyncSettingJson): void {
    this._updating = true;
    this._initialized = false;

    this._modelSetting = setting;

    // CubismModel
    if (this._modelSetting.getModelFileName() != '') {
      const modelFileName = this._modelSetting.getModelFileName();

      fetch(`${this._modelHomeDir}${modelFileName}`)
        .then(response => {
          if (response.ok) {
            return response.arrayBuffer();
          } else if (response.status >= 400) {
            CubismLogError(
              `加载文件失败 ${this._modelHomeDir}${modelFileName}`
            );
            return new ArrayBuffer(0);
          }
        })
        .then(arrayBuffer => {
          this.loadModel(arrayBuffer, this._mocConsistency);

          this._state = LoadStep.SetupLayout;

          // 回调
          loadCubismExpression();
        });

      this._state = LoadStep.WaitLoadModel;
    } else {
      LAppPal.printMessage('模型数据不存在。');
    }

    // Expression
    const loadCubismExpression = (): void => {
      if (this._modelSetting.getExpressionCount() > 0) {
        const count: number = this._modelSetting.getExpressionCount();

        for (let i = 0; i < count; i++) {
          const expressionName = this._modelSetting.getExpressionName(i);
          const expressionFileName =
            this._modelSetting.getExpressionFileName(i);

          fetch(`${this._modelHomeDir}${expressionFileName}`)
            .then(response => {
              if (response.ok) {
                return response.arrayBuffer();
              } else if (response.status >= 400) {
                CubismLogError(
                  `加载文件失败 ${this._modelHomeDir}${expressionFileName}`
                );
                // 即使文件不存在，response也不会返回null，因此返回空的ArrayBuffer
                return new ArrayBuffer(0);
              }
            })
            .then(arrayBuffer => {
              const motion: ACubismMotion = this.loadExpression(
                arrayBuffer,
                arrayBuffer.byteLength,
                expressionName
              );

              if (this._expressions.getValue(expressionName) != null) {
                ACubismMotion.delete(
                  this._expressions.getValue(expressionName)
                );
                this._expressions.setValue(expressionName, null);
              }

              this._expressions.setValue(expressionName, motion);

              this._expressionCount++;

              if (this._expressionCount >= count) {
                this._state = LoadStep.LoadPhysics;

                // callback
                loadCubismPhysics();
              }
            });
        }
        this._state = LoadStep.WaitLoadExpression;
      } else {
        this._state = LoadStep.LoadPhysics;

        // callback
        loadCubismPhysics();
      }
    };

    // Physics
    const loadCubismPhysics = (): void => {
      if (this._modelSetting.getPhysicsFileName() != '') {
        const physicsFileName = this._modelSetting.getPhysicsFileName();

        fetch(`${this._modelHomeDir}${physicsFileName}`)
          .then(response => {
            if (response.ok) {
              return response.arrayBuffer();
            } else if (response.status >= 400) {
              CubismLogError(
                `Failed to load file ${this._modelHomeDir}${physicsFileName}`
              );
              return new ArrayBuffer(0);
            }
          })
          .then(arrayBuffer => {
            this.loadPhysics(arrayBuffer, arrayBuffer.byteLength);

            this._state = LoadStep.LoadPose;

            // callback
            loadCubismPose();
          });
        this._state = LoadStep.WaitLoadPhysics;
      } else {
        this._state = LoadStep.LoadPose;

        // callback
        loadCubismPose();
      }
    };

    // Pose
    const loadCubismPose = (): void => {
      if (this._modelSetting.getPoseFileName() != '') {
        const poseFileName = this._modelSetting.getPoseFileName();

        fetch(`${this._modelHomeDir}${poseFileName}`)
          .then(response => {
            if (response.ok) {
              return response.arrayBuffer();
            } else if (response.status >= 400) {
              CubismLogError(
                `Failed to load file ${this._modelHomeDir}${poseFileName}`
              );
              return new ArrayBuffer(0);
            }
          })
          .then(arrayBuffer => {
            this.loadPose(arrayBuffer, arrayBuffer.byteLength);

            this._state = LoadStep.SetupEyeBlink;

            // callback
            setupEyeBlink();
          });
        this._state = LoadStep.WaitLoadPose;
      } else {
        this._state = LoadStep.SetupEyeBlink;

        // callback
        setupEyeBlink();
      }
    };

    // EyeBlink
    const setupEyeBlink = (): void => {
      if (this._modelSetting.getEyeBlinkParameterCount() > 0) {
        this._eyeBlink = CubismEyeBlink.create(this._modelSetting);
        this._state = LoadStep.SetupBreath;
      }

      // callback
      setupBreath();
    };

    // Breath
    const setupBreath = (): void => {
      this._breath = CubismBreath.create();

      const breathParameters: csmVector<BreathParameterData> = new csmVector();
      breathParameters.pushBack(
        new BreathParameterData(this._idParamAngleX, 0.0, 15.0, 6.5345, 0.5)
      );
      breathParameters.pushBack(
        new BreathParameterData(this._idParamAngleY, 0.0, 8.0, 3.5345, 0.5)
      );
      breathParameters.pushBack(
        new BreathParameterData(this._idParamAngleZ, 0.0, 10.0, 5.5345, 0.5)
      );
      breathParameters.pushBack(
        new BreathParameterData(this._idParamBodyAngleX, 0.0, 4.0, 15.5345, 0.5)
      );
      breathParameters.pushBack(
        new BreathParameterData(
          CubismFramework.getIdManager().getId(
            CubismDefaultParameterId.ParamBreath
          ),
          0.5,
          0.5,
          3.2345,
          1
        )
      );

      this._breath.setParameters(breathParameters);
      this._state = LoadStep.LoadUserData;

      // callback
      loadUserData();
    };

    // UserData
    const loadUserData = (): void => {
      if (this._modelSetting.getUserDataFile() != '') {
        const userDataFile = this._modelSetting.getUserDataFile();

        fetch(`${this._modelHomeDir}${userDataFile}`)
          .then(response => {
            if (response.ok) {
              return response.arrayBuffer();
            } else if (response.status >= 400) {
              CubismLogError(
                `Failed to load file ${this._modelHomeDir}${userDataFile}`
              );
              return new ArrayBuffer(0);
            }
          })
          .then(arrayBuffer => {
            this.loadUserData(arrayBuffer, arrayBuffer.byteLength);

            this._state = LoadStep.SetupEyeBlinkIds;

            // callback
            setupEyeBlinkIds();
          });

        this._state = LoadStep.WaitLoadUserData;
      } else {
        this._state = LoadStep.SetupEyeBlinkIds;

        // callback
        setupEyeBlinkIds();
      }
    };

    // EyeBlinkIds
    const setupEyeBlinkIds = (): void => {
      const eyeBlinkIdCount: number =
        this._modelSetting.getEyeBlinkParameterCount();

      for (let i = 0; i < eyeBlinkIdCount; ++i) {
        this._eyeBlinkIds.pushBack(
          this._modelSetting.getEyeBlinkParameterId(i)
        );
      }

      this._state = LoadStep.SetupLipSyncIds;

      // callback
      setupLipSyncIds();
    };

    // 设置LipSyncIds
    const setupLipSyncIds = (): void => {
      const lipSyncIdCount = this._modelSetting.getLipSyncParameterCount();

      for (let i = 0; i < lipSyncIdCount; ++i) {
        this._lipSyncIds.pushBack(this._modelSetting.getLipSyncParameterId(i));
      }
      this._state = LoadStep.SetupLayout;

      // callback
      setupLayout();
    };

    // 布局设置
    const setupLayout = (): void => {
      const layout: csmMap<string, number> = new csmMap<string, number>();

      if (this._modelSetting == null || this._modelMatrix == null) {
        CubismLogError('Failed to setupLayout().');
        return;
      }

      this._modelSetting.getLayoutMap(layout);
      this._modelMatrix.setupFromLayout(layout);
      this._state = LoadStep.LoadMotionSync;

      // 动作同步设置
      loadCubismMotion();
      setupMotionSync();
    };

    // 动作同步设置
    const setupMotionSync = (): void => {
      if (this._modelSetting.getMotionSyncFileName() != '') {
        const motionSyncFile = this._modelSetting.getMotionSyncFileName();

        // 注意：如果未找到 MotionSyncFile，会返回 'NullValue'，因此需要进行显式判断。
        if (!motionSyncFile || motionSyncFile == 'NullValue') {
          CubismLogError('Failed to setupMotionSync().');
          return;
        }

        LAppPal.printMessage("[APP]加载动作同步文件：", `${this._modelHomeDir}${motionSyncFile}`);
        fetch(`${this._modelHomeDir}${motionSyncFile}`)
          .then(response => {
            if (response.ok) {
              return response.arrayBuffer();
            } else if (response.status >= 400) {
              CubismLogError(`Failed to load file ${this._modelHomeDir}${motionSyncFile}`);
              // 即使文件不存在，response 也不会返回 null，因此用空的 ArrayBuffer 处理
              return new ArrayBuffer(0);
            }
          })
          .then(arrayBuffer => {
            this.loadMotionSync(arrayBuffer, arrayBuffer.byteLength);
            // 加载音频文件
            this._soundFileList =
              this._modelSetting.getMotionSyncSoundFileList();
            this._soundIndex = 0;
          })
          .then(() => {
            this.loadFromSoundList();

            this._state = LoadStep.LoadTexture;

            this._updating = false;
            this._initialized = true;

            this.createRenderer();
            this.setupTextures();
            this.getRenderer().startUp(
              this._subdelegate.getGlManager().getGl()
            );
          });
      }
    };

    // Motion
    const loadCubismMotion = (): void => {
      this._state = LoadStep.WaitLoadMotion;
      this._model.saveParameters();
      this._allMotionCount = 0;
      this._motionCount = 0;
      const group: string[] = [];

      const motionGroupCount: number = this._modelSetting.getMotionGroupCount();

      // 计算动作总数
      for (let i = 0; i < motionGroupCount; i++) {
        group[i] = this._modelSetting.getMotionGroupName(i);
        this._allMotionCount += this._modelSetting.getMotionCount(group[i]);
      }

      // 加载动作
      for (let i = 0; i < motionGroupCount; i++) {
        this.preLoadMotionGroup(group[i]);
      }

      // 如果没有动作
      if (motionGroupCount == 0) {
        this._state = LoadStep.LoadTexture;

        // 停止所有动作
        this._motionManager.stopAllMotions();

        this._updating = false;
        this._initialized = true;

        this.createRenderer();
        this.setupTextures();
        this.getRenderer().startUp(this._subdelegate.getGlManager().getGl());
      }
    };
  }

  /**
   * 加载动作同步数据
   * @param buffer 已加载 physics3.json 的缓冲区
   * @param size 缓冲区大小
   */
  private loadMotionSync(buffer: ArrayBuffer, size: number) {
    if (buffer == null || size == 0) {
      CubismLogError('Failed to loadMotionSync().');
      return;
    }

    this._motionSync = CubismMotionSync.create(
      this._model,
      buffer,
      size,
      LAppMotionSyncDefine.SamplesPerSec
    );
  }

  /**
   * 将纹理加载到纹理单元
   */
  private setupTextures(): void {
    // 为提升 iPhone 上的透明度质量，在 TypeScript 中采用 premultipliedAlpha
    const usePremultiply = true;

    if (this._state == LoadStep.LoadTexture) {
      // 纹理加载用
      const textureCount: number = this._modelSetting.getTextureCount();

      for (
        let modelTextureNumber = 0;
        modelTextureNumber < textureCount;
        modelTextureNumber++
      ) {
        // 如果纹理名称为空字符串，则跳过加载和绑定处理
        if (this._modelSetting.getTextureFileName(modelTextureNumber) == '') {
          console.log('getTextureFileName null');
          continue;
        }

        // 将纹理加载到 WebGL 的纹理单元
        let texturePath =
          this._modelSetting.getTextureFileName(modelTextureNumber);
        texturePath = this._modelHomeDir + texturePath;

        // 加载完成时调用的回调函数
        const onLoad = (textureInfo: TextureInfo): void => {
          this.getRenderer().bindTexture(modelTextureNumber, textureInfo.id);

          this._textureCount++;

          if (this._textureCount >= textureCount) {
            // 加载完成
            this._state = LoadStep.CompleteSetup;
          }
        };

        // 加载
        this._subdelegate
          .getTextureManager()
          .createTextureFromPngFile(texturePath, usePremultiply, onLoad);
        this.getRenderer().setIsPremultipliedAlpha(usePremultiply);
      }

      this._state = LoadStep.WaitLoadTexture;
    }
  }

  /**
   * 重新构建渲染器
   */
  public reloadRenderer(): void {
    this.deleteRenderer();
    this.createRenderer();
    this.setupTextures();
  }

  /**
   * 从音频文件列表中进行加载
   */
  public loadFromSoundList(): void {
    if (!this._soundFileList || !this._soundData) {
      return;
    }

    this._soundData
      .getSoundBufferContext()
      .getAudioManager()
      ._audios.resize(this._soundFileList.getSize());
    this._soundData
      .getSoundBufferContext()
      .getBuffers()
      .resize(this._soundFileList.getSize());

    for (let index = 0; index < this._soundFileList.getSize(); index++) {
      const filePath = this._modelHomeDir + this._soundFileList.at(index).s;
      this._soundData.loadFile(filePath, index, this, this._motionSync);
    }
  }

  /**
   * 判断当前音频上下文是否处于暂停状态
   *
   * @returns 当前音频上下文是否处于暂停状态？
   */
  public isSuspendedCurrentSoundContext(): boolean {
    return this._soundData.isSuspendedContextByIndex(this._soundIndex);
  }

  /**
   * 播放当前音频
   */
  public playCurrentSound(): void {
    if (
      !this._soundData ||
      !this._soundFileList ||
      !(this._soundIndex < this._soundFileList.getSize()) ||
      !this._motionSync
    ) {
      return;
    }

    this._motionSync.setSoundBuffer(
      0,
      this._soundData.getSoundBufferContext().getBuffers().at(this._soundIndex),
      0
    );

    this._soundData.playByIndex(this._soundIndex);
  }

  /**
   * 停止播放当前音频
   */
  public stopCurrentSound(): void {
    if (
      !this._soundData ||
      !this._soundFileList ||
      !(this._soundIndex < this._soundFileList.getSize())
    ) {
      return;
    }

    this._soundData.stopByIndex(this._soundIndex);
  }

  /**
   * 数组的 push 处理，向容器中添加新元素
   * @param buffer 要操作的 csmVector<number> 容器
   * @param value 要添加到数组的原始数据
   */
  public pushFromArray(
    buffer: csmVector<number>,
    value: ArrayLike<number>
  ): void {
    if (buffer._size >= buffer._capacity) {
      buffer.prepareCapacity(
        buffer._capacity == 0
          ? csmVector.DefaultSize
          : buffer._capacity + value.length
      );
    }

    buffer._ptr.push(...Array.from(value));
  }

  /**
   * 更新动作同步
   */
  public updateMotionSync() {
    const soundBuffer = this._soundData
      .getSoundBufferContext()
      .getBuffers()
      .at(this._soundIndex);
    const audioInfo = this._soundData
      .getSoundBufferContext()
      .getAudioManager()
      ._audios.at(this._soundIndex);

    // 获取当前帧的时间（秒为单位）
    // 注意：浏览器及其设置可能会导致 performance.now() 的精度不同
    const currentAudioTime = performance.now() / 1000.0; // 转换为秒

    // 更新播放时间
    // 如果上一帧的时间早于当前时间，则视为同一时间
    if (currentAudioTime < audioInfo.audioContextPreviousTime) {
      audioInfo.audioContextPreviousTime = currentAudioTime;
    }

    // 计算从上一帧开始的经过时间
    const audioDeltaTime =
      currentAudioTime - audioInfo.audioContextPreviousTime;

    // 更新经过时间
    audioInfo.audioElapsedTime += audioDeltaTime;

    // 将播放时间转换为采样数
    // 采样数 = 播放时间 * 采样率
    // 注意：采样率使用音频文件中设置的值。如果使用音频上下文的采样率，可能会导致动作同步播放不正确。
    const currentSamplePosition = Math.floor(
      audioInfo.audioElapsedTime * audioInfo.wavhandler.getWavSamplingRate()
    );

    // 如果已处理的播放位置超过音频采样数，则不进行处理
    if (audioInfo.previousSamplePosition <= audioInfo.audioSamples.length) {
      // 从上次播放位置开始，获取已播放的音频样本
      const currentAudioSamples = audioInfo.audioSamples.slice(
        audioInfo.previousSamplePosition,
        currentSamplePosition
      );

      // 将已播放的样本添加到声音缓冲区
      for (let index = 0; index < currentAudioSamples.length; index++) {
        soundBuffer.pushBack(currentAudioSamples[index]);
      }

      // 设置声音缓冲区
      this._motionSync.setSoundBuffer(0, soundBuffer, 0);

      // 更新动作同步
      this._motionSync.updateParameters(this._model, audioDeltaTime);

      // 删除已解析的数据
      const lastTotalProcessedCount =
        this._motionSync.getLastTotalProcessedCount(0);
      this._soundData.removeDataArrayByIndex(
        this._soundIndex,
        lastTotalProcessedCount
      );

      // 将已播放的采样数和播放时间更新为当前值
      audioInfo.audioContextPreviousTime = currentAudioTime;
      audioInfo.previousSamplePosition = currentSamplePosition;
    }
  }

  private updateMotionSyncForProvider(): void {
    if (!this._audioBufferProvider) {
      return;
    }

    // 获取当前帧的时间（秒为单位）
    // 注意：浏览器及其设置可能会导致 performance.now() 的精度不同
    const audioDeltaTime = performance.now() / 1000.0; // 转换为秒

    // 设置声音缓冲区
    this._motionSync.setSoundBuffer(0, this._audioBufferProvider.getBuffer(), 0);

    // 更新动作同步
    this._motionSync.updateParameters(this._model, audioDeltaTime);
  }

  /**
   * 更新
   */
  public update(): void {
    if (this._state != LoadStep.CompleteSetup) return;

    const deltaTimeSeconds: number = LAppPal.getDeltaTime();
    this._userTimeSeconds += deltaTimeSeconds;

    this._dragManager.update(deltaTimeSeconds);
    this._dragX = this._dragManager.getX();
    this._dragY = this._dragManager.getY();

    // 是否有动作导致的参数更新
    let motionUpdated = false;

    //--------------------------------------------------------------------------
    this._model.loadParameters(); // 加载上次保存的状态
    if (this._motionManager.isFinished()) {
      // 如果没有动作播放，则从待机动作中随机播放一个
      this.startRandomMotion(
        LAppDefine.MotionGroupIdle,
        LAppDefine.PriorityIdle
      );
    } else {
      motionUpdated = this._motionManager.updateMotion(
        this._model,
        deltaTimeSeconds
      ); // 更新动作
    }
    this._model.saveParameters(); // 保存状态
    //--------------------------------------------------------------------------

    // 眨眼
    if (!motionUpdated) {
      if (this._eyeBlink != null) {
        // 如果没有主要动作更新
        this._eyeBlink.updateParameters(this._model, deltaTimeSeconds); // 眨眼
      }
    }

    if (this._expressionManager != null) {
      this._expressionManager.updateMotion(this._model, deltaTimeSeconds); // 通过表情更新参数（相对变化）
    }

    // 拖动导致的变化
    // 通过拖动调整脸部方向
    this._model.addParameterValueById(this._idParamAngleX, this._dragX * 30); // 添加-30到30范围内的值
    this._model.addParameterValueById(this._idParamAngleY, this._dragY * 30);
    this._model.addParameterValueById(
      this._idParamAngleZ,
      this._dragX * this._dragY * -30
    );

    // 通过拖动调整眼睛方向
    this._model.addParameterValueById(
      this._idParamBodyAngleX,
      this._dragX * 10
    ); // 添加-10到10的值

    // 通过拖动调整身体方向
    this._model.addParameterValueById(this._idParamEyeBallX, this._dragX); // 添加-1到1的值
    this._model.addParameterValueById(this._idParamEyeBallY, this._dragY);

    // 呼吸等
    if (this._breath != null) {
      this._breath.updateParameters(this._model, deltaTimeSeconds);
    }

    // 设置物理运算
    if (this._physics != null) {
      this._physics.evaluate(this._model, deltaTimeSeconds);
    }

    // 口形同步设置
    if (this._lipsync) {
      let value = 0.0; // 实时进行口形同步时，从系统获取音量，并输入0～1范围内的值。

      this._wavFileHandler.update(deltaTimeSeconds);
      value = this._wavFileHandler.getRms();

      for (let i = 0; i < this._lipSyncIds.getSize(); ++i) {
        this._model.addParameterValueById(this._lipSyncIds.at(i), value, 0.8);
      }
    }

    // 设置姿势
    if (this._pose != null) {
      this._pose.updateParameters(this._model, deltaTimeSeconds);
    }

    // 唇形同步
    if (this._motionSync) {
      if (this._soundData.isPlayByIndex(this._soundIndex)) {
        this.updateMotionSync();
      } else {
        this.updateMotionSyncForProvider();
      }
    }

    this._model.update();
  }

  /**
   * 开始播放指定动作
   * @param group 动作组名
   * @param no 组内编号
   * @param priority 优先级
   * @param onFinishedMotionHandler 动作播放结束时调用的回调函数
   * @return 返回开始动作的标识号。用于判断单个动作是否结束的isFinished()的参数。如果无法开始，则返回[-1]
   */
  public startMotion(
    group: string,
    no: number,
    priority: number,
    onFinishedMotionHandler?: FinishedMotionCallback,
    onBeganMotionHandler?: BeganMotionCallback
  ): CubismMotionQueueEntryHandle {
    if (priority == LAppDefine.PriorityForce) {
      this._motionManager.setReservePriority(priority);
    } else if (!this._motionManager.reserveMotion(priority)) {
      LAppPal.printMessage("[APP]can't start motion.");
      return InvalidMotionQueueEntryHandleValue;
    }

    const motionFileName = this._modelSetting.getMotionFileName(group, no);

    // ex) idle_0
    const name = `${group}_${no}`;

    LAppPal.printMessage('[APP]播放动作文件：', motionFileName);

    let motion: CubismMotion = this._motions.getValue(name) as CubismMotion;
    let autoDelete = false;

    if (motion == null) {
      fetch(`${this._modelHomeDir}${motionFileName}`)
        .then(response => {
          if (response.ok) {
            return response.arrayBuffer();
          } else if (response.status >= 400) {
            CubismLogError(
              `Failed to load file ${this._modelHomeDir}${motionFileName}`
            );
            return new ArrayBuffer(0);
          }
        })
        .then(arrayBuffer => {
          motion = this.loadMotion(
            arrayBuffer,
            arrayBuffer.byteLength,
            null,
            onFinishedMotionHandler,
            onBeganMotionHandler,
            this._modelSetting,
            group,
            no
          );
        });
    } else {
      motion.setBeganMotionHandler(onBeganMotionHandler);
      motion.setFinishedMotionHandler(onFinishedMotionHandler);
    }

    //voice
    const voice = this._modelSetting.getMotionSoundFileName(group, no);
    if (voice.localeCompare('') != 0) {
      let path = voice;
      path = this._modelHomeDir + path;
      LAppPal.printMessage('[APP]音频地址:', path);
      this._wavFileHandler.start(path);
    }

    LAppPal.printMessage(`[APP]start motion: ${group}_${no}`);
    return this._motionManager.startMotionPriority(
      motion,
      autoDelete,
      priority
    );
  }

  /**
   * 开始播放随机选择的动作。
   * @param group 动作组名
   * @param priority 优先级
   * @param onFinishedMotionHandler 动作播放结束时调用的回调函数
   * @return 返回开始动作的标识号。用于判断单个动作是否结束的isFinished()的参数。如果无法开始，则返回[-1]
   */
  public startRandomMotion(
    group: string,
    priority: number,
    onFinishedMotionHandler?: FinishedMotionCallback,
    onBeganMotionHandler?: BeganMotionCallback
  ): CubismMotionQueueEntryHandle {
    if (this._modelSetting.getMotionCount(group) == 0) {
      return InvalidMotionQueueEntryHandleValue;
    }

    const no: number = Math.floor(
      Math.random() * this._modelSetting.getMotionCount(group)
    );

    return this.startMotion(
      group,
      no,
      priority,
      onFinishedMotionHandler,
      onBeganMotionHandler
    );
  }

  /**
   * 设置指定的表情动作
   *
   * @param expressionId 表情动作的ID
   */
  public setExpression(expressionId: string): void {
    console.log('■设置指定的表情动作：', expressionId)
    const motion: ACubismMotion = this._expressions.getValue(expressionId);

    if (this._debugMode) {
      LAppPal.printMessage(`[APP]expression: [${expressionId}]`);
    }

    if (motion != null) {
      this._expressionManager.startMotion(motion, false);
    } else {
      if (this._debugMode) {
        LAppPal.printMessage(`[APP]expression[${expressionId}] is null`);
      }
    }
  }

  /**
   * 设置随机选择的表情动作
   */
  public setRandomExpression(): void {
    if (this._expressions.getSize() == 0) {
      return;
    }

    const no: number = Math.floor(Math.random() * this._expressions.getSize());

    console.log('■随机播放表情动画：', no, this._expressions)

    for (let i = 0; i < this._expressions.getSize(); i++) {
      if (i == no) {
        const name: string = this._expressions._keyValues[i].first;
        this.setExpression(name);
        return;
      }
    }
  }

  /**
   * 接收事件触发
   */
  public motionEventFired(eventValue: csmString): void {
    CubismLogInfo('{0} is fired on LAppModel!!', eventValue.s);
  }

  /**
   * 碰撞检测测试
   * 根据指定 ID 的顶点列表计算矩形，并判断坐标是否在矩形范围内。
   *
   * @param hitArenaName 要进行碰撞检测的对象 ID
   * @param x 要进行判断的 X 坐标
   * @param y 要进行判断的 Y 坐标
   */
  public hitTest(hitArenaName: string, x: number, y: number): boolean {
    // 透明时不检测碰撞
    if (this._opacity < 1) {
      return false;
    }

    const count: number = this._modelSetting.getHitAreasCount();

    for (let i = 0; i < count; i++) {
      if (this._modelSetting.getHitAreaName(i) == hitArenaName) {
        const drawId: CubismIdHandle = this._modelSetting.getHitAreaId(i);
        return this.isHit(drawId, x, y);
      }
    }

    return false;
  }

  /**
   * 按组名批量加载动作数据。
   * 动作数据的名称在内部从ModelSetting获取。
   *
   * @param group 动作数据的组名
   */
  public preLoadMotionGroup(group: string): void {
    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(
        `[APP]预加载动作组: ${group} 数量: ${this._modelSetting.getMotionCount(group)}}`
      );
    }
    for (let i = 0; i < this._modelSetting.getMotionCount(group); i++) {
      const motionFileName = this._modelSetting.getMotionFileName(group, i);

      // ex) idle_0
      const name = `${group}_${i}`;
      if (this._debugMode) {
        LAppPal.printMessage(
          `[APP]load motion: ${motionFileName} => [${name}]`
        );
      }

      fetch(`${this._modelHomeDir}${motionFileName}`)
        .then(response => {
          if (response.ok) {
            return response.arrayBuffer();
          } else if (response.status >= 400) {
            CubismLogError(
              `Failed to load file ${this._modelHomeDir}${motionFileName}`
            );
            return new ArrayBuffer(0);
          }
        })
        .then(arrayBuffer => {
          const tmpMotion: CubismMotion = this.loadMotion(
            arrayBuffer,
            arrayBuffer.byteLength,
            name,
            null,
            null,
            this._modelSetting,
            group,
            i
          );

          if (tmpMotion != null) {
            tmpMotion.setEffectIds(this._eyeBlinkIds, this._lipSyncIds);

            if (this._motions.getValue(name) != null) {
              ACubismMotion.delete(this._motions.getValue(name));
            }

            this._motions.setValue(name, tmpMotion);

            this._motionCount++;
            if (this._motionCount >= this._allMotionCount) {
              this._state = LoadStep.LoadTexture;

              // 停止所有动作
              this._motionManager.stopAllMotions();

              this._updating = false;
              this._initialized = true;

              this.createRenderer();
              this.setupTextures();
              this.getRenderer().startUp(
                this._subdelegate.getGlManager().getGl()
              );
            }
          } else {
            // 如果loadMotion失败，则动作总数会不一致，因此减少一个
            this._allMotionCount--;
          }
        });
    }
  }

  /**
   * 释放所有动作数据。
   */
  public releaseMotions(): void {
    this._motions.clear();
  }

  /**
   * 释放所有表情数据。
   */
  public releaseExpressions(): void {
    this._expressions.clear();
  }

  /**
   * 绘制模型的处理。传入用于绘制模型空间的 View-Projection 矩阵。
   */
  public doDraw(): void {
    if (this._model == null) return;

    // 传递画布尺寸
    const canvas = this._subdelegate.getCanvas();
    const viewport: number[] = [0, 0, canvas.width, canvas.height];

    this.getRenderer().setRenderState(
      this._subdelegate.getFrameBuffer(),
      viewport
    );
    this.getRenderer().drawModel();
  }

  /**
   * 绘制模型的处理。传入用于绘制模型空间的 View-Projection 矩阵。
   */
  public draw(matrix: CubismMatrix44): void {
    if (this._model == null) {
      return;
    }

    // 各项加载完成后
    if (this._state == LoadStep.CompleteSetup) {
      matrix.multiplyByMatrix(this._modelMatrix);

      this.getRenderer().setMvpMatrix(matrix);

      this.doDraw();
    }
  }

  public async hasMocConsistencyFromFile() {
    CSM_ASSERT(this._modelSetting.getModelFileName().localeCompare(``));

    // CubismModel
    if (this._modelSetting.getModelFileName() != '') {
      const modelFileName = this._modelSetting.getModelFileName();

      const response = await fetch(`${this._modelHomeDir}${modelFileName}`);
      const arrayBuffer = await response.arrayBuffer();

      this._consistency = CubismMoc.hasMocConsistency(arrayBuffer);

      if (!this._consistency) {
        CubismLogInfo('Inconsistent MOC3.');
      } else {
        CubismLogInfo('Consistent MOC3.');
      }

      return this._consistency;
    } else {
      LAppPal.printMessage('Model data does not exist.');
    }
  }

  /**
   * 构造函数
   */
  public constructor() {
    super();

    this._modelSetting = null;
    this._modelHomeDir = null;
    this._userTimeSeconds = 0.0;

    this._eyeBlinkIds = new csmVector<CubismIdHandle>();
    this._lipSyncIds = new csmVector<CubismIdHandle>();

    this._motions = new csmMap<string, ACubismMotion>();
    this._expressions = new csmMap<string, ACubismMotion>();

    this._hitArea = new csmVector<csmRect>();
    this._userArea = new csmVector<csmRect>();

    this._idParamAngleX = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamAngleX
    );
    this._idParamAngleY = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamAngleY
    );
    this._idParamAngleZ = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamAngleZ
    );
    this._idParamEyeBallX = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamEyeBallX
    );
    this._idParamEyeBallY = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamEyeBallY
    );
    this._idParamBodyAngleX = CubismFramework.getIdManager().getId(
      CubismDefaultParameterId.ParamBodyAngleX
    );

    if (LAppDefine.MOCConsistencyValidationEnable) {
      this._mocConsistency = true;
    }

    if (LAppDefine.MotionConsistencyValidationEnable) {
      this._motionConsistency = true;
    }

    this._state = LoadStep.LoadAssets;
    this._expressionCount = 0;
    this._textureCount = 0;
    this._motionCount = 0;
    this._allMotionCount = 0;
    this._wavFileHandler = new LAppWavFileHandler();
    this._consistency = false;
    this._soundFileList = new csmVector<csmString>();
    this._soundIndex = 0;
    this._soundData = new LAppAudioManager();
    this._lastSampleCount = 0;
    this._audioBufferProvider = null;
  }

  public override release(): void {
    super.release();

    if (this._motionSync) {
      this._motionSync.release();
      this._motionSync = null;
    }

    if (this._soundFileList) {
      this._soundFileList?.clear();
      this._soundFileList = null;
    }

    if (this._soundData) {
      this._soundData?.release();
      this._soundData = null;
    }
  }

  public setSubdelegate(subdelegate: LAppMotionSyncSubdelegate): void {
    this._subdelegate = subdelegate;
  }

  public getProvider(): ILAppAudioBufferProvider {
    return this._audioBufferProvider;
  }

  public setProvider(audioBuffer: ILAppAudioBufferProvider): void {
    this._audioBufferProvider = audioBuffer;
  }

  _modelSetting: CubismModelMotionSyncSettingJson; // 模型设置信息
  _modelHomeDir: string; // 模型设置所在目录
  _userTimeSeconds: number; // 累计的增量时间 [秒]

  _eyeBlinkIds: csmVector<CubismIdHandle>; // 模型设置的眨眼功能参数ID
  _lipSyncIds: csmVector<CubismIdHandle>; // 模型设置的唇形同步功能参数ID

  _motions: csmMap<string, ACubismMotion>; // 已加载的动作列表
  _expressions: csmMap<string, ACubismMotion>; // 已加载的表情列表

  _hitArea: csmVector<csmRect>; // 点击区域
  _userArea: csmVector<csmRect>; // 用户区域

  _idParamAngleX: CubismIdHandle; // 参数ID: ParamAngleX
  _idParamAngleY: CubismIdHandle; // 参数ID: ParamAngleY
  _idParamAngleZ: CubismIdHandle; // 参数ID: ParamAngleZ
  _idParamEyeBallX: CubismIdHandle; // 参数ID: ParamEyeBallX
  _idParamEyeBallY: CubismIdHandle; // 参数ID: ParamEyeBallY
  _idParamBodyAngleX: CubismIdHandle; // 参数ID: ParamBodyAngleX

  _state: LoadStep; // 当前状态管理
  _expressionCount: number; // 表情数据计数
  _textureCount: number; // 纹理计数
  _motionCount: number; // 动作数据计数
  _allMotionCount: number; // 动作总数
  _wavFileHandler: LAppWavFileHandler; // wav文件处理器
  _consistency: boolean; // MOC3一致性检查管理

  _soundFileList: csmVector<csmString>; // 动作同步使用的文件列表
  _soundIndex: number; // 要播放的音频数据索引
  _soundData: LAppAudioManager; // 音频管理
  _motionSync: CubismMotionSync; // 动作同步
  _lastSampleCount: number; // 最后采样的帧数

  _subdelegate: LAppMotionSyncSubdelegate; // 子委托

  private _audioBufferProvider: ILAppAudioBufferProvider; // 音频缓冲区
}
