/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppSprite } from './SampleSrc/lappsprite';
import { LAppMotionSyncSubdelegate } from './lappmotionsyncsubdelegate';

/**
 * 实现精灵的类
 *
 * 纹理ID、Rect的管理
 */
export class LAppMotionSyncSprite extends LAppSprite {
  /**
   * 释放资源。
   */
  public override release(): void {
    this._rect = null;

    const gl = this._motionsyncSubdelegate.getGlManager().getGl();

    gl.deleteTexture(this._texture);
    this._texture = null;

    gl.deleteBuffer(this._uvBuffer);
    this._uvBuffer = null;

    gl.deleteBuffer(this._vertexBuffer);
    this._vertexBuffer = null;
    gl.deleteBuffer(this._indexBuffer);
    this._indexBuffer = null;
  }

  /**
   * 进行绘制。
   * @param programId 着色器程序
   * @param canvas 绘制的画布信息
   */
  public override render(programId: WebGLProgram): void {
    if (this._texture == null) {
      // 加载尚未完成
      return;
    }

    const gl = this._motionsyncSubdelegate.getGlManager().getGl();

    // 首次绘制时
    if (this._firstDraw) {
      // 获取attribute变量的序号
      this._positionLocation = gl.getAttribLocation(programId, 'position');
      gl.enableVertexAttribArray(this._positionLocation);

      this._uvLocation = gl.getAttribLocation(programId, 'uv');
      gl.enableVertexAttribArray(this._uvLocation);

      // 获取uniform变量的序号
      this._textureLocation = gl.getUniformLocation(programId, 'texture');

      // 注册uniform属性
      gl.uniform1i(this._textureLocation, 0);

      // 初始化uv缓冲区、坐标
      {
        this._uvArray = new Float32Array([
          1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0
        ]);

        // 创建uv缓冲区
        this._uvBuffer = gl.createBuffer();
      }

      // 初始化顶点缓冲区、坐标
      {
        const maxWidth = this._motionsyncSubdelegate.getCanvas().width;
        const maxHeight = this._motionsyncSubdelegate.getCanvas().height;

        // 顶点数据
        this._positionArray = new Float32Array([
          (this._rect.right - maxWidth * 0.5) / (maxWidth * 0.5),
          (this._rect.up - maxHeight * 0.5) / (maxHeight * 0.5),
          (this._rect.left - maxWidth * 0.5) / (maxWidth * 0.5),
          (this._rect.up - maxHeight * 0.5) / (maxHeight * 0.5),
          (this._rect.left - maxWidth * 0.5) / (maxWidth * 0.5),
          (this._rect.down - maxHeight * 0.5) / (maxHeight * 0.5),
          (this._rect.right - maxWidth * 0.5) / (maxWidth * 0.5),
          (this._rect.down - maxHeight * 0.5) / (maxHeight * 0.5)
        ]);

        // 创建顶点缓冲区
        this._vertexBuffer = gl.createBuffer();
      }

      // 初始化顶点索引缓冲区
      {
        // 索引数据
        this._indexArray = new Uint16Array([0, 1, 2, 3, 2, 0]);

        // 创建索引缓冲区
        this._indexBuffer = gl.createBuffer();
      }

      this._firstDraw = false;
    }

    // 注册UV坐标
    gl.bindBuffer(gl.ARRAY_BUFFER, this._uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._uvArray, gl.STATIC_DRAW);

    // 注册attribute属性
    gl.vertexAttribPointer(this._uvLocation, 2, gl.FLOAT, false, 0, 0);

    // 注册顶点坐标
    gl.bindBuffer(gl.ARRAY_BUFFER, this._vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this._positionArray, gl.STATIC_DRAW);

    // 注册attribute属性
    gl.vertexAttribPointer(this._positionLocation, 2, gl.FLOAT, false, 0, 0);

    // 创建顶点索引
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this._indexArray, gl.DYNAMIC_DRAW);

    // 绘制模型
    gl.bindTexture(gl.TEXTURE_2D, this._texture);
    gl.drawElements(
      gl.TRIANGLES,
      this._indexArray.length,
      gl.UNSIGNED_SHORT,
      0
    );
  }

  /**
   * 碰撞检测
   * @param pointX x坐标
   * @param pointY y坐标
   */
  public override isHit(pointX: number, pointY: number): boolean {
    // 获取画面尺寸。
    const { height } = this._motionsyncSubdelegate.getCanvas();

    // Y坐标需要转换
    const y = height - pointY;

    return (
      pointX >= this._rect.left &&
      pointX <= this._rect.right &&
      y <= this._rect.up &&
      y >= this._rect.down
    );
  }

  /**
   * 设置器
   * @param subdelegate
   */
  public setMotionSyncSubdelegate(
    subdelegate: LAppMotionSyncSubdelegate
  ): void {
    this._motionsyncSubdelegate = subdelegate;
  }

  private _motionsyncSubdelegate: LAppMotionSyncSubdelegate;
}
