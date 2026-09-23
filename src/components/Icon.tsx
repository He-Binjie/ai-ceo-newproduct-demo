// A：统一图标集（线性单色 SVG，替代界面里的 emoji）
// 用法：<Icon n="chart" /> —— 继承 currentColor，默认 14px

const PATHS: Record<string, string> = {
  // 看板/图表
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  trend: 'M3 17l6-6 4 4 8-8M21 7h-5M21 7v5',
  calc: 'M5 3h14v18H5zM8 7h8M8 11h2M12 11h2M16 11h.01M8 15h2M12 15h2M16 15h.01M8 19h6',
  ruler: 'M3 15L15 3l6 6L9 21z M7.5 10.5l2 2M10.5 7.5l2 2M13.5 4.5l2 2',
  // 文档/清单
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4',
  // 物料/箱
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v9',
  factory: 'M3 21h18M4 21V10l5 3V10l5 3V7l6 3v11M9 17h.01M13 17h.01M17 17h.01',
  store: 'M4 10v10h16V10M3 10l2-6h14l2 6a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM9 20v-5h6v5',
  // 系统/设置
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 13.6H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 7L4.6 7a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  robot: 'M12 3v3M8 9h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM9 13h.01M15 13h.01M9.5 17h5M4 12v4M20 12v4',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2',
  // 状态/操作
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  stop: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9h6v6H9z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  chat: 'M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z',
  link: 'M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1',
};

export function Icon({ n, size = 14, style }: { n: string; size?: number; style?: React.CSSProperties }) {
  const d = PATHS[n] || PATHS.list;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: `0 0 ${size}px`, verticalAlign: '-2px', ...style }}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export type IconName = keyof typeof PATHS;