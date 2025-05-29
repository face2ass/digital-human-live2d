/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

/**
 * 向量型（可变数组型）
 */
export class csmVector<T> {
  /**
   * 带参数的构造函数
   * @param iniitalCapacity 初始化后的容量。数据大小为 _capacity * sizeof(T)
   * @param zeroClear 若为 true，则在初始化时用 0 填充所分配的区域
   */
  constructor(initialCapacity = 0) {
    if (initialCapacity < 1) {
      this._ptr = [];
      this._capacity = 0;
      this._size = 0;
    } else {
      this._ptr = new Array(initialCapacity);
      this._capacity = initialCapacity;
      this._size = 0;
    }
  }

  /**
   * 返回指定索引的元素
   */
  public at(index: number): T {
    return this._ptr[index];
  }

  /**
   * 设置元素
   * @param index 设置元素的索引
   * @param value 要设置的元素
   */
  public set(index: number, value: T): void {
    this._ptr[index] = value;
  }

  /**
   * 获取容器
   */
  public get(offset = 0): T[] {
    const ret: T[] = new Array<T>();
    for (let i = offset; i < this._size; i++) {
      ret.push(this._ptr[i]);
    }
    return ret;
  }

  /**
   * pushBack 处理，向容器中添加新元素
   * @param value 通过 pushBack 处理添加的值
   */
  public pushBack(value: T): void {
    if (this._size >= this._capacity) {
      this.prepareCapacity(
        this._capacity == 0 ? csmVector.DefaultSize : this._capacity * 2
      );
    }

    this._ptr[this._size++] = value;
  }

  /**
   * 释放容器的所有元素
   */
  public clear(): void {
    this._ptr.length = 0;
    this._size = 0;
  }

  /**
   * 返回容器的元素数量
   * @return 容器的元素数量
   */
  public getSize(): number {
    return this._size;
  }

  /**
   * 对容器的所有元素进行赋值处理
   * @param newSize 赋值处理后的大小
   * @param value 要赋给元素的值
   */
  public assign(newSize: number, value: T): void {
    const curSize = this._size;

    if (curSize < newSize) {
      this.prepareCapacity(newSize); // 更新容量
    }

    for (let i = 0; i < newSize; i++) {
      this._ptr[i] = value;
    }

    this._size = newSize;
  }

  /**
   * 更改大小
   */
  public resize(newSize: number, value: T = null): void {
    this.updateSize(newSize, value, true);
  }

  /**
   * 更改大小
   */
  public updateSize(
    newSize: number,
    value: any = null,
    callPlacementNew = true
  ): void {
    const curSize: number = this._size;

    if (curSize < newSize) {
      this.prepareCapacity(newSize); // 更新容量

      if (callPlacementNew) {
        for (let i: number = this._size; i < newSize; i++) {
          if (typeof value == 'function') {
            // 新建
            this._ptr[i] = JSON.parse(JSON.stringify(new value()));
          } // 基本类型，值传递
          else {
            this._ptr[i] = value;
          }
        }
      } else {
        for (let i: number = this._size; i < newSize; i++) {
          this._ptr[i] = value;
        }
      }
    } else {
      // newSize <= this._size
      //---
      const sub = this._size - newSize;
      this._ptr.splice(this._size - sub, sub); // 移除不需要的部分
    }
    this._size = newSize;
  }

  /**
   * 向容器中插入容器元素
   * @param position 插入位置
   * @param begin 要插入的容器的起始位置
   * @param end 要插入的容器的结束位置
   */
  public insert(
    position: iterator<T>,
    begin: iterator<T>,
    end: iterator<T>
  ): void {
    let dstSi: number = position._index;
    const srcSi: number = begin._index;
    const srcEi: number = end._index;

    const addCount: number = srcEi - srcSi;

    this.prepareCapacity(this._size + addCount);

    // 为插入的现有数据进行移位，腾出空间
    const addSize = this._size - dstSi;
    if (addSize > 0) {
      for (let i = 0; i < addSize; i++) {
        this._ptr.splice(dstSi + i, 0, null);
      }
    }

    for (let i: number = srcSi; i < srcEi; i++, dstSi++) {
      this._ptr[dstSi] = begin._vector._ptr[i];
    }

    this._size = this._size + addCount;
  }

  /**
   * 从容器中删除指定索引的元素
   * @param index 索引值
   * @return true 执行删除操作
   * @return false 超出删除范围
   */
  public remove(index: number): boolean {
    if (index < 0 || this._size <= index) {
      return false; // 超出删除范围
    }

    this._ptr.splice(index, 1);
    --this._size;

    return true;
  }

  /**
   * 从容器中删除元素并移动其他元素
   * @param ite 要删除的元素
   */
  public erase(ite: iterator<T>): iterator<T> {
    const index: number = ite._index;
    if (index < 0 || this._size <= index) {
      return ite; // 超出删除范围
    }

    // 删除
    this._ptr.splice(index, 1);
    --this._size;

    const ite2: iterator<T> = new iterator<T>(this, index); // 结束
    return ite2;
  }

  /**
   * 确保容器的容量
   * @param newSize 新的容量。如果参数值小于当前大小，则不执行任何操作。
   */
  public prepareCapacity(newSize: number): void {
    if (newSize > this._capacity) {
      if (this._capacity == 0) {
        this._ptr = new Array(newSize);
        this._capacity = newSize;
      } else {
        this._ptr.length = newSize;
        this._capacity = newSize;
      }
    }
  }

  /**
   * 返回容器的第一个元素
   */
  public begin(): iterator<T> {
    const ite: iterator<T> =
      this._size == 0 ? this.end() : new iterator<T>(this, 0);
    return ite;
  }

  /**
   * 返回容器的最后一个元素
   */
  public end(): iterator<T> {
    const ite: iterator<T> = new iterator<T>(this, this._size);
    return ite;
  }

  public getOffset(offset: number): csmVector<T> {
    const newVector = new csmVector<T>();
    newVector._ptr = this.get(offset);
    newVector._size = this.get(offset).length;
    newVector._capacity = this.get(offset).length;

    return newVector;
  }

  _ptr: T[]; // 容器的起始地址
  _size: number; // 容器的元素数量
  _capacity: number; // 容器的容量

  static readonly DefaultSize = 10; // 容器初始化的默认大小
}

export class iterator<T> {
  /**
   * 构造函数
   */
  public constructor(v?: csmVector<T>, index?: number) {
    this._vector = v != undefined ? v : null;
    this._index = index != undefined ? index : 0;
  }

  /**
   * 赋值
   */
  public set(ite: iterator<T>): iterator<T> {
    this._index = ite._index;
    this._vector = ite._vector;
    return this;
  }

  /**
   * 前置 ++ 运算
   */
  public preIncrement(): iterator<T> {
    ++this._index;
    return this;
  }

  /**
   * 前置 -- 运算
   */
  public preDecrement(): iterator<T> {
    --this._index;
    return this;
  }

  /**
   * 后置 ++ 运算符
   */
  public increment(): iterator<T> {
    const iteold = new iterator<T>(this._vector, this._index++); // 保存旧值
    return iteold;
  }

  /**
   * 后置 -- 运算符
   */
  public decrement(): iterator<T> {
    const iteold = new iterator<T>(this._vector, this._index--); // 保存旧值
    return iteold;
  }

  /**
   * 指针
   */
  public ptr(): T {
    return this._vector._ptr[this._index];
  }

  /**
   * = 运算符重载
   */
  public substitution(ite: iterator<T>): iterator<T> {
    this._index = ite._index;
    this._vector = ite._vector;
    return this;
  }

  /**
   * != 运算符重载
   */
  public notEqual(ite: iterator<T>): boolean {
    return this._index != ite._index || this._vector != ite._vector;
  }

  _index: number; // 容器的索引值
  _vector: csmVector<T>; // 容器
}

// Namespace definition for compatibility.
import * as $ from './csmvector';
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Live2DCubismFramework {
  export const csmVector = $.csmVector;
  export type csmVector<T> = $.csmVector<T>;
  export const iterator = $.iterator;
  export type iterator<T> = $.iterator<T>;
}