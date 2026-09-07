# AI CEO 交互规范 V1.0

> 适用范围：AI CEO 所有 Demo（新品分仓、智能问数、缺货归因等）
> 来源：朱仙交互标准图 + 多场景交互HTML源码 + 9/7会议共识
> 最后更新：2026-09-07

---

## 1. 设计原则

1. **对话驱动**：左侧对话区是主交互通道，所有操作均可通过自然语言完成
2. **数据展示分离**：右侧面板专注数据展示、导出、action，不承担对话职责
3. **风格统一**：所有技能（skill）共享同一套视觉语言，仅内容不同
4. **80%一致即可**：不追求像素级完美，但颜色、布局、输入输出必须统一

---

## 2. 色彩体系

### 2.1 主色（蓝色系）

| 角色 | 色值 | 用途 |
|------|------|------|
| `--accent` | `#1b4d7a` | 主色：按钮、链接、用户气泡、品牌标识 |
| `--accent-hover` | `#143b5e` | 主色悬停态 |
| `--accent-bright` | `#4fa8e0` | 高亮色：focus边框、进行中状态、渐变起点 |
| `--accent-light` | `#e8f4fa` | 浅底色：选中背景、hover背景、badge底色 |
| `--accent-soft` | `#6ec1e4` | 辅助蓝：图表辅助色 |

### 2.2 语义色

| 角色 | 色值 | 用途 |
|------|------|------|
| `--good` | `#22c55e` | 正常/完成/正向增长 |
| `--warn` | `#f59e0b` | 预警/关注/待处理 |
| `--danger` | `#dc2626` | 异常/紧急/错误 |
| `--info` | `#60a5fa` | 信息提示 |
| `--purple` | `#a78bfa` | 辅助色/图表 |

### 2.3 中性色

| 角色 | 色值 | 用途 |
|------|------|------|
| `--bg-main` | `#f5f9fc` | 页面主背景 |
| `--bg-secondary` | `#f8fbfd` | 对话面板背景 |
| `--bg-tertiary` | `#e8f4fa` | 三级背景（tag、code） |
| `--bg-card` | `#ffffff` | 卡片背景 |
| `--border-main` | `#d7e8f2` | 主边框 |
| `--border-secondary` | `#b9dcec` | 次边框 |
| `--text-main` | `#1b4d7a` | 主文字（与accent同色） |
| `--text-secondary` | `#365f80` | 次文字 |
| `--text-muted` | `#6b7280` | 辅助文字 |
| `--text-faint` | `#91afc2` | 占位符/最弱文字 |

### 2.4 配色规范（来自设计标注图）

- **蓝色** = 导航、查询交互（科技感、功能性）
- **橙色** = 预警、待办（警示性、需要关注）
- **绿色** = 状态反馈（正常、健康）

---

## 3. 布局结构

### 3.1 PC端（双页流）

```
┌─────────────────────────────────────────────────────┐
│  顶栏 (52px)：Logo + 面包屑 + 时钟 + 用户头像       │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  对话面板     │  数据面板                             │
│  (420px)     │  (flex: 1)                           │
│              │                                      │
│  ┌────────┐  │  ┌──────────────────────────────┐    │
│  │消息流   │  │  │ KPI卡片行 (4列)              │    │
│  │        │  │  ├──────────────────────────────┤    │
│  │        │  │  │ 图表/表格/数据洞察            │    │
│  │        │  │  │                              │    │
│  ├────────┤  │  │                              │    │
│  │输入区   │  │  │                              │    │
│  └────────┘  │  └──────────────────────────────┘    │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

### 3.2 顶栏

- 高度：52px
- 左侧：Logo（30px圆角方块，蓝色渐变）+ 品牌名"熵海领航"+ 副标题
- 中间：面包屑导航（智能洞察 / 当前功能名）
- 右侧：时钟 + 通知铃铛 + 用户头像（蓝色渐变圆形）

### 3.3 对话面板（左侧）

- 宽度：420px（min-width: 350px）
- 背景：`--bg-secondary`
- 结构从上到下：
  1. **头部**：标题"AI CEO 助手" + 在线状态绿点 + 重播按钮
  2. **消息流**：flex: 1，overflow-y: auto
  3. **输入区**：textarea + 技能选择按钮 + 发送按钮

### 3.4 数据面板（右侧）

- flex: 1，overflow-y: auto
- 背景：`--bg-main`
- 内边距：20px 24px
- 空状态：居中显示吉祥物 + 引导文字
- 有数据时：KPI行 → 图表卡片 → 表格卡片 → 数据洞察

---

## 4. 组件规范

### 4.1 用户消息气泡

```css
background: var(--accent);        /* #1b4d7a */
color: #fff;
border-radius: 14px 14px 4px 14px;
box-shadow: 0 2px 8px rgba(27,77,122,.18);
max-width: 86%;
align-self: flex-end;
```

### 4.2 AI消息气泡

```css
background: var(--bg-card);       /* #ffffff */
border: 1px solid var(--border-main);
border-radius: 4px 14px 14px 14px;
box-shadow: var(--shadow-card);
width: 100%;
align-self: flex-start;
```

内部结构：
- **bot-head**：头像（蓝色渐变圆）+ 名称 + 状态（在线/思考中）
- **bot-body**：正文内容
- **chips**：可选的快捷操作按钮
- **chain**：思维决策链（可选）
- **evidence**：证据与来源（可选）

### 4.3 思维决策链（Chain）

每个步骤：
- 图标（23px圆）：pending=灰底 / running=蓝边+spinner / done=蓝底+✓
- 步骤间用竖线连接
- 文字：标题（12.5px 600）+ 详情（11.5px muted）

### 4.4 Chips（快捷操作/澄清选项）

```css
border: 1px solid var(--border-secondary);
background: var(--bg-secondary);
color: var(--text-secondary);
border-radius: 20px;
padding: 6px 13px;
font-size: 12.5px;
```

- hover态：`background: var(--accent); color: #fff;`
- 选中态（.on）：同hover
- 热门问题（.hot）：蓝色边框 + 白底 + "TOP1"渐变badge

### 4.5 KPI卡片

```css
background: var(--bg-card);
border: 1px solid var(--border-main);
border-radius: 16px;
box-shadow: var(--shadow-card);
padding: 15px 16px 13px;
```

- 顶部3px渐变色条（每个KPI不同色系）
- 数值：27px 800 weight
- 状态badge：绿(正常) / 橙(关注) / 红(异常)
- 4列网格布局

### 4.6 数据表格

- 表头：`background: var(--bg-tertiary)`，12px muted色
- 行hover：`background: rgba(27,77,122,.02)`
- 数字列：右对齐，monospace字体
- 圆角卡片包裹

### 4.7 预警卡片

```css
border-radius: 12px;
padding: 14px 18px;
border-left: 4px solid [语义色];
```

- 红色预警：`background: rgba(220,38,38,.08)`
- 橙色预警：`background: rgba(245,158,11,.08)`
- 绿色正常：`background: rgba(34,197,94,.08)`

### 4.8 输入区

- textarea：白底 + 蓝色focus边框 + 圆角12px
- 底部工具栏：左侧"选择技能"按钮（虚线边框）+ 右侧发送按钮
- 发送按钮：有内容时蓝色激活态，无内容时灰色

### 4.9 按钮

| 类型 | 样式 |
|------|------|
| 主按钮 | `background: var(--accent); color: #fff; border-radius: 8px;` |
| 次按钮 | `background: #fff; border: 1px solid var(--border-main); color: var(--text-main);` |
| 确认按钮 | `background: var(--accent); color: #fff; padding: 8px 18px; border-radius: 8px;` |

### 4.10 技能选择

- 入口：输入区左下角"+ 选择技能"按钮（虚线边框）
- 点击后弹出技能列表
- 选中后当前对话上下文切换到对应技能
- 新品分仓作为一个技能入口

---

## 5. 交互模式

### 5.1 技能切换

1. 用户点击"+ 选择技能"或在对话中提及特定场景
2. 系统切换技能并在对话中提示"已切换到「新品分仓」"
3. 右侧面板切换到对应技能的展示模板

### 5.2 自然语言输入

- 支持自由文本输入
- 支持语音输入（手机端优先，PC端可选）
- 输入后系统展示思维链 → 生成结果 → 右侧面板更新

### 5.3 二次确认

- 关键操作（如备货方案确认、系数调整）需要用户二次确认
- 确认方式：对话中回复"确认" / 点击确认按钮 / 选择chip
- 确认后右侧面板数据更新

### 5.4 数据导出

- 导出操作仅在右侧面板
- 支持Excel导出
- 导出按钮位于数据卡片右上角

### 5.5 个人偏好

- 用户可设置：负责的仓库、负责的类目
- 偏好为空时提示"请先设置您的职责范围"
- 所有查询自动读取偏好过滤数据范围

---

## 6. 字体规范

| 用途 | 字体 | 大小 | 粗细 |
|------|------|------|------|
| 品牌名 | PingFang SC | 15px | 700 |
| 页面标题 | PingFang SC | 17px | 700 |
| 卡片标题 | PingFang SC | 14.5px | 700 |
| 正文 | PingFang SC | 13-13.5px | 400 |
| 辅助文字 | PingFang SC | 12-12.5px | 400 |
| 数值 | system | 27px | 800 |
| 代码/数字 | ui-monospace | 10.5-12px | 400 |

---

## 7. 圆角与阴影

### 圆角

| 级别 | 值 | 用途 |
|------|------|------|
| sm | 4px | 小元素（tag、code） |
| md | 6px | 代码块 |
| lg | 8px | 按钮、输入框 |
| xl | 12px | 卡片内元素 |
| 2xl | 16px | 卡片 |
| 3xl | 24px | 大容器 |

### 阴影

| 名称 | 值 | 用途 |
|------|------|------|
| shadow-card | `0 1px 3px rgba(27,77,122,.06), 0 4px 16px rgba(27,77,122,.05)` | 卡片默认 |
| shadow-pop | `0 12px 32px rgba(27,77,122,.12)` | 弹出层 |

---

## 8. 动画

| 名称 | 效果 | 用途 |
|------|------|------|
| msgIn | `opacity 0→1, translateY 8px→0, 0.3s` | 消息出现 |
| dashIn | `opacity 0→1, translateY 12px→0, 0.5s` | 看板出现 |
| spin | `rotate 360deg, 0.8s linear infinite` | 加载spinner |
| flash | `box-shadow pulse, 0.9s` | 输入框闪烁提示 |

---

## 9. 手机端（双页流方案）

- 采用双页流（和PC端一致），减少开发量
- 对话和看板分开，通过tab或上下布局切换
- 语音输入优先（按住说话）
- Excel导入导出不在手机端做
- 远期目标：手机端操作可联动PC端同步更新

---

## 10. CSS变量速查（直接复制到项目）

```css
:root {
  /* 主色 */
  --accent: #1b4d7a;
  --accent-hover: #143b5e;
  --accent-bright: #4fa8e0;
  --accent-light: #e8f4fa;
  --accent-soft: #6ec1e4;

  /* 语义色 */
  --good: #22c55e;
  --warn: #f59e0b;
  --danger: #dc2626;
  --info: #60a5fa;
  --purple: #a78bfa;

  /* 背景 */
  --bg-main: #f5f9fc;
  --bg-secondary: #f8fbfd;
  --bg-tertiary: #e8f4fa;
  --bg-card: #ffffff;
  --bg-hover: #e8f4fa;

  /* 边框 */
  --border-main: #d7e8f2;
  --border-secondary: #b9dcec;

  /* 文字 */
  --text-main: #1b4d7a;
  --text-secondary: #365f80;
  --text-muted: #6b7280;
  --text-faint: #91afc2;

  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;
  --radius-2xl: 16px;
  --radius-3xl: 24px;

  /* 阴影 */
  --shadow-card: 0 1px 3px rgba(27,77,122,.06), 0 4px 16px rgba(27,77,122,.05);
  --shadow-pop: 0 12px 32px rgba(27,77,122,.12);

  /* 字体 */
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
```
