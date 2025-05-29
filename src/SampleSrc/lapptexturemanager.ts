/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * 使用本源代码受 Live2D 开放软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

import { csmVector, iterator } from '@framework/type/csmvector';
import { LAppGlManager } from './lappglmanager';
import * as LAppDefine from "./lappdefine";
import {LAppPal} from "./lapppal";

/**
 * 纹理管理类
 * 进行图像读取、管理的类。
 */
export class LAppTextureManager {
  /**
   * 构造函数
   */
  public constructor() {
    this._textures = new csmVector<TextureInfo>();
  }

  /**
   * 释放资源。
   */
  public release(): void {
    for (
      let ite: iterator<TextureInfo> = this._textures.begin();
      ite.notEqual(this._textures.end());
      ite.preIncrement()
    ) {
      this._glManager.getGl().deleteTexture(ite.ptr().id);
    }
    this._textures = null;
  }

  /**
   * 读取图像
   *
   * @param fileName 要读取的图像文件路径名
   * @param usePremultiply 是否启用预乘处理
   * @param callback 读取完成后的回调函数，接收纹理信息作为参数
   */
  public createTextureFromPngFile(
    fileName: string,
    usePremultiply: boolean,
    callback: (textureInfo: TextureInfo) => void
  ): void {
    // 搜索已加载的纹理
    for (
      let ite: iterator<TextureInfo> = this._textures.begin();
      ite.notEqual(this._textures.end());
      ite.preIncrement()
    ) {
      if (
        ite.ptr().fileName == fileName &&
        ite.ptr().usePremultply == usePremultiply
      ) {
        // 第二次及以后会使用缓存（无等待时间）
        // 在 WebKit 中，要再次调用同一个 Image 的 onload 事件，需要重新实例化
        // 详情：https://stackoverflow.com/a/5024181
        ite.ptr().img = new Image();
        ite
          .ptr()
          .img.addEventListener('load', (): void => callback(ite.ptr()), {
            passive: true
          });
        ite.ptr().img.src = fileName;
        return;
      }
    }

    // 以数据加载完成作为触发条件
    const img = new Image();
    img.addEventListener(
      'load',
      (): void => {
        // 创建纹理对象
        const tex: WebGLTexture = this._glManager.getGl().createTexture();

        // 选择纹理
        this._glManager
          .getGl()
          .bindTexture(this._glManager.getGl().TEXTURE_2D, tex);

        // 向纹理写入像素
        this._glManager
          .getGl()
          .texParameteri(
            this._glManager.getGl().TEXTURE_2D,
            this._glManager.getGl().TEXTURE_MIN_FILTER,
            this._glManager.getGl().LINEAR_MIPMAP_LINEAR
          );
        this._glManager
          .getGl()
          .texParameteri(
            this._glManager.getGl().TEXTURE_2D,
            this._glManager.getGl().TEXTURE_MAG_FILTER,
            this._glManager.getGl().LINEAR
          );

        // 执行预乘处理
        if (usePremultiply) {
          this._glManager
            .getGl()
            .pixelStorei(
              this._glManager.getGl().UNPACK_PREMULTIPLY_ALPHA_WEBGL,
              1
            );
        }

        // 向纹理写入像素
        this._glManager
          .getGl()
          .texImage2D(
            this._glManager.getGl().TEXTURE_2D,
            0,
            this._glManager.getGl().RGBA,
            this._glManager.getGl().RGBA,
            this._glManager.getGl().UNSIGNED_BYTE,
            img
          );

        // 生成 Mipmap
        this._glManager
          .getGl()
          .generateMipmap(this._glManager.getGl().TEXTURE_2D);

        // 绑定纹理
        this._glManager
          .getGl()
          .bindTexture(this._glManager.getGl().TEXTURE_2D, null);

        const textureInfo: TextureInfo = new TextureInfo();
        if (textureInfo != null) {
          textureInfo.fileName = fileName;
          textureInfo.width = img.width;
          textureInfo.height = img.height;
          textureInfo.id = tex;
          textureInfo.img = img;
          textureInfo.usePremultply = usePremultiply;
          if (this._textures != null) {
            this._textures.pushBack(textureInfo);
          }
        }

        callback(textureInfo);
      },
      { passive: true }
    );
    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(
        `[APP]加载图像: ${fileName}`
      );
    }
    img.src = fileName;
  }

  /**
   * 释放图像
   *
   * 释放数组中存在的所有图像。
   */
  public releaseTextures(): void {
    for (let i = 0; i < this._textures.getSize(); i++) {
      this._glManager.getGl().deleteTexture(this._textures.at(i).id);
      this._textures.set(i, null);
    }

    this._textures.clear();
  }

  /**
   * 释放图像
   *
   * 释放指定纹理的图像。
   * @param texture 要释放的纹理
   */
  public releaseTextureByTexture(texture: WebGLTexture): void {
    for (let i = 0; i < this._textures.getSize(); i++) {
      if (this._textures.at(i).id != texture) {
        continue;
      }

      this._glManager.getGl().deleteTexture(this._textures.at(i).id);
      this._textures.set(i, null);
      this._textures.remove(i);
      break;
    }
  }

  /**
   * 释放图像
   *
   * 释放指定名称的图像。
   * @param fileName 要释放的图像文件路径名
   */
  public releaseTextureByFilePath(fileName: string): void {
    for (let i = 0; i < this._textures.getSize(); i++) {
      if (this._textures.at(i).fileName == fileName) {
        this._glManager.getGl().deleteTexture(this._textures.at(i).id);
        this._textures.set(i, null);
        this._textures.remove(i);
        break;
      }
    }
  }

  /**
   * 设置器
   * @param glManager
   */
  public setGlManager(glManager: LAppGlManager): void {
    this._glManager = glManager;
  }

  _textures: csmVector<TextureInfo>;
  private _glManager: LAppGlManager;
}

/**
 * 图像信息结构体
 */
export class TextureInfo {
  img: HTMLImageElement; // 图像
  id: WebGLTexture = null; // 纹理
  width = 0; // 宽度
  height = 0; // 高度
  usePremultply: boolean; // 是否启用预乘处理
  fileName: string; // 文件名
}
