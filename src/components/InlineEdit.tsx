// B-4：表格内联调参（档位 1 · 演示态）
// 规则：点击数字 → 原地输入框 → Enter/失焦提交、Esc 取消；逐参数校验；提交写变更日志 + 顶部提示
// 演示态约定：值会在页面上生效（用户能看到自己改的结果），但不重算下游数字；真算需档位 2 重写引擎
// 依据：modules/新品分仓-Demo页面调参交互规格-B-20260923.md §2.1–2.6
//
// §2.1「三入口同源」实现：页面内联 / 参数面板 / 对话 三处共用本文件的模块级 value store
//   key = `${param}|${granularity}`；`${param}|*` 为该参数的「全粒度通配」（W1-W4 成品维度改一处全物料同步）
//   取值优先级：精确 key → 通配 key → 组件传入的默认值
//   —— 任一处改动，另两处立即同步；变更日志统一记录来源

import { useEffect, useRef, useState } from 'react';

/* ---------- 校验规则（对齐 B 规格 §2.3） ---------- */
export type EditRule = {
  min: number;
  max: number;
  int?: boolean;
  decimals?: number;
  /** 显示后缀，如 天 / % / 倍 */
  suffix?: string;
  /** 小于 1 时的兜底提示（区域系数专用） */
  floorHint?: boolean;
};

export function validateEdit(raw: string, rule: EditRule): { ok: boolean; value?: number; msg?: string } {
  const t = raw.trim().replace(/[%％天倍杯箱瓶袋包]/g, '').trim();
  if (t === '') return { ok: false, msg: '不能为空' };
  const n = Number(t);
  if (!Number.isFinite(n)) return { ok: false, msg: '请输入数字' };
  if (rule.int && !Number.isInteger(n)) return { ok: false, msg: '需为整数' };
  if (n < rule.min || n > rule.max) {
    return { ok: false, msg: `需在 ${rule.min}–${rule.max}${rule.suffix || ''} 之间` };
  }
  return { ok: true, value: n };
}

/* ===================== 参数值 store（三入口同源） ===================== */
const valueStore = new Map<string, number>();
const valueListeners = new Set<() => void>();
const vKey = (param: string, gran: string) => `${param}|${gran}`;
const vWild = (param: string) => `${param}|*`;

function emitValue() { valueListeners.forEach(l => l()); }

/** 读：精确 key → 通配 key → 默认值 */
export function getPageValue(param: string, gran: string, fallback: number): number {
  const exact = valueStore.get(vKey(param, gran));
  if (exact !== undefined) return exact;
  const wild = valueStore.get(vWild(param));
  return wild !== undefined ? wild : fallback;
}

/** 写：单个粒度（页面内联编辑 / 对话指定到具体实体） */
export function setPageValue(param: string, gran: string, v: number) {
  valueStore.set(vKey(param, gran), v);
  emitValue();
}

/** 写：该参数全粒度（W1-W4 等成品维度参数，「改一处全物料同步」） */
export function setPageValueAll(param: string, v: number) {
  for (const k of Array.from(valueStore.keys())) {
    if (k.startsWith(param + '|')) valueStore.delete(k);
  }
  valueStore.set(vWild(param), v);
  emitValue();
}

/**
 * 写：智能匹配（对话入口用）。
 * 先精确匹配，再按前缀唯一匹配（对话里只说物料名、不写供应商全名时仍能落到表格）。
 * 返回实际命中的粒度名；未命中返回 null（调用方据此决定是否声称"已同步到表格"）。
 */
export function setPageValueSmart(param: string, granHint: string, v: number, known: string[]): string | null {
  if (known.includes(granHint)) { setPageValue(param, granHint, v); return granHint; }
  const hits = known.filter(g => g === granHint || g.startsWith(granHint + ' /') || g.startsWith(granHint));
  if (hits.length === 1) { setPageValue(param, hits[0], v); return hits[0]; }
  if (hits.length > 1) {
    // 多个命中且无更精确线索：全粒度通配（如对话只说物料名 → 该物料所有供应商行同步）
    setPageValueAll(param, v);
    return hits.join(' / ');
  }
  return null;
}

/**
 * 订阅「任意参数值变化」（返回递增版本号）。
 * 供需要同时读多个 key 的组件用（hooks 不能放在 map/循环里）：
 * 先调 useValueVersion() 触发重渲染，再用 getPageValue() 直接读。
 */
export function useValueVersion(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    const l = () => setV(x => x + 1);
    valueListeners.add(l);
    return () => { valueListeners.delete(l); };
  }, []);
  return v;
}

/** 供 UI 订阅单个 key 的值变化（React hook） */
export function usePageValue(param: string, gran: string, fallback: number): number {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(v => v + 1);
    valueListeners.add(l);
    return () => { valueListeners.delete(l); };
  }, []);
  return getPageValue(param, gran, fallback);
}

/* ---------- 变更日志 + 提示（模块级轻量 store，避免层层透传） ---------- */
export type ChangeEntry = {
  id: number;
  time: string;
  param: string;
  granularity: string;
  from: string;
  to: string;
  source: '页面' | '底表' | '对话';
  operator: string;
  effect: string;
};

let changeSeq = 0;
let changeLog: ChangeEntry[] = [];
let toastMsg: string | null = null;
const changeListeners = new Set<() => void>();
const toastListeners = new Set<() => void>();

function emitChange() { changeListeners.forEach(l => l()); }
function emitToast() { toastListeners.forEach(l => l()); }

export function addChange(e: Omit<ChangeEntry, 'id' | 'time'>) {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  changeLog = [{ ...e, id: ++changeSeq, time }, ...changeLog];
  emitChange();
}

export function clearChangeLog() { changeLog = []; emitChange(); }

export function showToast(msg: string) {
  toastMsg = msg;
  emitToast();
  setTimeout(() => { if (toastMsg === msg) { toastMsg = null; emitToast(); } }, 3200);
}

export function useChangeLog() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(v => v + 1);
    changeListeners.add(l);
    return () => { changeListeners.delete(l); };
  }, []);
  return changeLog;
}

export function useToast() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(v => v + 1);
    toastListeners.add(l);
    return () => { toastListeners.delete(l); };
  }, []);
  return toastMsg;
}

/* ---------- 内联可编辑数字 ---------- */
export function EditableNumber({
  value, rule, param, granularity, effect, format, style, syncAll,
}: {
  value: number;
  rule: EditRule;
  /** 参数名，如「区域系数」 */
  param: string;
  /** 粒度，如「湖北子公司」「莲雾苹果汁」 */
  granularity: string;
  /** 重算影响范围，如「Step ②–⑧」 */
  effect: string;
  /** 展示格式化（默认按 rule.decimals 或原值） */
  format?: (v: number) => string;
  style?: React.CSSProperties;
  /** 成品维度参数（W1-W4）：改一处 → 全物料同步 */
  syncAll?: boolean;
}) {
  const cur = usePageValue(param, granularity, value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const fmt = (v: number) => {
    if (format) return format(v);
    const body = rule.decimals !== undefined ? v.toFixed(rule.decimals) : String(v);
    return `${body}${rule.suffix || ''}`;
  };

  const commit = () => {
    const res = validateEdit(draft, rule);
    if (!res.ok) { setErr(res.msg || '输入不合法'); return; }
    const next = res.value as number;
    const floorWarn = rule.floorHint && next < 1;
    if (syncAll) setPageValueAll(param, next); else setPageValue(param, granularity, next);
    setEditing(false);
    setErr(null);
    setFlash(true);
    setTimeout(() => setFlash(false), 1200);
    const scope = syncAll ? `${granularity}（全物料同步）` : granularity;
    addChange({
      param, granularity: scope,
      from: fmt(cur), to: fmt(next) + (floorWarn ? '（<1.0 将按兜底 1.0 参与计算）' : ''),
      source: '页面', operator: '罗', effect,
    });
    showToast(
      floorWarn
        ? `注意：${param} ${scope} → ${fmt(next)}：小于 1.0，按 PRD 兜底规则将取 1.0（宁多勿缺）｜将影响 ${effect}`
        : `✔ ${param} ${scope} → ${fmt(next)}：已按新值更新（演示态，未真实重算）｜将影响 ${effect}`,
    );
  };

  if (editing) {
    return (
      <span className="inline-edit-wrap">
        <input
          ref={inputRef}
          className={`inline-edit-input ${err ? 'has-err' : ''}`}
          value={draft}
          onChange={e => { setDraft(e.target.value); setErr(null); }}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.preventDefault(); setEditing(false); setErr(null); }
          }}
          style={{ width: 62, ...style }}
        />
        {err && <span className="inline-edit-err">{err}</span>}
        <span className="inline-edit-tip" title={`提交后：${effect}`}>⏎ 生效 · Esc 取消</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-edit ${flash ? 'flash' : ''}`}
      title={`点击直接修改｜${param}（${granularity}）｜影响 ${effect}`}
      onClick={() => { setDraft(String(cur)); setEditing(true); }}
      style={style}
    >
      {fmt(cur)}
    </span>
  );
}

/* ---------- 变更日志卡 ---------- */
export function ChangeLogPanel() {
  const log = useChangeLog();
  const hasPageEdit = log.some(e => e.source === '页面' || e.source === '对话');
  return (
    <div className="card" style={{ borderColor: hasPageEdit ? 'var(--accent)' : 'var(--border-main)' }}>
      <div className="card-title">变更日志（本次会话）
        <button className="export-btn" onClick={clearChangeLog} disabled={!log.length}>清空</button>
      </div>
      <div className="changelog-note">
        演示态：改动会<b>记入本日志并即时显示在表格里</b>，但<b>不重算下游数字</b>（真算需按 B 规格档位 2 重写计算引擎）。
        来源三值：页面 / 底表 / 对话。
      </div>
      {log.length === 0 ? (
        <div className="changelog-empty">暂无改动。在右侧任意明细表里点数字即可直接改（区域系数 / 备货系数 / 开封效期 / 损耗率 / W1-W4 / 供应商份额 / MOQ / 三个天数 N）。</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ minWidth: 720 }}>
            <thead>
              <tr><th>时间</th><th>参数</th><th>粒度</th><th>旧值 → 新值</th><th>来源</th><th>操作人</th><th>影响范围</th></tr>
            </thead>
            <tbody>
              {log.map(e => (
                <tr key={e.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{e.time}</td>
                  <td style={{ fontWeight: 600 }}>{e.param}</td>
                  <td style={{ fontSize: 11 }}>{e.granularity}</td>
                  <td style={{ fontSize: 12 }}>{e.from} → <b style={{ color: 'var(--accent)' }}>{e.to}</b></td>
                  <td style={{ fontSize: 11 }}>{e.source}</td>
                  <td style={{ fontSize: 11 }}>{e.operator}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- 全局提示条 ---------- */
export function ToastHost() {
  const msg = useToast();
  if (!msg) return null;
  return <div className="param-toast">{msg}</div>;
}