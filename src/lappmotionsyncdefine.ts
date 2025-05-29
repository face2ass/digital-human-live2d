/**
 * Copyright(c) Live2D Inc. 版权所有。
 *
 * 使用此源代码受Live2D开源软件许可协议的约束，
 * 该协议可在 https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html 找到。
 */

/**
 * 示例应用中使用的常量
 */

// 相对路径
export const ResourcesPath = '../../Resources/';
export const MotionSyncModelSoundsDirName = 'sounds/';

// 快进的图片文件
export const FastForwardImageName = 'icon_fastForward.png';

// 模型定义---------------------------------------------
// 存放模型的目录名数组
// 需保证目录名和 model3.json 的名称一致
export const ModelDir: string[] = ['kei_vowels_pro', 'Haru', 'mark_free_t04'];

export const ModelDirSize: number = ModelDir.length;

// 声道数
export const Channels = 2;
// 采样率
export const SamplesPerSec = 48000;
// 位深度
export const BitDepth = 16;
// 使用麦克风输入的模型（小于 0 表示未使用）
export const UseMicrophoneCanvas = 0;
