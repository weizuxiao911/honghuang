import React, { useState, useMemo } from 'react';
import { modelPrefs } from '../../commands/modelPrefs';

interface ModelInfo {
  id: string;
  providerID: string;
  name: string;
  family?: string;
}

interface ProviderInfo {
  id: string;
  name: string;
  disabled?: boolean;
}

/** 热门提供商 (OpenCode 官方 web 也这么分组 — 由前端 UI 层定义) */
const HOT_PROVIDER_IDS = ['opencode', 'opencode-go', 'anthropic', 'openai', 'google', 'openrouter', 'vercel'];

interface Props {
  models: ModelInfo[];
  providers: ProviderInfo[];
  currentModel: string;
  onSelect: (modelID: string) => void;
  onClose: () => void;
}

type View = 'select' | 'providers';

/** 模型选择弹层 — 选择模型 / 连接提供商 两个视图在同一弹层内切换 (数据全部来自 SDK) */
export const ModelPicker: React.FC<Props> = ({
  models, providers, currentModel, onSelect, onClose,
}) => {
  const [view, setView] = useState<View>('select');
  const [query, setQuery] = useState('');

  const prefs = modelPrefs.get();
  const q = query.trim().toLowerCase();

  const freeModels = useMemo(() => {
    return models
      .filter((m) => !prefs.hidden.includes(m.id))
      .filter((m) => {
        if (!q) return true;
        return m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
      })
      .sort((a, b) => a.id.localeCompare(b.id));
  }, [models, q, prefs]);

  // 热门: 官方 web 固定顺序; 其他: 按名称排序
  const hotProviders = useMemo(() => {
    const list = providers
      .filter((p) => HOT_PROVIDER_IDS.includes(p.id) && !p.disabled)
      .sort((a, b) => HOT_PROVIDER_IDS.indexOf(a.id) - HOT_PROVIDER_IDS.indexOf(b.id));
    if (!q) return list;
    return list.filter((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [providers, q]);

  const otherProviders = useMemo(() => {
    const list = providers
      .filter((p) => !HOT_PROVIDER_IDS.includes(p.id) && !p.disabled)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return list;
    return list.filter((p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
  }, [providers, q]);

  return (
    <div className="tc-ai__mpop-overlay" onClick={onClose}>
      <div className="tc-ai__mpop" onClick={(e) => e.stopPropagation()}>
        <div className="tc-ai__mpop-head">
          {view === 'providers' && (
            <button
              type="button"
              className="tc-ai__mpop-back"
              onClick={() => { setView('select'); setQuery(''); }}
              title="返回选择模型"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}
          <span className="tc-ai__mpop-title">{view === 'select' ? '选择模型' : '连接提供商'}</span>
          <button className="tc-ai__mpop-close" onClick={onClose} title="关闭">×</button>
        </div>

        <div className="tc-ai__mpop-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={view === 'select' ? '搜索模型' : '搜索提供商'}
          />
        </div>

        <div className="tc-ai__mpop-body">
          {view === 'select' && (
            <>
              {freeModels.length > 0 && (
                <div className="tc-ai__mpop-group">
                  <div className="tc-ai__mpop-group-title">OpenCode 提供的免费模型</div>
                  {freeModels.map((m) => {
                    const active = currentModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`tc-ai__mpop-item${active ? ' is-active' : ''}`}
                        onClick={() => onSelect(m.id)}
                      >
                        <span className="tc-ai__mpop-name">{m.name || m.id}</span>
                        <span className="tc-ai__mpop-tag">免费</span>
                        {active && (
                          <svg className="tc-ai__mpop-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {freeModels.length === 0 && (
                <div className="tc-ai__mpop-empty">无匹配模型</div>
              )}

              <div className="tc-ai__mpop-section">
                <div className="tc-ai__mpop-section-title">从热门提供商添加更多模型</div>
                <div className="tc-ai__mpop-providers">
                  {hotProviders.slice(0, 6).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="tc-ai__mpop-provider"
                      onClick={() => { setView('providers'); setQuery(''); }}
                    >
                      <span className="tc-ai__mpop-provider-name">{p.name}</span>
                      {p.id === 'opencode' || p.id === 'opencode-go'
                        ? <span className="tc-ai__mpop-tag">推荐</span>
                        : null}
                    </button>
                  ))}
                </div>
                <button
                  className="tc-ai__mpop-more"
                  onClick={() => { setView('providers'); setQuery(''); }}
                >
                  See {Math.max(0, otherProviders.length + hotProviders.length - 6)}+ more providers
                </button>
              </div>
            </>
          )}

          {view === 'providers' && (
            <>
              {hotProviders.length > 0 && (
                <div className="tc-ai__mpop-group">
                  <div className="tc-ai__mpop-group-title">热门</div>
                  {hotProviders.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="tc-ai__mpop-provider-row"
                      onClick={() => { console.log('connect', p.id); onClose(); }}
                    >
                      <span className="tc-ai__mpop-provider-name">{p.name}</span>
                      {(p.id === 'opencode' || p.id === 'opencode-go') && <span className="tc-ai__mpop-tag">推荐</span>}
                    </button>
                  ))}
                </div>
              )}

              {otherProviders.length > 0 && (
                <div className="tc-ai__mpop-group">
                  <div className="tc-ai__mpop-group-title">其他</div>
                  {otherProviders.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="tc-ai__mpop-provider-row"
                      onClick={() => { console.log('connect', p.id); onClose(); }}
                    >
                      <span className="tc-ai__mpop-provider-name">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {hotProviders.length === 0 && otherProviders.length === 0 && (
                <div className="tc-ai__mpop-empty">无匹配提供商</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
