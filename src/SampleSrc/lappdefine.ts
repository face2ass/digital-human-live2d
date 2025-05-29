/**
 * Copyright(c) Live2D Inc. 版权所有。
 *
 * 使用此源代码受Live2D开源软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

import { LogLevel } from '@framework/live2dcubismframework';

/**
 * 示例应用中使用的常量
 */

// Canvas width and height pixel values, or dynamic screen size ('auto').
export const CanvasSize: { width: number; height: number } | 'auto' = 'auto';

// Canvas数量
export const CanvasNum = 1;

// 视图参数
export const ViewScale = 1.0;
export const ViewMaxScale = 2.0;
export const ViewMinScale = 0.8;

export const ViewLogicalLeft = -1.0;
export const ViewLogicalRight = 1.0;
export const ViewLogicalBottom = -1.0;
export const ViewLogicalTop = 1.0;

export const ViewLogicalMaxLeft = -2.0;
export const ViewLogicalMaxRight = 2.0;
export const ViewLogicalMaxBottom = -2.0;
export const ViewLogicalMaxTop = 2.0;

// 资源路径
export const ResourcesPath = '../../Resources/';

// 模型背景图片文件
export const BackImageName = 'back_class_normal.png';

// 齿轮图标
export const GearImageName = 'icon_gear.png';

// 关闭按钮图标
export const PowerImageName = 'CloseNormal.png';

// 模型定义---------------------------------------------
// 模型目录名称数组
// 需保持目录名称与model3.json文件名一致
export const ModelDir: string[] = [
  'kei_vowels_pro',
  // 'Mark',
  // 'haru_greeter_t05',
  'Haru',
  'mark_free_t04',
  'Hiyori',
  'Natori',
  'Rice',
  'Mao',
  'Wanko'
];
export const ModelDirSize: number = ModelDir.length;

// 与外部定义文件(json)保持一致
export const MotionGroupIdle = 'Idle'; // 空闲状态
export const MotionGroupTapBody = 'TapBody'; // 点击身体时

// 与外部定义文件(json)保持一致
export const HitAreaNameHead = 'Head';
export const HitAreaNameBody = 'Body';

// 动作优先级常量
export const PriorityNone = 0;
export const PriorityIdle = 1;
export const PriorityNormal = 2;
export const PriorityForce = 3;

// MOC3一致性验证选项
export const MOCConsistencyValidationEnable = true;

// 调试日志显示选项
export const DebugLogEnable = true;
export const DebugTouchLogEnable = false;

// 框架日志输出级别设置
export const CubismLoggingLevel: LogLevel = LogLevel.LogLevel_Verbose;

// 默认渲染目标尺寸
export const RenderTargetWidth = 1900;
export const RenderTargetHeight = 1000;
